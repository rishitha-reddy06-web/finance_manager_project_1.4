/**
 * Bank Statement Import Validation Utility
 * Provides validation and testing for PDF/CSV import functionality
 */

const fs = require('fs');
const path = require('path');

class ImportValidator {
  /**
   * Validate if a CSV file has the required structure
   * @param {string} filePath - Path to CSV file
   * @returns {Object} - Validation result
   */
  static validateCSVStructure(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (lines.length < 2) {
        return {
          valid: false,
          errors: ['CSV must have at least a header row and one data row'],
        };
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const errors = [];

      // Check for required columns
      const hasAmount = headers.some(h => 
        ['amount', 'amt', 'value', 'debit', 'credit', 'dr', 'cr'].includes(h)
      );
      const hasDate = headers.some(h =>
        ['date', 'transaction_date', 'txn_date', 'posting_date'].includes(h)
      );
      const hasDescription = headers.some(h =>
        ['description', 'desc', 'narration', 'details'].includes(h)
      );

      if (!hasAmount) errors.push('Missing amount column (expected: amount, amt, value, debit, credit, etc.)');
      if (!hasDate) errors.push('Missing date column (expected: date, transaction_date, etc.)');
      if (!hasDescription) errors.push('Missing description column (expected: description, desc, narration, etc.)');

      return {
        valid: errors.length === 0,
        errors,
        headers,
        rowCount: lines.length - 1,
      };
    } catch (err) {
      return {
        valid: false,
        errors: [err.message],
      };
    }
  }

