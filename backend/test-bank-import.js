/**
 * Bank Statement Import Tests
 * Validates PDF and CSV import functionality
 */

const ImportValidator = require('../utils/importValidator');
const pdfParserService = require('../services/pdfParserService');

describe('Bank Statement Import', () => {
  describe('ImportValidator', () => {
    /**
     * Test transaction validation
     */
    test('validateTransaction - valid transaction', () => {
      const transaction = {
        date: new Date('2024-01-15'),
        description: 'Salary Deposit',
        amount: 50000,
        type: 'income',
        category: 'Salary',
      };

      const result = ImportValidator.validateTransaction(transaction);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('validateTransaction - invalid amount', () => {
      const transaction = {
        date: new Date('2024-01-15'),
        description: 'Test',
        amount: -100,
        type: 'expense',
        category: 'Food & Dining',
      };

      const result = ImportValidator.validateTransaction(transaction);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid amount'))).toBe(true);
    });

    test('validateTransaction - invalid category', () => {
      const transaction = {
        date: new Date('2024-01-15'),
        description: 'Test',
        amount: 100,
        type: 'expense',
        category: 'InvalidCategory',
      };

      const result = ImportValidator.validateTransaction(transaction);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid category'))).toBe(true);
    });

    /**
     * Test category detection
     */
    test('detectCategory - food category', () => {
      const category = ImportValidator.detectCategory('Zomato Food Order', 'expense');
      expect(category).toBe('Food & Dining');
    });

    test('detectCategory - transport category', () => {
      const category = ImportValidator.detectCategory('Uber Ride Payment', 'expense');
      expect(category).toBe('Transport');
    });

    test('detectCategory - income salary', () => {
      const category = ImportValidator.detectCategory('Monthly Salary Deposit', 'income');
      expect(category).toBe('Salary');
    });

    test('detectCategory - default other', () => {
      const category = ImportValidator.detectCategory('Random Expense', 'expense');
      expect(category).toBe('Other');
    });

    /**
     * Test date validation
     */
    test('validateDate - valid date', () => {
      const result = ImportValidator.validateDate('2024-01-15');
      expect(result.valid).toBe(true);
      expect(result.date).toBeDefined();
    });

    test('validateDate - invalid date', () => {
      const result = ImportValidator.validateDate('invalid-date');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('validateDate - future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const result = ImportValidator.validateDate(futureDate.toISOString());
      expect(result.valid).toBe(false);
    });

    /**
     * Test amount validation
     */
    test('validateAmount - valid amount', () => {
      const result = ImportValidator.validateAmount(1234.56);
      expect(result.valid).toBe(true);
      expect(result.amount).toBe(1234.56);
    });

    test('validateAmount - invalid amount', () => {
      const result = ImportValidator.validateAmount(-100);
      expect(result.valid).toBe(false);
    });

    test('validateAmount - string amount', () => {
      const result = ImportValidator.validateAmount('1234.56');
      expect(result.valid).toBe(true);
      expect(result.amount).toBe(1234.56);
    });

    /**
     * Test import report generation
     */
    test('generateImportReport', () => {
      const transactions = [
        {
          date: new Date('2024-01-15'),
          description: 'Salary',
          amount: 50000,
          type: 'income',
          category: 'Salary',
        },
        {
          date: new Date('2024-01-16'),
          description: 'Coffee',
          amount: 250,
          type: 'expense',
          category: 'Food & Dining',
        },
      ];

      const report = ImportValidator.generateImportReport(transactions);
      expect(report.totalTransactions).toBe(2);
      expect(report.validTransactions.length).toBe(2);
      expect(report.invalidTransactions.length).toBe(0);
      expect(report.types.income).toBe(1);
      expect(report.types.expense).toBe(1);
      expect(report.amountStats.total).toBe(50250);
    });

    /**
     * Test health status
     */
    test('getHealthStatus - excellent', () => {
      const report = {
        validTransactions: [1, 2, 3, 4, 5],
        invalidTransactions: [],
        totalTransactions: 5,
      };

      const health = ImportValidator.getHealthStatus(report);
      expect(health.status).toBe('excellent');
      expect(health.validPercentage).toBe('100.00');
    });

    test('getHealthStatus - fair', () => {
      const report = {
        validTransactions: Array(7).fill(1),
        invalidTransactions: Array(3).fill(1),
        totalTransactions: 10,
      };

      const health = ImportValidator.getHealthStatus(report);
      expect(health.status).toBe('fair');
    });
  });

  describe('PDF Parser Service', () => {
    /**
     * Test bank detection
     */
    test('detectBank - HDFC', () => {
      const text = 'HDFC Bank Limited Statement';
      const bank = pdfParserService.detectBank(text);
      expect(bank).toBe('Hdfc');
    });

    test('detectBank - ICICI', () => {
      const text = 'ICICI Bank Statement';
      const bank = pdfParserService.detectBank(text);
      expect(bank).toBe('Icici');
    });

    /**
     * Test date parsing
     */
    test('parseDate - DD/MM/YYYY', () => {
      const date = pdfParserService.parseDate('15/03/2024');
      expect(date).not.toBeNull();
      expect(date.getDate()).toBe(15);
      expect(date.getMonth()).toBe(2);
      expect(date.getFullYear()).toBe(2024);
    });

    test('parseDate - YYYY-MM-DD', () => {
      const date = pdfParserService.parseDate('2024-03-15');
      expect(date).not.toBeNull();
      expect(date.getDate()).toBe(15);
      expect(date.getMonth()).toBe(2);
      expect(date.getFullYear()).toBe(2024);
    });

    test('parseDate - DD-Mon-YYYY', () => {
      const date = pdfParserService.parseDate('15 Mar 2024');
      expect(date).not.toBeNull();
      expect(date.getDate()).toBe(15);
      expect(date.getMonth()).toBe(2);
      expect(date.getFullYear()).toBe(2024);
    });

    /**
     * Test amount parsing
     */
    test('parseAmount - with CR marker', () => {
      const result = pdfParserService.parseAmountToken('1234.56 CR');
      expect(result.value).toBe(1234.56);
      expect(result.marker).toBe('CR');
    });

    test('parseAmount - with DR marker', () => {
      const result = pdfParserService.parseAmountToken('1234.56 DR');
      expect(result.value).toBe(1234.56);
      expect(result.marker).toBe('DR');
    });

    test('parseAmount - with parentheses', () => {
      const result = pdfParserService.parseAmountToken('(1234.56)');
      expect(result.value).toBe(1234.56);
    });

    /**
     * Test transaction type detection
     */
    test('determineTransactionType - credit keyword', () => {
      const type = pdfParserService.determineTransactionType('Salary Credit');
      expect(type).toBe('income');
    });

    test('determineTransactionType - debit keyword', () => {
      const type = pdfParserService.determineTransactionType('Purchase Debit');
      expect(type).toBe('expense');
    });

    /**
     * Test statement format detection
     */
    test('detectStatementFormat - returns valid format object', () => {
      const text = 'Date Description Debit Credit Balance\\n15/03/2024 Deposit 0 5000 5000';
      const format = pdfParserService.detectStatementFormat(text);
      expect(format).toHaveProperty('bank');
      expect(format).toHaveProperty('format');
      expect(format).toHaveProperty('hasRunningBalance');
      expect(format).toHaveProperty('dateFormat');
      expect(format).toHaveProperty('confidence');
    });

    /**
     * Test category detection
     */
    test('categorizeTransaction - food expense', () => {
      const category = pdfParserService.categorizeTransaction('Zomato Food Delivery', 'expense');
      expect(category).toBe('Food & Dining');
    });

    test('categorizeTransaction - salary income', () => {
      const category = pdfParserService.categorizeTransaction('Salary Deposit', 'income');
      expect(category).toBe('Salary');
    });
  });

  describe('Transaction Categorization', () => {
    const testCases = [
      { desc: 'Starbucks Coffee', type: 'expense', expected: 'Food & Dining' },
      { desc: 'Uber to Airport', type: 'expense', expected: 'Transport' },
      { desc: 'Amazon Books', type: 'expense', expected: 'Shopping' },
      { desc: 'Netflix Subscription', type: 'expense', expected: 'Entertainment' },
      { desc: 'Hospital Charges', type: 'expense', expected: 'Healthcare' },
      { desc: 'Electricity Bill', type: 'expense', expected: 'Utilities' },
      { desc: 'Rent Payment', type: 'expense', expected: 'Housing' },
      { desc: 'School Fees', type: 'expense', expected: 'Education' },
      { desc: 'Flight Ticket', type: 'expense', expected: 'Travel' },
      { desc: 'Monthly Salary', type: 'income', expected: 'Salary' },
      { desc: 'Freelance Project', type: 'income', expected: 'Freelance' },
      { desc: 'Insurance Premium', type: 'expense', expected: 'Insurance' },
      { desc: 'Loan EMI', type: 'expense', expected: 'EMI & Loans' },
    ];

    testCases.forEach(({ desc, type, expected }) => {
      test(`categorize '${desc}' as ${expected}`, () => {
        const category = pdfParserService.categorizeTransaction(desc, type);
        expect(category).toBe(expected);
      });
    });
  });
});

/**
 * Integration test example
 */
describe('Import Integration', () => {
  test('full import workflow simulation', async () => {
    const mockTransactions = [
      {
        date: new Date('2024-01-15'),
        description: 'Salary Deposit',
        amount: 50000,
        type: 'income',
        category: 'Salary',
      },
      {
        date: new Date('2024-01-16'),
        description: 'Zomato Food Order',
        amount: 500,
        type: 'expense',
        category: 'Food & Dining',
      },
    ];

    // Validate all transactions
    const allValid = mockTransactions.every(tx => {
      const result = ImportValidator.validateTransaction(tx);
      return result.valid;
    });

    expect(allValid).toBe(true);

    // Generate report
    const report = ImportValidator.generateImportReport(mockTransactions);
    expect(report.validTransactions.length).toBe(2);
    expect(report.totalTransactions).toBe(2);

    // Check health
    const health = ImportValidator.getHealthStatus(report);
    expect(health.status).toBe('excellent');
  });
});
