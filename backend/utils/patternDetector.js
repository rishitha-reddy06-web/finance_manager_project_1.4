const moment = require('moment');

class PatternDetector {
  static detectSpendingPatterns(transactions) {
    if (!transactions || transactions.length === 0) {
      return {
        weekend_vs_weekday: { avgWeekday: 0, avgWeekend: 0, bias: "none" },
        highest_spending_category: null,
        top_categories: []
      };
    }

    const weekdaySpending = { total: 0, count: 0 };
    const weekendSpending = { total: 0, count: 0 };
    const categoryTotals = {};
    const dailyTotals = {};

    transactions.forEach(tx => {
      const date = moment(tx.date);
      const isWeekend = [0, 6].includes(date.day()); // 0 is Sunday, 6 is Saturday
      const amount = tx.amount;

      // Weekday vs Weekend
      if (isWeekend) {
        weekendSpending.total += amount;
        weekendSpending.count++;
      } else {
        weekdaySpending.total += amount;
        weekdaySpending.count++;
      }

      // Categories
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amount;

      // Daily totals for growth trend
      const dateStr = date.format('YYYY-MM-DD');
      dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + amount;
    });

    // Calculate averages
    const avgWeekday = weekdaySpending.count > 0 ? weekdaySpending.total / (weekdaySpending.count / 5) : 0;
    const avgWeekend = weekendSpending.count > 0 ? weekendSpending.total / (weekendSpending.count / 2) : 0;

    // Highest category
    const highestCategory = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])[0];

    // Determine weekend bias
    let weekendBias = "balanced";
    if (avgWeekend > avgWeekday * 1.5) weekendBias = "weekend_heavy";
    else if (avgWeekday > avgWeekend * 1.5) weekendBias = "weekday_heavy";

    return {
      weekend_vs_weekday: {
        avgWeekday: Math.round(avgWeekday),
        avgWeekend: Math.round(avgWeekend),
        bias: weekendBias
      },
      highest_spending_category: highestCategory ? { name: highestCategory[0], amount: highestCategory[1] } : null,
      top_categories: Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, amount]) => ({ name, amount }))
    };
  }
}

module.exports = PatternDetector;
