const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { protect } = require('../middleware/auth');
const { getMLPrediction, trainAllModels } = require('../utils/mlEngine');
const PatternDetector = require('../utils/patternDetector');
const RecommendationEngine = require('../utils/recommendationEngine');

// ─── Helper: Generate human-readable AI narrative ───
function generateAINarrative(breakdown, patterns, userName) {
  const cats = Object.entries(breakdown)
    .sort((a, b) => b[1].predicted_amount - a[1].predicted_amount);

  if (cats.length === 0) {
    return `Hello ${userName}! Add more transactions so I can start learning your spending patterns and give you intelligent forecasts.`;
  }

  // Find top increasing categories
  const increasing = cats
    .filter(([, v]) => v.trend === 'increasing')
    .sort((a, b) => Math.abs(b[1].features.growthRate) - Math.abs(a[1].features.growthRate));

  const decreasing = cats
    .filter(([, v]) => v.trend === 'decreasing')
    .sort((a, b) => Math.abs(b[1].features.growthRate) - Math.abs(a[1].features.growthRate));

  const highRisk = cats.filter(([, v]) => v.risk_level === 'high');

  let narrative = `Hello ${userName}! Here's what my analysis reveals:\n\n`;

  // Explain WHY spending is changing
  if (increasing.length > 0) {
    const top2 = increasing.slice(0, 2);
    narrative += `📈 Your spending is rising due to `;
    narrative += top2.map(([cat, v]) => `${cat} (+${Math.abs(v.features.growthRate)}%)`).join(' and ');
    narrative += '. ';

    if (highRisk.length > 0) {
      const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
      narrative += `At this rate, you may exceed your budget in ${daysLeft} days. `;
    }
    narrative += '\n\n';
  }

  if (decreasing.length > 0) {
    narrative += `📉 Good news: `;
    narrative += decreasing.slice(0, 2).map(([cat, v]) => `${cat} (${v.features.growthRate}%)`).join(' and ');
    narrative += ` spending is dropping. Keep it up!\n\n`;
  }

  // Weekend pattern
  if (patterns?.weekend_vs_weekday) {
    const wk = patterns.weekend_vs_weekday;
    if (wk.bias === 'weekend_heavy') {
      narrative += `🗓️ Pattern: You spend ₹${wk.avgWeekend.toLocaleString()} on weekends vs ₹${wk.avgWeekday.toLocaleString()} on weekdays — weekend spending is significantly higher.\n\n`;
    } else if (wk.bias === 'weekday_heavy') {
      narrative += `🗓️ Pattern: Weekday spending (₹${wk.avgWeekday.toLocaleString()}) exceeds weekends (₹${wk.avgWeekend.toLocaleString()}) — likely routine expenses.\n\n`;
    }
  }

  // Risk warning
  if (highRisk.length > 0) {
    const riskNames = highRisk.map(([cat, v]) => `${cat} (${v.probability_of_exceeding}% chance)`).join(', ');
    narrative += `🚨 Risk Alert: There is a high probability of overspending in ${riskNames}.\n\n`;
  }

  // Top suggestion
  const topCat = cats[0];
  if (topCat) {
    const dailySpend = Math.round(topCat[1].predicted_amount / 30);
    const reducedDaily = Math.round(dailySpend * 0.8);
    narrative += `💡 Suggestion: Reducing ${topCat[0]} to ₹${reducedDaily}/day (from ₹${dailySpend}/day) could save ₹${Math.round(topCat[1].predicted_amount * 0.2).toLocaleString()}/month.`;
  }

  return narrative;
}

// ─── Helper: Generate per-category actionable suggestions ───
function generateCategorySuggestions(cat, data) {
  const suggestions = [];
  const dailySpend = Math.round(data.predicted_amount / 30);

  if (data.trend === 'increasing' && data.features.growthRate > 10) {
    suggestions.push(`Reduce ₹${Math.round(dailySpend * 0.2)}/day in ${cat} to stay within budget`);
  }
  if (data.features.weekendRatio > 60) {
    suggestions.push(`Limit ${cat} spending on weekends — ${data.features.weekendRatio}% of your spend happens then`);
  }
  if (data.features.frequency > 15) {
    suggestions.push(`Limit ${cat} transactions to ${Math.max(2, Math.round(data.features.frequency * 0.6))} per week`);
  }
  if (data.risk_level === 'high') {
    suggestions.push(`You are at ${data.probability_of_exceeding}% risk of exceeding your ${cat} budget`);
  }
  if (suggestions.length === 0) {
    suggestions.push(`${cat} spending is stable — keep monitoring`);
  }

  return suggestions;
}

// ─── Helper: Generate reason string for a category ───
function getCategoryReason(data) {
  const reasons = [];
  if (data.features.growthRate > 15) reasons.push('rapid month-over-month growth');
  else if (data.features.growthRate > 5) reasons.push('gradual upward trend');
  if (data.features.weekendRatio > 60) reasons.push('weekend spikes');
  if (data.features.frequency > 15) reasons.push('frequent transactions');
  if (data.features.weekendRatio < 20 && data.features.frequency > 5) reasons.push('consistent weekday routine');
  return reasons.length > 0 ? reasons.join(', ') : 'stable historical pattern';
}

// ─── Helper: Confidence label ───
function getConfidenceLabel(score) {
  if (score >= 70) return { label: 'High', description: 'Consistent spending pattern detected' };
  if (score >= 40) return { label: 'Medium', description: 'Moderate variation in spending' };
  return { label: 'Low', description: 'Unstable or insufficient data' };
}

