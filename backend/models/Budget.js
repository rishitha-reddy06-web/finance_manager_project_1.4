const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: [
      'Food & Dining',
      'Transport',
      'Shopping',
      'Entertainment',
      'Healthcare',
      'Utilities',
      'Housing',
      'Education',
      'Travel',
      'Investment',
      'Insurance',
      'EMI & Loans',
      'Subscriptions',
      'Gifts & Donations',
      'Personal Care',
      'Bank Charges',
      'Salary',
      'Freelance',
      'Business',
      'Other',
      'Total',
    ],
  },
  limit: {
    type: Number,
    required: [true, 'Please add a budget limit'],
    min: [1, 'Budget must be positive'],
  },
  spent: {
    type: Number,
    default: 0,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
  },
  alertSent: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String,
    default: '#6366f1',
  },
}, {
  timestamps: true,
});

// Compound index for unique budget per user/category/month/year
// Only enforces uniqueness when user is not null
BudgetSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true, $ne: null } } });

// Virtual for percentage spent
BudgetSchema.virtual('percentage').get(function () {
  return this.limit > 0 ? Math.round((this.spent / this.limit) * 100) : 0;
});

BudgetSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Budget', BudgetSchema);
