const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { getCategoryForecast } = require('../utils/forecastEngine');
const PatternDetector = require('../utils/patternDetector');
const ModelManager = require('../ml/manager');
const RecommendationEngine = require('../utils/recommendationEngine');

class AiAssistantService {
  /**
   * Comprehensive Financial Analysis and Prediction
   */
  static async getFullAnalysis(userId) {
    // 1. Fetch data in parallel for performance
    const [transactions, budgets, categoryPredictions] = await Promise.all([
      Transaction.find({ user: userId }).sort({ date: -1 }).limit(500),
      Budget.find({ user: userId }),
      getCategoryForecast(userId, Transaction)
    ]);

    // 2. Pattern Detection
    const patterns = PatternDetector.detectSpendingPatterns(transactions);

    // 3. Risk Engine Integration
    const totalPredicted = Object.values(categoryPredictions).reduce((sum, cat) => sum + cat.total, 0);
    const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
    
    // Calculate global risk (simplified version of logistic risk)
    let riskProb = 0;
    if (totalBudget > 0) {
      riskProb = Math.min(100, Math.round((totalPredicted / totalBudget) * 100));
    }
    
    const riskLevel = riskProb > 90 ? 'High' : riskProb > 60 ? 'Medium' : 'Low';

    // 4. Reasoning Engine & Suggestions
    const suggestions = [];
    let reasoning = "";

    if (riskLevel !== 'Low') {
      const overAmount = Math.max(0, totalPredicted - totalBudget);
      const perDayReduction = Math.round(overAmount / 30);
      
      reasoning = `Based on your ${patterns.highest_spending_category?.name} spending and ${patterns.weekend_vs_weekday.bias.replace('_', ' ')} patterns, you are likely to exceed your total budget by ₹${overAmount.toLocaleString()}. `;
      
      suggestions.push({
        type: 'reduction',
        message: `To stay on track, you need to reduce spending by ₹${perDayReduction} every day for the next month.`,
        category: patterns.highest_spending_category?.name
      });
    } else {
      reasoning = "Your spending habits are well within your budget limits. You have a healthy surplus predicted for the next 30 days.";
    }

    // 5. Structure Category Predictions for UI
    const formattedCategoryPredictions = Object.entries(categoryPredictions).map(([cat, info]) => ({
      category: cat,
      predicted_amount: info.total,
      trend: info.trend,
      confidence: info.confidence
    }));

    // 6. Final Structured Output
    return {
      summary: reasoning,
      risk: {
        probability: riskProb,
        level: riskLevel
      },
      patterns: patterns,
      suggestions: suggestions,
      confidence: 0.85,
      category_predictions: formattedCategoryPredictions,
      total_predicted: totalPredicted
    };
  }

  /**
   * Chat AI Functionality
   */
  static async handleChatQuery(userId, query) {
    const analysis = await this.getFullAnalysis(userId);
    const q = query.toLowerCase();

    if (q.includes('spend') || q.includes('predict')) {
      return `I predict you will spend a total of ₹${analysis.total_predicted.toLocaleString()} in the next 30 days. Your highest spending will be in ${analysis.patterns.highest_spending_category?.name}.`;
    }
    
    if (q.includes('risk') || q.includes('budget')) {
      return `Your overspending risk is ${analysis.risk.level} (${analysis.risk.probability}%). ${analysis.summary}`;
    }

    if (q.includes('weekend')) {
      const p = analysis.patterns.weekend_vs_weekday;
      return `You spend an average of ₹${p.avgWeekend} per weekend day vs ₹${p.avgWeekday} on weekdays. Your spending is ${p.bias.replace('_', ' ')}.`;
    }

    return "I've analyzed your data and found that your spending is " + analysis.risk.level + " risk. You can ask me about your weekend spending, predictions, or budget risk!";
  }
}

module.exports = AiAssistantService;