// @route   GET /api/predictions/expenses
// @desc    Get AI-powered expense prediction with deep insights
// @access  Private
router.get('/expenses', protect, async (req, res) => {
  try {
    const mlPredictions = await getMLPrediction(req.user.id, Transaction);

    // Get pattern analysis from recent transactions
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentTxs = await Transaction.find({
      user: req.user.id, type: 'expense', date: { $gte: threeMonthsAgo }
    });
    const patterns = PatternDetector.detectSpendingPatterns(recentTxs);

    // Enrich each category with reason, suggestions, confidence label
    const enrichedBreakdown = {};
    for (const [cat, data] of Object.entries(mlPredictions)) {
      const lastMonth = data.features.monthlyTotal || 0;
      const pctChange = lastMonth > 0
        ? Math.round(((data.predicted_amount - lastMonth) / lastMonth) * 100)
        : 0;
      const conf = getConfidenceLabel(data.confidence);

      enrichedBreakdown[cat] = {
        ...data,
        pct_change: pctChange,
        reason: getCategoryReason(data),
        suggestions: generateCategorySuggestions(cat, data),
        confidence_label: conf.label,
        confidence_description: conf.description,
        risk_narrative: data.risk_level === 'high'
          ? `There is a ${data.probability_of_exceeding}% chance you may overspend in ${cat} due to ${getCategoryReason(data)}.`
          : data.risk_level === 'medium'
            ? `${cat} is approaching your budget limit — monitor closely.`
            : `${cat} spending is within healthy bounds.`,
      };
    }

    const totalPredicted = Object.values(enrichedBreakdown)
      .reduce((sum, cat) => sum + cat.predicted_amount, 0);

    // Generate narrative
    const aiNarrative = generateAINarrative(
      enrichedBreakdown,
      patterns,
      req.user.name?.split(' ')[0] || 'there'
    );

    // Fastest growing category
    const fastestGrowing = Object.entries(enrichedBreakdown)
      .sort((a, b) => b[1].features.growthRate - a[1].features.growthRate)[0];

    // Unusual spike detection (any category > 30% growth)
    const spikes = Object.entries(enrichedBreakdown)
      .filter(([, v]) => v.features.growthRate > 30)
      .map(([cat, v]) => ({ category: cat, growthRate: v.features.growthRate }));

    res.json({
      success: true,
      data: {
        predictions: [{
          month: 'Next Month',
          predicted: totalPredicted,
          breakdown: enrichedBreakdown,
        }],
        aiNarrative,
        patternInsights: {
          weekendVsWeekday: patterns.weekend_vs_weekday,
          fastestGrowing: fastestGrowing
            ? { category: fastestGrowing[0], growthRate: fastestGrowing[1].features.growthRate }
            : null,
          spikes,
          topCategories: patterns.top_categories,
        },
        method: 'ML-Regression + Feature-Engineering + Pattern-Analysis',
        message: 'AI-powered prediction with behavioral insights and actionable guidance',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/predictions/savings
// @desc    Get savings projection
// @access  Private
router.get('/savings', protect, async (req, res) => {
  try {
    const user = req.user;
    const months = parseInt(req.query.months) || 12;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const data = await Transaction.aggregate([
      { $match: { user: user._id, date: { $gte: threeMonthsAgo } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const transactedAvgIncome = (data.find(d => d._id === 'income')?.total || 0) / 3;
    const avgIncome = Math.max(transactedAvgIncome, user.monthlyIncome || 0);
    const avgExpenses = (data.find(d => d._id === 'expense')?.total || 0) / 3;
    const monthlySavings = avgIncome - avgExpenses;

    const projections = [];
    let cumulativeSavings = 0;
    for (let i = 1; i <= months; i++) {
      cumulativeSavings += monthlySavings;
      projections.push({
        month: getNextMon(i - 1),
        monthlySavings: Math.round(monthlySavings * 100) / 100,
        cumulativeSavings: Math.round(cumulativeSavings * 100) / 100,
        goalProgress: user.savingsGoal > 0
          ? Math.min(100, Math.round((cumulativeSavings / user.savingsGoal) * 100))
          : null,
      });
    }

    const monthsToGoal = user.savingsGoal > 0 && monthlySavings > 0
      ? Math.ceil(user.savingsGoal / monthlySavings)
      : null;

    res.json({
      success: true,
      data: {
        projections,
        avgMonthlyIncome: Math.round(avgIncome * 100) / 100,
        avgMonthlyExpenses: Math.round(avgExpenses * 100) / 100,
        avgMonthlySavings: Math.round(monthlySavings * 100) / 100,
        savingsGoal: user.savingsGoal,
        monthsToGoal,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/predictions/recommendations
// @desc    Get personalized recommendations
// @access  Private
router.get('/recommendations', protect, async (req, res) => {
  try {
    const recommendations = await RecommendationEngine.getAdvancedRecommendations(req.user);
    res.json({ success: true, data: recommendations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/predictions/train
// @desc    Manually retrain all ML models for user
// @access  Private
router.post('/train', protect, async (req, res) => {
  try {
    const startTime = Date.now();
    const result = await trainAllModels(req.user.id, Transaction);
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: `Trained ${result.trained} models in ${duration}ms (${result.skipped} skipped — not enough data)`,
      data: {
        trained: result.trained,
        skipped: result.skipped,
        duration_ms: duration,
        categories: result.categories,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function getNextMon(offset) {
  const date = new Date();
  date.setMonth(date.getMonth() + 1 + offset);
  return date.toLocaleString('default', { month: 'short', year: 'numeric' });
}

module.exports = router;
