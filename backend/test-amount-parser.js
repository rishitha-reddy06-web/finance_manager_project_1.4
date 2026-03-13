/**
 * Test script for Amount Parser Utility
 */
const amountParser = require('./utils/amountParser');

console.log('='.repeat(60));
console.log('AMOUNT PARSER TEST SUITE');
console.log('='.repeat(60));

// Test 1: Basic amount parsing
console.log('\n--- Test 1: Basic Amount Parsing ---');
const basicTests = [
  { input: '100', expected: 100 },
  { input: '100.50', expected: 100.50 },
  { input: '1,000', expected: 1000 },
  { input: '1,000.00', expected: 1000 },
  { input: '1,234,567.89', expected: 1234567.89 },
];

basicTests.forEach(test => {
  const result = amountParser.parseAmount(test.input);
  const passed = Math.abs(result.amount - test.expected) < 0.01;
  console.log(`  "${test.input}" => ${result.amount} (expected: ${test.expected}) ${passed ? '✓' : '✗'}`);
});

// Test 2: Currency symbols
console.log('\n--- Test 2: Currency Symbols ---');
const currencyTests = [
  { input: '₹100', expected: 100 },
  { input: '$1,000.00', expected: 1000 },
  { input: '€50.25', expected: 50.25 },
  { input: '£100.00', expected: 100 },
];

currencyTests.forEach(test => {
  const result = amountParser.parseAmount(test.input);
  const passed = Math.abs(result.amount - test.expected) < 0.01;
  console.log(`  "${test.input}" => ${result.amount} (expected: ${test.expected}) ${passed ? '✓' : '✗'}`);
});

// Test 3: Indian number format (lakh/crore)
console.log('\n--- Test 3: Indian Number Format ---');
const indianTests = [
  { input: '1,00,000', expected: 100000 },
  { input: '10,00,000', expected: 1000000 },
  { input: '1,00,000.50', expected: 100000.50 },
  { input: '1,23,45,678', expected: 12345678 },
];

indianTests.forEach(test => {
  const result = amountParser.parseAmount(test.input);
  const passed = Math.abs(result.amount - test.expected) < 0.01;
  console.log(`  "${test.input}" => ${result.amount} (expected: ${test.expected}) ${passed ? '✓' : '✗'}`);
});

// Test 4: European number format
console.log('\n--- Test 4: European Number Format ---');
const europeanTests = [
  { input: '1.234,56', expected: 1234.56 },
  { input: '12.345,67', expected: 12345.67 },
  { input: '1.000,00', expected: 1000 },
];

europeanTests.forEach(test => {
  const result = amountParser.parseAmount(test.input);
  const passed = Math.abs(result.amount - test.expected) < 0.01;
  console.log(`  "${test.input}" => ${result.amount} (expected: ${test.expected}) ${passed ? '✓' : '✗'}`);
});

// Test 5: Negative amounts
console.log('\n--- Test 5: Negative Amounts ---');
const negativeTests = [
  { input: '-100', expected: 100, isNegative: true },
  { input: '(100.00)', expected: 100, isNegative: true },
  { input: '₹-500', expected: 500, isNegative: true },
  { input: '1,000 CR', expected: 1000, isNegative: false },
  { input: '500 DR', expected: 500, isNegative: true },
];

negativeTests.forEach(test => {
  const result = amountParser.parseAmount(test.input);
  const passed = Math.abs(result.amount - test.expected) < 0.01 && result.isNegative === test.isNegative;
  console.log(`  "${test.input}" => ${result.amount} (neg: ${result.isNegative}) expected: ${test.expected} (neg: ${test.isNegative}) ${passed ? '✓' : '✗'}`);
});

// Test 6: CSV Row Parsing
console.log('\n--- Test 6: CSV Row Parsing ---');
const csvRowTests = [
  {
    row: { type: 'expense', amount: '₹500', description: 'Grocery', date: '2025-01-15' },
    expected: { amount: 500, type: 'expense' }
  },
  {
    row: { 'Amount': '1000', 'Description': 'Salary', 'Type': 'income' },
    expected: { amount: 1000, type: 'income' }
  },
  {
    row: { debit: '200', credit: '', description: 'Shopping', date: '2025-01-10' },
    expected: { amount: 200, type: 'expense' }
  },
  {
    row: { debit: '', credit: '5000', description: 'Salary', date: '2025-01-01' },
    expected: { amount: 5000, type: 'income' }
  },
  {
    row: { 'Transaction Amount': '250.50', 'Details': 'Amazon Purchase', 'Date': '2025-01-05' },
    expected: { amount: 250.50, type: 'expense' }
  },
];

csvRowTests.forEach(test => {
  const result = amountParser.parseCSVRow(test.row);
  const amountMatch = Math.abs(result.amount - test.expected.amount) < 0.01;
  const typeMatch = result.type === test.expected.type;
  const passed = amountMatch && typeMatch;
  console.log(`  Row: ${JSON.stringify(test.row)}`);
  console.log(`    => amount: ${result.amount}, type: ${result.type} ${passed ? '✓' : '✗'}`);
});

// Test 7: findAmounts in text line
console.log('\n--- Test 7: findAmounts in Text ---');
const lineTests = [
  { 
    line: '15/05/2023 Amazon Purchase 1,200.50', 
    expected: 1200.50 
  },
  { 
    line: '16/05/2023 Salary 50,000.00 C 1,50,000.00',  // 50,000 is amount, 1,50,000 is balance
    expected: 50000 
  },
  { 
    line: '20/05/2023 Netflix 199.00', 
    expected: 199 
  },
  { 
    line: '25/05/2023 UPI Payment (500.00)', 
    expected: 500 
  },
];

lineTests.forEach(test => {
  const amounts = amountParser.findAmounts(test.line);
  if (amounts.length > 0) {
    const passed = Math.abs(amounts[0].value - test.expected) < 0.01;
    console.log(`  "${test.line}" => ${amounts[0].value} (expected: ${test.expected}) ${passed ? '✓' : '✗'}`);
  } else {
    console.log(`  "${test.line}" => NO AMOUNT FOUND ${'✗'}`);
  }
});

// Test 8: Column Detection
console.log('\n--- Test 8: Column Detection ---');
const columnTests = [
  { 
    row: { amount: '100', description: 'Test' }, 
    expected: 'amount' 
  },
  { 
    row: { amt: '100', description: 'Test' }, 
    expected: 'amt' 
  },
  { 
    row: { txn_amount: '100', description: 'Test' }, 
    expected: 'txn_amount' 
  },
  { 
    row: { debit: '100', credit: '0', description: 'Test' }, 
    expected: 'debit' 
  },
];

columnTests.forEach(test => {
  const detected = amountParser.detectAmountColumn(test.row);
  const passed = detected === test.expected;
  console.log(`  "${test.expected}" => detected: ${detected} ${passed ? '✓' : '✗'}`);
});

console.log('\n' + '='.repeat(60));
console.log('TEST SUITE COMPLETE');
console.log('='.repeat(60));
