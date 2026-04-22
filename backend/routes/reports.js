const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { protect } = require('../middleware/auth');

// @route   GET /api/reports/export/pdf
// @desc    Export report as PDF
// @access  Private
router.get('/export/pdf', protect, async (req, res) => {
  try {
    const { startDate, endDate, month, year } = req.query;
    let query = { user: req.user.id };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (month && year) {
      query.date = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=financial_report.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(24).fillColor('#6366f1').text('Financial Report', { align: 'center' });
    doc.fontSize(12).fillColor('#64748b').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    doc.fontSize(14).fillColor('#1e293b').text('Summary', { underline: true });
    doc.fontSize(11).fillColor('#334155');
    doc.text(`Total Income: $${totalIncome.toFixed(2)}`);
    doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`);
    doc.text(`Net Savings: $${netSavings.toFixed(2)}`);
    doc.moveDown();

    // Transactions table
    doc.fontSize(14).fillColor('#1e293b').text('Transactions', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
    const colWidths = [80, 60, 100, 160, 70];
    let xPos = 50;

    doc.fontSize(10).fillColor('#6366f1');
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i] });
      xPos += colWidths[i];
    });

    doc.moveTo(50, tableTop + 15).lineTo(520, tableTop + 15).stroke('#e2e8f0');

    let yPos = tableTop + 20;
    transactions.slice(0, 50).forEach((tx, idx) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
      xPos = 50;
      doc.fillColor(idx % 2 === 0 ? '#1e293b' : '#334155').fontSize(9);
      const row = [
        new Date(tx.date).toLocaleDateString(),
        tx.type,
        tx.category,
        tx.description || '-',
        `$${tx.amount.toFixed(2)}`,
      ];
      row.forEach((cell, i) => {
        doc.text(cell, xPos, yPos, { width: colWidths[i] });
        xPos += colWidths[i];
      });
      yPos += 18;
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/reports/export/excel
// @desc    Export report as Excel
// @access  Private
router.get('/export/excel', protect, async (req, res) => {
  try {
    const { startDate, endDate, month, year } = req.query;
    let query = { user: req.user.id };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (month && year) {
      query.date = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Finance Manager';

    // Transactions sheet
    const sheet = workbook.addWorksheet('Transactions');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FF6366F1' } };

    transactions.forEach(tx => {
      sheet.addRow({
        date: new Date(tx.date).toLocaleDateString(),
        type: tx.type,
        category: tx.category,
        description: tx.description || '',
        amount: tx.amount,
        paymentMethod: tx.paymentMethod,
      });
    });

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Income', totalIncome]);
    summarySheet.addRow(['Total Expenses', totalExpenses]);
    summarySheet.addRow(['Net Savings', totalIncome - totalExpenses]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=financial_report.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// @route   GET /api/reports/summary/payment-methods
// @desc    Get payment method breakdown
// @access  Private
router.get('/summary/payment-methods', protect, async (req, res) => {
  try {
    const { startDate, endDate, month, year } = req.query;
    let query = { user: req.user.id };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (month && year) {
      query.date = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const transactions = await Transaction.find(query);

    const paymentMethodStats = {};
    const upiStats = { sent: 0, received: 0, count: 0, merchants: new Set() };

    transactions.forEach(tx => {
      const method = tx.paymentMethod || 'other';
      if (!paymentMethodStats[method]) {
        paymentMethodStats[method] = { income: 0, expense: 0, count: 0 };
      }
      paymentMethodStats[method].count++;
      if (tx.type === 'income') {
        paymentMethodStats[method].income += tx.amount;
      } else {
        paymentMethodStats[method].expense += tx.amount;
      }

      if (method === 'upi') {
        if (tx.type === 'income') {
          upiStats.received += tx.amount;
        } else {
          upiStats.sent += tx.amount;
        }
        upiStats.count++;
        if (tx.description) {
          const upiIdMatch = tx.description.match(/[a-zA-Z0-9]+@[a-zA-Z]+/);
          if (upiIdMatch) upiStats.merchants.add(upiIdMatch[0]);
        }
      }
    });

    res.json({
      success: true,
      data: {
        breakdown: paymentMethodStats,
        upi: {
          totalSent: upiStats.sent,
          totalReceived: upiStats.received,
          transactionCount: upiStats.count,
          uniqueMerchants: upiStats.merchants.size,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
