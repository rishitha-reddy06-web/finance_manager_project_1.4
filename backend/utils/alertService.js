const Budget = require('../models/Budget');
const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');

const checkBudgetAlerts = async () => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const budgets = await Budget.find({ month, year }).populate('user');

    for (const budget of budgets) {
      if (!budget.user) continue;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      let matchQuery = {
        user: budget.user._id,
        type: 'expense',
        date: { $gte: startDate, $lte: endDate },
      };

      if (budget.category !== 'Total') {
        matchQuery.category = budget.category;
      }

      const result = await Transaction.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const spent = result[0]?.total || 0;
      budget.spent = spent;
      await budget.save();

      const percentage = (spent / budget.limit) * 100;
      const threshold = budget.user.alertPreferences?.overspendingThreshold || 80;

      // Only fire ONE alert per budget - exceeded (100%) has priority over warning
      if (!budget.alertSent) {
        if (percentage >= 100) {
          await Alert.create({
            user: budget.user._id,
            type: 'overspending',
            title: `Budget Exceeded: ${budget.category}`,
            message: `You have exceeded your ${budget.category} budget of ₹${budget.limit}. Current spending: ₹${spent.toFixed(2)}`,
            relatedBudget: budget._id,
            severity: 'danger',
          });
        } else if (percentage >= threshold) {
          await Alert.create({
            user: budget.user._id,
            type: 'budget_warning',
            title: `Budget Warning: ${budget.category}`,
            message: `You have used ${percentage.toFixed(0)}% of your ${budget.category} budget (₹${spent.toFixed(2)} of ₹${budget.limit}).`,
            relatedBudget: budget._id,
            severity: 'warning',
          });
        }
        
        if (percentage >= threshold) {
          budget.alertSent = true;
          await budget.save();
        }
      }
    }

    console.log('Budget alert check completed');
  } catch (err) {
    console.error('Error in budget alert check:', err);
  }
};

module.exports = { checkBudgetAlerts };
