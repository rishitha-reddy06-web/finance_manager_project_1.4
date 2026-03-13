const express = require('express');
const router = express.Router();
const axios = require('axios');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// @route   GET /api/predictions/expenses
// @desc    Get AI prediction for future expenses
// @access  Private
router.get('/expenses', protect, async (req, res) => {
  try {
    // Get last 6 months of data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await Transaction.find({
      user: req.user.id,
      type: 'expense',
      date: { $gte: sixMonthsAgo },
    }).sort({ date: 1 });

    if (transactions.length < 5) {
      // Fallback: simple moving average prediction
      const monthlySums = {};
      transactions.forEach(tx => {
        const key = `${new Date(tx.date).getFullYear()}-${new Date(tx.date).getMonth()}`;
        monthlySums[key] = (monthlySums[key] || 0) + tx.amount;
      });

      const values = Object.values(monthlySums);
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

      return res.json({
        success: true,
        data: {
          predictions: [
            { month: getNextMon(0), predicted: Math.round(avg * 100) / 100 },
            { month: getNextMon(1), predicted: Math.round(avg * 1.02 * 100) / 100 },
            { month: getNextMon(2), predicted: Math.round(avg * 1.04 * 100) / 100 },
          ],
          method: 'moving_average',
          message: 'Prediction based on available data (limited history)',
        },
      });
    }

    // Try to call Python AI service
    try {
      const monthlyData = {};
      transactions.forEach(tx => {
        const date = new Date(tx.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + tx.amount;
      });

      const response = await axios.post(`${process.env.AI_SERVICE_URL}/predict`, {
        monthly_expenses: monthlyData,
        forecast_months: 3,
      }, { timeout: 5000 });

      return res.json({ success: true, data: response.data });
    } catch (aiError) {
      // Fallback to JavaScript prediction
      const monthlyData = {};
      transactions.forEach(tx => {
        const date = new Date(tx.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + tx.amount;
      });

      const values = Object.values(monthlyData);
      const n = values.length;
      const predictions = [];

      for (let i = 0; i < 3; i++) {
        // Weighted moving average
        const weights = values.slice(-3);
        const weightedAvg = weights.reduce((sum, val, idx) => sum + val * (idx + 1), 0) /
          weights.reduce((sum, _, idx) => sum + (idx + 1), 0);
        const trend = n >= 2 ? (values[n - 1] - values[0]) / (n - 1) : 0;
        const predicted = Math.max(0, weightedAvg + trend * (i + 0.5));
        predictions.push({
          month: getNextMon(i),
          predicted: Math.round(predicted * 100) / 100,
        });
        values.push(predicted);
      }

      return res.json({
        success: true,
        data: {
          predictions,
          method: 'weighted_moving_average',
          message: 'AI service unavailable, using statistical prediction',
        },
      });
    }
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

    // Get last 3 months average
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const data = await Transaction.aggregate([
      {
        $match: {
          user: user._id,
          date: { $gte: threeMonthsAgo },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
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
    const user = req.user;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const categoryData = await Transaction.aggregate([
      {
        $match: {
          user: user._id,
          type: 'expense',
          date: { $gte: oneMonthAgo },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const totalExpenses = categoryData.reduce((s, c) => s + c.total, 0);
    const recommendations = [];

    categoryData.forEach(cat => {
      const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;

      if (cat._id === 'Food & Dining' && pct > 30) {
        recommendations.push({
          category: cat._id,
          type: 'warning',
          message: `Food & Dining accounts for ${pct.toFixed(0)}% of your expenses. Consider meal prepping to save more.`,
          potentialSavings: Math.round(cat.total * 0.2 * 100) / 100,
        });
      } else if (cat._id === 'Entertainment' && pct > 15) {
        recommendations.push({
          category: cat._id,
          type: 'warning',
          message: `Entertainment is ${pct.toFixed(0)}% of your budget. Look for free or low-cost alternatives.`,
          potentialSavings: Math.round(cat.total * 0.3 * 100) / 100,
        });
      } else if (cat._id === 'Shopping' && pct > 25) {
        recommendations.push({
          category: cat._id,
          type: 'warning',
          message: `Shopping expenses are high at ${pct.toFixed(0)}%. Consider a 30-day rule before non-essential purchases.`,
          potentialSavings: Math.round(cat.total * 0.25 * 100) / 100,
        });
      }
    });

    const refIncome = Math.max(user.monthlyIncome || 0, totalExpenses); // Use profile income or total expenses as baseline

    if (refIncome > 0) {
      const actualSavings = Math.max(0, refIncome - totalExpenses);
      const savingsRate = (actualSavings / refIncome) * 100;
      if (savingsRate < 20) {
        recommendations.push({
          category: 'Savings',
          type: 'info',
          message: `Your current savings rate is ${savingsRate.toFixed(0)}%. Financial experts recommend saving at least 20% of income.`,
          potentialSavings: Math.round((user.monthlyIncome * 0.2 - Math.max(0, user.monthlyIncome - totalExpenses)) * 100) / 100,
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        category: 'General',
        type: 'success',
        message: 'Great job! Your spending patterns look healthy. Keep up the good work!',
        potentialSavings: 0,
      });
    }

    res.json({ success: true, data: recommendations });
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
