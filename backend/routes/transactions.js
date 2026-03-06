const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Alert = require('../models/Alert');
const { protect } = require('../middleware/auth');

const upload = multer({ dest: 'uploads/' });

// @route   GET /api/transactions
// @desc    Get all transactions for user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, category, startDate, endDate, search } = req.query;
    const query = { user: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: transactions.length,
      total,
      pages: Math.ceil(total / limit),
      data: transactions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/transactions
// @desc    Add transaction
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    req.body.user = req.user.id;
    const transaction = await Transaction.create(req.body);

    // Update budget spent amount
    if (transaction.type === 'expense') {
      const txDate = new Date(transaction.date);
      const budget = await Budget.findOne({
        user: req.user.id,
        category: transaction.category,
        month: txDate.getMonth() + 1,
        year: txDate.getFullYear(),
      });

      if (budget) {
        budget.spent += transaction.amount;
        await budget.save();

        // Create budget alert - only ONE alert per budget
        // Priority: exceeded (100%) > warning (threshold)
        const percentage = (budget.spent / budget.limit) * 100;
        const threshold = req.user.alertPreferences?.overspendingThreshold || 80;
        
        // Only fire alert if none has been sent yet for this budget
        if (!budget.alertSent) {
          if (percentage >= 100) {
            // Exceeded alert at 100%
            await Alert.create({
              user: req.user.id,
              type: 'overspending',
              title: `Budget Exceeded: ${budget.category}`,
              message: `You have exceeded your ${budget.category} budget of ₹${budget.limit}. Current spending: ₹${budget.spent.toFixed(2)}`,
              relatedBudget: budget._id,
              relatedTransaction: transaction._id,
              severity: 'danger',
            });
          } else if (percentage >= threshold) {
            // Warning alert at threshold (e.g., 80%)
            await Alert.create({
              user: req.user.id,
              type: 'budget_warning',
              title: `Budget Warning: ${budget.category}`,
              message: `You have used ${percentage.toFixed(0)}% of your ${budget.category} budget.`,
              relatedBudget: budget._id,
              severity: 'warning',
            });
          }
          
          // Mark alert as sent - no more alerts for this budget
          if (percentage >= threshold) {
            budget.alertSent = true;
            await budget.save();
          }
        }
      }
    }

    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (transaction.user.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (transaction.user.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    await transaction.deleteOne();
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/transactions/import
// @desc    Import transactions from CSV
// @access  Private
router.post('/import', protect, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a CSV file' });

  const transactions = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      try {
        const transaction = {
          user: req.user.id,
          type: row.type || 'expense',
          amount: parseFloat(row.amount),
          category: row.category || 'Other',
          description: row.description || '',
          date: row.date ? new Date(row.date) : new Date(),
          paymentMethod: row.paymentMethod || 'other',
          importSource: 'csv',
        };
        if (!isNaN(transaction.amount) && transaction.amount > 0) {
          transactions.push(transaction);
        }
      } catch (e) {
        errors.push(e.message);
      }
    })
    .on('end', async () => {
      try {
        const imported = await Transaction.insertMany(transactions, { ordered: false });
        fs.unlinkSync(req.file.path);
        res.json({
          success: true,
          message: `Imported ${imported.length} transactions`,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });
});

// @route   GET /api/transactions/summary
// @desc    Get monthly summary
// @access  Private
router.get('/summary/monthly', protect, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const summary = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryBreakdown = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({ success: true, data: { summary, categoryBreakdown } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/transactions/cashflow
// @desc    Get cash flow data for chart
// @access  Private
router.get('/summary/cashflow', protect, async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const results = [];
    const now = new Date();

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const data = await Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            date: { $gte: date, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
          },
        },
      ]);

      const income = data.find(d => d._id === 'income')?.total || 0;
      const expenses = data.find(d => d._id === 'expense')?.total || 0;

      results.push({
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        income,
        expenses,
        savings: income - expenses,
      });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