  /**
   * Validate transaction object
   * @param {Object} transaction - Transaction object
   * @returns {Object} - Validation result
   */
  static validateTransaction(transaction) {
    const errors = [];

    if (!transaction.date || isNaN(new Date(transaction.date).getTime())) {
      errors.push('Invalid or missing date');
    }

    if (!transaction.description || transaction.description.length === 0) {
      errors.push('Missing description');
    }

    if (!transaction.amount || transaction.amount <= 0 || isNaN(transaction.amount)) {
      errors.push('Invalid amount (must be positive number)');
    }

    if (!['income', 'expense'].includes(transaction.type)) {
      errors.push('Invalid type (must be "income" or "expense")');
    }

    if (!transaction.category) {
      errors.push('Missing category');
    }

    const validCategories = [
      'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Healthcare',
      'Utilities', 'Housing', 'Education', 'Travel', 'Investment', 'Salary',
      'Freelance', 'Business', 'Insurance', 'EMI & Loans', 'Subscriptions',
      'Gifts & Donations', 'Bank Charges', 'Other'
    ];

    if (!validCategories.includes(transaction.category)) {
      errors.push(`Invalid category: ${transaction.category}. Valid categories: ${validCategories.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test category detection regex
   * @param {string} description - Transaction description
   * @param {string} type - Transaction type
   * @returns {string} - Detected category
   */
  static detectCategory(description, type = 'expense') {
    const desc = description.toLowerCase();

    if (type === 'income') {
      if (/salary|payroll|wages|compensation/.test(desc)) return 'Salary';
      if (/freelance|contract|consulting|commission/.test(desc)) return 'Freelance';
      if (/business|revenue|sales|brokerage|reimbursement/.test(desc)) return 'Business';
      if (/interest|dividend|sip|mutual|stock|investment|bonus/.test(desc)) return 'Investment';
      return 'Other';
    }

    if (/food|restaurant|cafe|zomato|swiggy|hotel|meal|dining|burger|pizza/.test(desc)) 
      return 'Food & Dining';
    if (/uber|ola|metro|bus|train|taxi|petrol|fuel|auto|transport|cab|bike/.test(desc)) 
      return 'Transport';
    if (/amazon|flipkart|myntra|shopping|store|mall|ebay|gift|purchase/.test(desc)) 
      return 'Shopping';
    if (/netflix|spotify|movie|entertainment|hotstar|disney|theatre|cinema|game/.test(desc)) 
      return 'Entertainment';
    if (/hospital|doctor|health|clinic|medical|pharma|medicine|healthcare|dental/.test(desc)) 
      return 'Healthcare';
    if (/electric|water|internet|bill|recharge|mobile|wifi|airtel|jio|broadband/.test(desc)) 
      return 'Utilities';
    if (/rent|maintenance|society|apartment|flat|lease|property|landlord/.test(desc)) 
      return 'Housing';
    if (/school|college|education|tuition|course|fee|university|training/.test(desc)) 
      return 'Education';
    if (/flight|travel|trip|vacation|oyo|airbnb|hotel|resort|hostel/.test(desc)) 
      return 'Travel';
    if (/loan|emi|credit card|installment|payment|mortgage|debt/.test(desc)) 
      return 'EMI & Loans';
    if (/insurance|policy|premium|claim|coverage/.test(desc)) 
      return 'Insurance';
    if (/subscription|membership/.test(desc)) 
      return 'Subscriptions';
    if (/gift|donation|charity|contribution|offering/.test(desc)) 
      return 'Gifts & Donations';
    if (/charge|fee|gst|bank|service fee|penalty|interest/.test(desc)) 
      return 'Bank Charges';

    return 'Other';
  }

  /**
   * Validate date format
   * @param {string} dateStr - Date string
   * @returns {Object} - Validation result
   */
  static validateDate(dateStr) {
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      return {
        valid: false,
        error: `Invalid date format: ${dateStr}`,
        suggestedFormats: ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-Mon-YYYY'],
      };
    }

    if (date > new Date()) {
      return {
        valid: false,
        error: 'Date cannot be in the future',
      };
    }

    return { valid: true, date };
  }

  /**
   * Validate amount format
   * @param {string|number} amount - Amount to validate
   * @returns {Object} - Validation result
   */
  static validateAmount(amount) {
    const parsed = parseFloat(amount);

    if (isNaN(parsed) || parsed <= 0) {
      return {
        valid: false,
        error: 'Amount must be a positive number',
      };
    }

    if (parsed > 999999999) {
      return {
        valid: false,
        error: 'Amount is unreasonably large (exceeds 999,999,999)',
      };
    }

    return { 
      valid: true, 
      amount: parsed,
    };
  }

  /**
   * Generate import report
   * @param {Array} transactions - Array of transactions
   * @returns {Object} - Import report
   */
  static generateImportReport(transactions) {
    const report = {
      totalTransactions: transactions.length,
      validTransactions: [],
      invalidTransactions: [],
      categorization: {},
      types: { income: 0, expense: 0 },
      dateRange: null,
      amountStats: {
        total: 0,
        average: 0,
        min: null,
        max: null,
      },
    };

    for (const tx of transactions) {
      const validation = this.validateTransaction(tx);
      
      if (validation.valid) {
        report.validTransactions.push(tx);
        report.types[tx.type] = (report.types[tx.type] || 0) + 1;
        report.categorization[tx.category] = (report.categorization[tx.category] || 0) + 1;
        
        report.amountStats.total += tx.amount;
        if (report.amountStats.min === null || tx.amount < report.amountStats.min) {
          report.amountStats.min = tx.amount;
        }
        if (report.amountStats.max === null || tx.amount > report.amountStats.max) {
          report.amountStats.max = tx.amount;
        }
      } else {
        report.invalidTransactions.push({ ...tx, errors: validation.errors });
      }
    }

    if (report.validTransactions.length > 0) {
      report.amountStats.average = report.amountStats.total / report.validTransactions.length;
      const dates = report.validTransactions.map(t => new Date(t.date)).sort();
      report.dateRange = {
        start: dates[0],
        end: dates[dates.length - 1],
      };
    }

    return report;
  }

  /**
   * Get import health status
   * @param {Object} report - Import report from generateImportReport
   * @returns {Object} - Health status
   */
  static getHealthStatus(report) {
    const validPercentage = (report.validTransactions.length / report.totalTransactions) * 100;
    
    let status = 'excellent';
    if (validPercentage < 90) status = 'good';
    if (validPercentage < 75) status = 'fair';
    if (validPercentage < 50) status = 'poor';

    return {
      status,
      validPercentage: validPercentage.toFixed(2),
      recommendation: this._getRecommendation(status, report),
    };
  }

  static _getRecommendation(status, report) {
    if (status === 'excellent') {
      return 'All transactions are valid and ready to import.';
    }
    if (status === 'good') {
      return `${report.invalidTransactions.length} transaction(s) have issues. Review and fix before importing.`;
    }
    if (status === 'fair') {
      return 'Many transactions have issues. Consider fixing the data format and trying again.';
    }
    return 'Most transactions are invalid. Check file format and structure.';
  }
}

module.exports = ImportValidator;
