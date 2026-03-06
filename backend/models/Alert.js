const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['overspending', 'budget_warning', 'unusual_transaction', 'goal_reminder', 'savings_milestone'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  relatedBudget: {
    type: mongoose.Schema.ObjectId,
    ref: 'Budget',
  },
  relatedTransaction: {
    type: mongoose.Schema.ObjectId,
    ref: 'Transaction',
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'danger'],
    default: 'info',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Alert', AlertSchema);
