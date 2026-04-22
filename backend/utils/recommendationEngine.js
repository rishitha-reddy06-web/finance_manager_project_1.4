const Transaction = require('../models/Transaction');

/**
 * Advanced Recommendation Engine
 * Analyzes spending patterns, trends, and anomalies to provide actionable advice.
 */
class RecommendationEngine {
  static async getAdvancedRecommendations(user) {
    const recommendations = [];
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // 1. Get spending data for current and last month
    const [currentMonthData, lastMonthData] = await Promise.all([
      this.getCategoryData(user._id, currentMonthStart, now),
      this.getCategoryData(user._id, lastMonthStart, lastMonthEnd)
    ]);

    const totalCurrent = currentMonthData.reduce((sum, c) => sum + c.total, 0);
    const totalLast = lastMonthData.reduce((sum, c) => sum + c.total, 0);

    // 2. Trend Analysis
    if (totalLast > 0) {
      const increase = ((totalCurrent - totalLast) / totalLast) * 100;
      if (increase > 15 && now.getDate() < 25) {
        recommendations.push({
          category: 'Spending Trend',
          type: 'warning',
          message: `Your spending is ${increase.toFixed(0)}% higher than last month at this same time. Try to slow down for the next 10 days.`,
          potentialSavings: Math.round((totalCurrent - totalLast) * 0.5)
        });
      }
    }

    // 3. Category Specific Analysis
    currentMonthData.forEach(cat => {
      const pct = totalCurrent > 0 ? (cat.total / totalCurrent) * 100 : 0;
      const lastMonthCat = lastMonthData.find(l => l._id === cat._id);
      
      // Check for significant increase in a specific category
      if (lastMonthCat && cat.total > lastMonthCat.total * 1.3) {
        recommendations.push({
          category: cat._id,
          type: 'warning',
          message: `Spending in ${cat._id} has spiked by ${(((cat.total - lastMonthCat.total)/lastMonthCat.total)*100).toFixed(0)}% compared to last month.`,
          potentialSavings: Math.round(cat.total - lastMonthCat.total)
        });
      }

      // Traditional Thresholds with improved advice
      if (cat._id === 'Food & Dining' && pct > 25) {
        recommendations.push({
          category: cat._id,
          type: 'info',
          message: `Dining out is taking ${pct.toFixed(0)}% of your budget. Switching 2 meals a week to home-cooked could save significantly.`,
          potentialSavings: Math.round(cat.total * 0.15)
        });
      } else if (cat._id === 'Shopping' && pct > 20) {
        recommendations.push({
          category: cat._id,
          type: 'warning',
          message: `Non-essential shopping is high. Try the 'Wait 48 Hours' rule before any purchase over ₹1,000.`,
          potentialSavings: Math.round(cat.total * 0.2)
        });
      }
    });

    // 4. Recurring Subscription Detection (Advanced)
    const recurring = await Transaction.aggregate([
      { 
        $match: { 
          user: user._id, 
          type: 'expense',
          date: { $gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) } 
        } 
      },
      {
        $group: {
          _id: { description: '$description', amount: '$amount' },
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      },
      { $match: { count: { $gte: 2 } } }
    ]);

    if (recurring.length > 0) {
      const subTotal = recurring.reduce((sum, r) => sum + (r._id.amount), 0);
      recommendations.push({
        category: 'Subscriptions',
        type: 'info',
        message: `We identified ${recurring.length} recurring payments. Reviewing these could save you ₹${subTotal.toLocaleString()} every month.`,
        potentialSavings: subTotal
      });
    }

    // 5. Savings Goal Progress
    const refIncome = user.monthlyIncome || totalLast || totalCurrent;
    if (refIncome > 0) {
      const savings = Math.max(0, refIncome - totalCurrent);
      const savingsRate = (savings / refIncome) * 100;
      
      if (savingsRate < 20) {
        const targetSavings = refIncome * 0.2;
        const gap = targetSavings - savings;
        recommendations.push({
          category: 'Savings',
          type: 'info',
          message: `Your current savings rate is ${savingsRate.toFixed(0)}%. Increasing this to 20% would put an extra ₹${Math.round(gap).toLocaleString()} in your bank each month.`,
          potentialSavings: Math.round(gap)
        });
      } else {
        recommendations.push({
          category: 'Savings',
          type: 'success',
          message: `Excellent! Your savings rate is ${savingsRate.toFixed(0)}%, which is above the healthy 20% benchmark.`,
          potentialSavings: 0
        });
      }
    }

    // Fallback if no specific advice
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'General',
        type: 'success',
        message: 'Your spending habits are very stable. Continue tracking to maintain this balance!',
        potentialSavings: 0
      });
    }

    return recommendations;
  }

  static async getCategoryData(userId, start, end) {
    return await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: start, $lte: end },
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
  }
}

module.exports = RecommendationEngine;
