const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// @route   GET /api/budgets
// @desc    Get all budgets for user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;
    const budgets = await Budget.find({
      user: req.user.id,
      month: parseInt(month),
      year: parseInt(year),
    });

    // Recalculate spent for each budget
    for (const budget of budgets) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      let matchQuery = {
        user: req.user._id,
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

      budget.spent = result[0]?.total || 0;
      await budget.save();
    }

    res.json({ success: true, count: budgets.length, data: budgets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/budgets
// @desc    Create budget
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { category, limit, month, year, color } = req.body;
    
    // Check for existing budget (same user + category + month + year)
    const existingBudget = await Budget.findOne({
      user: req.user.id,
      category: category,
      month: parseInt(month),
      year: parseInt(year),
    });
    
    if (existingBudget) {
      return res.status(400).json({
        success: false,
        message: `Budget for "${category}" in this month already exists`
      });
    }
    
    const budgetData = {
      user: req.user.id,
      name: category,
      category,
      limit: parseFloat(limit),
      month: parseInt(month),
      year: parseInt(year),
      color: color || '#6366f1',
    };
    const budget = await Budget.create(budgetData);
    res.status(201).json({ success: true, data: budget });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/budgets/:id
// @desc    Update budget
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    if (budget.user.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    const { category, limit, month, year, color } = req.body;
    const updates = {};
    if (category !== undefined) updates.category = category;
    if (limit !== undefined) updates.limit = parseFloat(limit);
    if (month !== undefined) updates.month = parseInt(month);
    if (year !== undefined) updates.year = parseInt(year);
    if (color !== undefined) updates.color = color;
    if (updates.category || updates.month || updates.year) updates.name = updates.category || budget.category;

    budget = await Budget.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, data: budget });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/budgets/:id
// @desc    Delete budget
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    if (budget.user.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    await budget.deleteOne();
    res.json({ success: true, message: 'Budget deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
