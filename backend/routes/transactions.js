const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Alert = require('../models/Alert');
const { protect } = require('../middleware/auth');
const pdfParserService = require('../services/pdfParserService');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Only accept PDF files
    if (ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type '${ext}'. Only PDF files are supported.`), false);
    }
  }
});

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

const VALID_CATEGORIES = new Set([
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
  'Salary',
  'Freelance',
  'Business',
  'Insurance',
  'EMI & Loans',
  'Subscriptions',
  'Gifts & Donations',
  'Bank Charges',
  'Other',
]);

const VALID_PAYMENT_METHODS = new Set(['cash', 'card', 'bank_transfer', 'upi', 'other']);
const PDF_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'application/x-bzpdf',
  'application/x-gzpdf',
  'application/octet-stream',
]);

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('Failed to remove uploaded file:', err.message);
  }
}

function isPdfUpload(file) {
  if (!file) return false;
  const ext = path.extname(file.originalname || '').toLowerCase();
  return ext === '.pdf' || PDF_MIME_TYPES.has(file.mimetype);
}

function normalizePaymentMethod(paymentMethod) {
  const value = (paymentMethod || 'other').toLowerCase().trim();
  return VALID_PAYMENT_METHODS.has(value) ? value : 'other';
}

function normalizeCategory(category) {
  if (!category) return 'Other';
  
  // Normalize the category to match exactly with valid categories
  const value = category.trim();
  
  // Check for exact match (case-insensitive)
  for (const validCat of VALID_CATEGORIES) {
    if (validCat.toLowerCase() === value.toLowerCase()) {
      return validCat;
    }
  }
  
  // If no exact match, try to find best match
  const lower = value.toLowerCase();
  if (lower.includes('food') || lower.includes('dining')) return 'Food & Dining';
  if (lower.includes('transport') || lower.includes('travel') && !lower.includes('trip')) return 'Transport';
  if (lower.includes('shopping')) return 'Shopping';
  if (lower.includes('entertainment')) return 'Entertainment';
  if (lower.includes('health') || lower.includes('medical')) return 'Healthcare';
  if (lower.includes('util') || lower.includes('bill')) return 'Utilities';
  if (lower.includes('housing') || lower.includes('rent')) return 'Housing';
  if (lower.includes('education') || lower.includes('school')) return 'Education';
  if (lower.includes('travel') || lower.includes('vacation')) return 'Travel';
  if (lower.includes('investment') || lower.includes('stock')) return 'Investment';
  if (lower.includes('salary') || lower.includes('income')) return 'Salary';
  if (lower.includes('freelance')) return 'Freelance';
  if (lower.includes('business')) return 'Business';
  if (lower.includes('insurance') || lower.includes('policy')) return 'Insurance';
  if (lower.includes('emi') || lower.includes('loan') || lower.includes('credit')) return 'EMI & Loans';
  if (lower.includes('subscription')) return 'Subscriptions';
  if (lower.includes('gift') || lower.includes('donation')) return 'Gifts & Donations';
  if (lower.includes('charge') || lower.includes('fee') || lower.includes('bank')) return 'Bank Charges';
  
  return 'Other';
}

async function updateBudgetsForImportedTransactions(userId, transactions) {
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const txDate = new Date(tx.date);
    const budget = await Budget.findOne({
      user: userId,
      category: tx.category,
      month: txDate.getMonth() + 1,
      year: txDate.getFullYear(),
    });
    if (!budget) continue;
    budget.spent += tx.amount;
    await budget.save();
  }
}

async function processPdfImport(req, res) {
  let filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF file',
        errors: ['No file provided'],
      });
    }

    if (req.file.size === 0) {
      safeUnlink(filePath);
      filePath = null;
      return res.status(400).json({
        success: false,
        message: 'File is empty',
        errors: ['The uploaded PDF file is empty'],
      });
    }

    if (!isPdfUpload(req.file)) {
      safeUnlink(filePath);
      filePath = null;
      return res.status(400).json({
        success: false,
        message: 'Invalid file type',
        errors: ['Only PDF files are supported for this endpoint'],
      });
    }

    const parseResult = await pdfParserService.parsePdf(filePath);
    safeUnlink(filePath);
    filePath = null;

    if (!parseResult.success) {
      console.error('PDF parsing failed:', parseResult.error);
      return res.status(400).json({
        success: false,
        message: 'Failed to parse PDF: ' + (parseResult.error || 'Unknown error'),
        errors: [parseResult.error || 'The PDF could not be parsed'],
        suggestions: [
          'Ensure the PDF is a text-based statement (not only scanned images)',
          'Check whether the PDF is password-protected',
          'Try a different statement format or page range',
          'Ensure the file contains clear transaction data with date, description, and amount columns',
        ],
      });
    }

    if (parseResult.transactions.length === 0) {
      console.warn('No transactions parsed from PDF', {
        bank: parseResult.detectedBank,
        pageCount: parseResult.pageCount,
        textLength: parseResult.rawText?.length || 0,
      });
      return res.status(400).json({
        success: false,
        message: 'No transactions found in PDF',
        errors: ['No date/description/amount transaction lines were detected'],
        bankDetected: parseResult.detectedBank,
        format: parseResult.statementFormat,
        pageCount: parseResult.pageCount,
        textPreview: parseResult.rawText ? parseResult.rawText.substring(0, 500) : 'No text extracted',
        suggestions: [
          'Upload a full bank statement page with transaction rows',
          'Ensure the PDF is text-based (not a scanned image)',
          'Ensure the statement includes: Date, Description, and Amount columns',
          'Supported date formats: DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY',
          `Detected bank: ${parseResult.detectedBank || 'Unknown'}`,
        ],
      });
    }

    const duplicates = [];
    const newTransactions = [];

    for (const tx of parseResult.transactions) {
      const exists = await Transaction.findOne({
        user: req.user.id,
        date: {
          $gte: new Date(new Date(tx.date).setHours(0, 0, 0, 0)),
          $lte: new Date(new Date(tx.date).setHours(23, 59, 59, 999)),
        },
        amount: {
          $gte: tx.amount * 0.99,
          $lte: tx.amount * 1.01,
        },
        description: new RegExp(tx.description.substring(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      });

      if (exists) {
        duplicates.push({
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          reason: 'Matching transaction already exists',
        });
      } else {
        newTransactions.push({
          ...tx,
          category: normalizeCategory(tx.category || 'Other'),
          paymentMethod: normalizePaymentMethod(tx.paymentMethod || 'bank_transfer'),
          user: req.user.id,
        });
      }
    }

    if (newTransactions.length === 0) {
      console.info('All transactions in PDF are duplicates', {
        userId: req.user.id,
        duplicateCount: duplicates.length,
      });
      return res.status(400).json({
        success: false,
        message: 'All transactions in this PDF are duplicates',
        errors: ['All parsed transactions already exist in your account'],
        duplicateCount: duplicates.length,
        duplicates: duplicates.slice(0, 10),
        suggestions: [
          'These transactions have already been imported',
          'Check your transaction history to confirm',
          'Upload a different bank statement document',
        ],
      });
    }

    const imported = await Transaction.insertMany(newTransactions, { ordered: false });
    await updateBudgetsForImportedTransactions(req.user.id, imported);

    console.info('PDF import successful', {
      userId: req.user.id,
      imported: imported.length,
      skipped: duplicates.length,
      parser: parseResult.parser,
    });

    return res.json({
      success: true,
      message: `Successfully imported ${imported.length} transactions from PDF`,
      data: {
        imported: imported.length,
        skipped: duplicates.length,
        total: parseResult.transactions.length,
        transactions: imported,
        duplicates: duplicates.length > 0 ? duplicates.slice(0, 5) : [],
        parser: parseResult.parser,
        statementFormat: parseResult.statementFormat || {
          bank: parseResult.detectedBank,
          pageCount: parseResult.pageCount,
          confidence: 'medium',
        },
      },
    });
  } catch (err) {
    console.error('PDF import error:', err);
    safeUnlink(filePath);
    return res.status(500).json({
      success: false,
      message: 'Error processing PDF upload: ' + err.message,
      errors: [err.message || 'Unexpected error while processing the PDF'],
      suggestions: [
        'Try a smaller PDF',
        'Ensure the statement is not corrupted',
        'Check that the PDF is not password-protected',
        'Retry the upload',
      ],
    });
  }
}

// @route   POST /api/transactions/import
// @desc    Import transactions from PDF bank statement
// @access  Private
router.post('/import', protect, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large',
            errors: ['File size must be less than 10MB'],
          });
        }
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          errors: [err.message],
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid file type',
        errors: ['Only PDF files are supported'],
      });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a PDF file',
      errors: ['No file was provided'],
      suggestions: [
        'Select a .pdf file to upload',
        'Ensure the file is not empty',
      ],
    });
  }

  if (isPdfUpload(req.file)) return processPdfImport(req, res);

  safeUnlink(req.file.path);
  return res.status(400).json({
    success: false,
    message: 'Unsupported file format',
    errors: [`File type '${path.extname(req.file.originalname)}' is not supported`],
    suggestions: [
      'Only PDF files are supported',
      'Ensure your file has the .pdf extension',
    ],
  });
});

// @route   POST /api/transactions/import-pdf
// @desc    Import transactions from PDF bank statement
// @access  Private
router.post('/import-pdf', protect, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error',
        errors: [err.message || 'Invalid file'],
      });
    }
    next();
  });
}, processPdfImport);

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

    res.json({ success: true, data: { summary, categoryBreakdown, monthlyIncome: req.user.monthlyIncome } });
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

    res.json({ success: true, data: results, monthlyIncome: req.user.monthlyIncome });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
