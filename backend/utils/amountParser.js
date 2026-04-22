/**
 * Amount Parser Utility
 * Handles various amount formats from bank statements:
 * - Currency symbols (₹, $, €, £)
 * - Different number formats (US, European, Indian)
 * - Negative amounts (-100 CR, (100),/DR)
 * - Credit/Debit indicators
 column name variations
 * - Various */

/**
 * Parse a string value to extract a monetary amount
 * @param {string} value - The raw string value to parse
 * @param {Object} options - Parsing options
 * @returns {Object} - { amount: number, isNegative: boolean, confidence: number }
 */
function parseAmount(value, options = {}) {
  const {
    allowNegative = true,
    preferPositive = false,
    defaultValue = null,
    validateRange = false  // Only validate range if explicitly enabled (for receipt scanning)
  } = options;

  if (!value || typeof value !== 'string') {
    // Handle non-string values (numbers, etc.)
    if (typeof value === 'number' && !isNaN(value)) {
      return { amount: Math.abs(value), isNegative: value < 0, confidence: 1 };
    }
    return { amount: defaultValue, isNegative: false, confidence: 0 };
  }

  let str = value.toString().trim();
  
  if (str.length === 0) {
    return { amount: defaultValue, isNegative: false, confidence: 0 };
  }

  // Remove currency symbols and common prefixes FIRST
  str = str.replace(/^[\₹$€£¥]\s*/, '');  // Currency prefix
  str = str.replace(/^USD\s*/i, '');
  str = str.replace(/^EUR\s*/i, '');
  str = str.replace(/^GBP\s*/i, '');
  str = str.replace(/^INR\s*/i, '');

  // Detect if amount is negative (AFTER currency removal)
  let isNegative = false;
  let negativeReason = null;

  // Check for parentheses (100) = -100
  if (/^\(.*\)$/.test(str)) {
    isNegative = true;
    negativeReason = 'parentheses';
    str = str.slice(1, -1); // Remove parentheses
  }
  // Check for minus sign prefix (now catches ₹-500 correctly)
  else if (/^-\s*[\d,.]/.test(str)) {
    isNegative = true;
    negativeReason = 'minus';
    str = str.replace(/^-\s*/, '');
  }
  // Check for CR suffix (credit)
  else if (/\bCR\b$/i.test(str) || /\bC\b$/i.test(str)) {
    isNegative = false;
    negativeReason = 'credit';
    str = str.replace(/\s*(CR|C)$/i, '');
  }
  // Check for DR suffix (debit)
  else if (/\bDR\b$/i.test(str)) {
    isNegative = true;
    negativeReason = 'debit';
    str = str.replace(/\s*DR$/i, '');
  }

  // Detect number format
  const format = detectNumberFormat(str);
  
  let amount = null;
  
  switch (format) {
    case 'indian':
      amount = parseIndianNumber(str);
      break;
    case 'european':
      amount = parseEuropeanNumber(str);
      break;
    case 'us_standard':
      amount = parseUSNumber(str);
      break;
    default:
      // Try to parse anyway
      amount = parseFloat(str.replace(/[^\d.-]/g, ''));
  }

  // Handle invalid parsing
  if (isNaN(amount) || amount === null) {
    return { amount: defaultValue, isNegative: false, confidence: 0 };
  }

  // Validate amount range only if explicitly enabled (for receipt scanning)
  if (validateRange) {
    const validationResult = validateAmountRange(amount, format);
    if (!validationResult.valid) {
      return { amount: defaultValue, isNegative: false, confidence: 0, error: validationResult.reason };
    }
  }

  // Apply negative sign if detected from format
  if (!isNegative && preferPositive && negativeReason === 'debit') {
    isNegative = true;
  }

  // Calculate confidence based on parsing quality
  let confidence = 1;
  if (format === 'unknown') confidence = 0.5;
  if (str.includes(' ')) confidence *= 0.9;  // Extra spaces reduce confidence

  return {
    amount: Math.abs(amount),
    isNegative: isNegative,
    confidence: confidence
  };
}

/**
 * Detect the number format from a string
 * @param {string} str - The number string
 * @returns {string} - Format type: 'indian', 'european', 'us_standard', 'unknown'
 */
function detectNumberFormat(str) {
  // Clean the string for analysis
  const clean = str.replace(/[^\d,.]/g, '');
  
  // Indian format: 1,00,000 or 10,00,000 or 1,00,00,000
  // Pattern: 1-2 digits, then pairs of 2 digits separated by commas, then 3 digits
  // Examples: 1,00,000 | 10,00,000 | 1,23,45,678 | 1,00,000.50
  if (/^\d{1,2}(,\d{2})*,\d{3}(\.\d+)?$/.test(clean)) {
    return 'indian';
  }
  
  // European format: 1.234,56 (period for thousands, comma for decimals)
  // Examples: 1.234,56 | 12.345,67 | 123.456,78
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(clean)) {
    return 'european';
  }
  
  // US/UK format: 1,234.56 (comma for thousands, period for decimals)
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(clean)) {
    return 'us_standard';
  }

  // Simple number with just commas (ambiguous - assume US)
  if (/^\d{1,3}(,\d{3})+$/.test(clean)) {
    return 'us_standard';
  }

  // Simple number with optional decimals (e.g., "850", "1200.50")
  if (/^\d+(\.\d+)?$/.test(clean)) {
    return 'us_standard';
  }

  return 'unknown';
}

/**
 * Validate that amount is in realistic range
 * Catches OCR errors like ₹43210 (misread for ₹300)
 * @param {number} amount - The parsed amount
 * @param {string} format - The detected number format
 * @returns {Object} - { valid: boolean, reason?: string }
 */
function validateAmountRange(amount, format) {
  // Maximum reasonable amounts by format
  // Indian: up to 1 crore (100,000,000) for business transactions
  // Other formats: up to 10 million for bank transactions
  const maxAmount = format === 'indian' ? 100000000 : 10000000;
  const minAmount = 0.01; // At least 1 paise/cent

  if (amount < minAmount) {
    return { valid: false, reason: 'Amount too small' };
  }

  if (amount > maxAmount) {
    return { valid: false, reason: `Amount exceeds ${maxAmount} (likely OCR error)` };
  }

  // Detect suspicious OCR patterns in Indian context
  // Pattern: 5 or 6 digit numbers starting with 4-5 are often OCR errors of 3-digit amounts
  if (format === 'indian' && /^[45]\d{4}$/.test(Math.round(amount).toString())) {
    // Additional check: if it ends in suspicious digits, likely OCR error
    const str = Math.round(amount).toString();
    if (/[01]{2,}$/.test(str)) {  // Ends with multiple 0s or 1s
      return { valid: false, reason: 'Suspicious OCR pattern detected (e.g., 43210 for 300)' };
    }
  }

  return { valid: true };
}

/**
 * Parse Indian number format (lakh/crore system)
 * Examples: 1,00,000 | 10,50,000.50 | 1,23,45,678
 */
function parseIndianNumber(str) {
  // Remove all commas and parse
  const clean = str.replace(/,/g, '');
  return parseFloat(clean);
}

/**
 * Parse European number format
 * Examples: 1.234,56 | 12.345,67
 */
function parseEuropeanNumber(str) {
  // Remove thousand separators (.) and replace decimal comma (,) with period
  const clean = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean);
}

/**
 * Parse US/UK number format
 * Examples: 1,234.56 | 1,000.00
 */
function parseUSNumber(str) {
  // Remove commas
  const clean = str.replace(/,/g, '');
  return parseFloat(clean);
}

/**
 * Find all amounts in a line of text
 * @param {string} line - The text line to search
 * @param {Object} options - Parsing options
 * @returns {Array} - Array of { value, isNegative, index, priority }
 */
function findAmounts(line, options = {}) {
  const {
    prioritizeAfterDate = false,
    dateEndIndex = -1
  } = options;

  if (!line || typeof line !== 'string') {
    return [];
  }

  const results = [];
  
  // Clean line for processing (but keep track of original indices)
  const cleanLine = line.replace(/[\₹$€£¥]/g, ' ');

  // Pattern 1: Amounts with exactly 2 decimal places (high confidence)
  // Includes: 1,234.56 | 1234.56 | ₹1,234.56 | 1.234,56 (European)
  const decimalPatterns = [
    // US/UK format: 1,234.56 or 1234.56
    { 
      regex: /\b(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\b/g,
      parser: (m) => parseFloat(m.replace(/,/g, '')),
      priority: 1,
      format: 'us'
    },
    // European format: 1.234,56 or 12.345,67
    { 
      regex: /\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/g,
      parser: (m) => parseFloat(m.replace(/\./g, '').replace(',', '.')),
      priority: 1,
      format: 'european'
    },
    // Indian format: 1,00,000.00 or 10,00,000.00
    { 
      regex: /\b(\d{1,2}(?:,\d{2})+\d{3}(?:\.\d{2}))\b/g,
      parser: (m) => parseFloat(m.replace(/,/g, '')),
      priority: 1,
      format: 'indian'
    }
  ];

  // Pattern 2: Negative amounts with parentheses: (100.00)
  const negParenPattern = /\((\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}?)?)\)/g;
  let match;
  while ((match = negParenPattern.exec(cleanLine)) !== null) {
    const val = parseAmount(match[1]).amount;
    if (!isNaN(val) && val > 0) {
      results.push({
        value: val,
        isNegative: true,
        index: match.index,
        priority: 1
      });
    }
  }

  // Pattern 3: Negative amounts with minus: -100.00
  const negMinusPattern = /-\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}?)?)/g;
  while ((match = negMinusPattern.exec(cleanLine)) !== null) {
    const val = parseAmount(match[1]).amount;
    if (!isNaN(val) && val > 0) {
      results.push({
        value: val,
        isNegative: true,
        index: match.index,
        priority: 1
      });
    }
  }

  // Pattern 4: Decimal amounts (run patterns)
  for (const pattern of decimalPatterns) {
    const regex = new RegExp(pattern.regex.source, 'g');
    while ((match = regex.exec(cleanLine)) !== null) {
      const val = pattern.parser(match[1]);
      if (!isNaN(val) && val > 0) {
        // Check if this is already captured by negative patterns
        const isAlreadyNegative = results.some(r => 
          r.index === match.index && r.isNegative
        );
        if (!isAlreadyNegative) {
          results.push({
            value: val,
            isNegative: false,
            index: match.index,
            priority: pattern.priority
          });
        }
      }
    }
  }

  // Pattern 5: Integer amounts (lower priority - avoid reference numbers)
  // Only match integers that aren't likely to be dates, years, or reference numbers
  const intPattern = /\b([1-9]\d{0,8})\b/g;  // 1-9 digits, no leading zero
  while ((match = intPattern.exec(cleanLine)) !== null) {
    const val = parseInt(match[1], 10);
    
    // Skip if this is likely a year (1900-2100)
    if (val >= 1900 && val <= 2100) continue;
    
    // Skip if this is likely a date component
    if (val >= 1 && val <= 31) continue;
    
    // Skip if this is likely a month
    if (val >= 1 && val <= 12) continue;
    
    // Skip if this amount is already found as decimal
    const alreadyFound = results.some(r => 
      Math.abs(r.value - val) < 0.01 || 
      (r.index <= match.index && r.index + 10 >= match.index)
    );
    
    if (!alreadyFound && val > 0) {
      results.push({
        value: val,
        isNegative: false,
        index: match.index,
        priority: 3  // Lower priority
      });
    }
  }

  // Filter results based on position relative to date
  if (prioritizeAfterDate && dateEndIndex >= 0) {
    // Filter to amounts after the date
    const afterDate = results.filter(r => r.index > dateEndIndex);
    if (afterDate.length > 0) {
      return afterDate.sort((a, b) => a.priority - b.priority || a.index - b.index);
    }
  }

  // Sort by priority (lower is better) then by index
  return results.sort((a, b) => a.priority - b.priority || a.index - b.index);
}

/**
 * Detect transaction type based on amount sign and context
 * @param {number} amount - The parsed amount
 * @param {string} context - Additional context text
 * @param {Object} options - Options for type detection
 * @returns {string} - 'income' or 'expense'
 */
function determineTransactionType(amount, context, options = {}) {
  const { isNegative } = options;
  
  // First, check context keywords
  const lowerContext = context.toLowerCase();
  
  const creditKeywords = [
    'credit', 'deposit', 'received', 'transfer in', 'upi credit', 
    'salary', 'refund', 'interest', 'cr', 'credited', 'by', 
    'neft credit', 'rtgs credit', 'imps credit', 'wallet credit'
  ];
  
  const debitKeywords = [
    'debit', 'withdrawal', 'payment', 'transfer out', 'upi debit', 
    'purchase', ' deduction', 'dr', 'debited', 'to', 
    'neft debit', 'rtgs debit', 'imps debit', 'bank charge', 
    'fee', 'charges', 'paid', 'purchase'
  ];

  for (const keyword of creditKeywords) {
    if (lowerContext.includes(keyword)) {
      return 'income';
    }
  }

  for (const keyword of debitKeywords) {
    if (lowerContext.includes(keyword)) {
      return 'expense';
    }
  }

  // If no keywords found, use sign information
  if (isNegative !== undefined) {
    return isNegative ? 'expense' : 'income';
  }

  // Default: assume expense (more common in bank statements)
  return 'expense';
}

/**
 * Detect if amount column exists and find its column name
 * @param {Object} row - CSV row object
 * @returns {string|null} - Column name or null
 */
function detectAmountColumn(row) {
  const possibleColumnNames = [
    'amount', 'amt', 'value', 'transaction_amount', 'txn_amount',
    'debit', 'credit', 'dr', 'cr', 'withdrawal', 'deposit',
    'transaction_value', 'total', 'sum', 'price', 'cost'
  ];
  
  // Also check for variations with _in _out suffixes
  const allPossibleNames = [
    ...possibleColumnNames,
    'amount_in', 'amount_out', 'amt_in', 'amt_out',
    'debit_amount', 'credit_amount', 'dr_amount', 'cr_amount'
  ];
  
  for (const name of allPossibleNames) {
    // Check exact match (case insensitive)
    const lowerRow = {};
    for (const key of Object.keys(row)) {
      lowerRow[key.toLowerCase()] = key;
    }
    
    if (lowerRow[name]) {
      return lowerRow[name];
    }
    
    // Also check if the key contains the name
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes(name) && key.toLowerCase() !== 'balance') {
        return key;
      }
    }
  }
  
  return null;
}

/**
 * Parse date strings in various formats
 * Supports: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, DD-Mon-YYYY
 * @param {string} dateStr - The date string to parse
 * @returns {Date|null} - Parsed Date object or null
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str) return null;

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in Indian/European formats)
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1]);
    const month = parseInt(ddmmyyyy[2]);
    const year = parseInt(ddmmyyyy[3]);
    // If day > 12, it must be DD/MM/YYYY
    if (day > 12) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
    // If month > 12, it must be MM/DD/YYYY
    if (month > 12) {
      const d = new Date(year, day - 1, month);
      if (!isNaN(d.getTime())) return d;
    }
    // Ambiguous — default to DD/MM/YYYY
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) return d;
  }

  // DD-Mon-YYYY (e.g., 15-Jan-2024)
  const monthNames = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const ddmonyyyy = str.match(/^(\d{1,2})[\/\-\s](\w{3})[\/\-\s](\d{4})$/i);
  if (ddmonyyyy) {
    const day = parseInt(ddmonyyyy[1]);
    const monthIdx = monthNames[ddmonyyyy[2].toLowerCase()];
    const year = parseInt(ddmonyyyy[3]);
    if (monthIdx !== undefined) {
      const d = new Date(year, monthIdx, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Fallback to native Date parsing
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

/**
 * Parse a complete CSV row with amount and type detection
 * @param {Object} row - CSV row
 * @param {Object} columnMapping - Optional mapping of column names
 * @returns {Object} - Parsed transaction object
 */
function parseCSVRow(row, columnMapping = {}) {
  const result = {
    amount: null,
    type: 'expense',
    description: '',
    date: null,
    category: 'Other',
    paymentMethod: 'other',
    confidence: 0
  };

  // Get all keys in lowercase for case-insensitive matching
  const lowerRow = {};
  for (const key of Object.keys(row)) {
    lowerRow[key.toLowerCase()] = { original: key, value: row[key] };
  }

  // Find and parse amount
  const amountColumn = columnMapping.amount || detectAmountColumn(row);
  if (amountColumn) {
    const amountData = parseAmount(row[amountColumn] || row[amountColumn.toLowerCase()]);
    result.amount = amountData.amount;
    
    // Determine type based on amount sign or column name
    if (amountData.isNegative) {
      result.type = 'expense';
    } else if (amountColumn.toLowerCase().includes('credit') || 
               amountColumn.toLowerCase().includes('cr') ||
               amountColumn.toLowerCase().includes('deposit') ||
               amountColumn.toLowerCase().includes('income')) {
      result.type = 'income';
    } else if (amountColumn.toLowerCase().includes('debit') || 
               amountColumn.toLowerCase().includes('dr') ||
               amountColumn.toLowerCase().includes('withdrawal')) {
      result.type = 'expense';
    }
    result.confidence = amountData.confidence;
  }

  // Find description
  const descColumn = columnMapping.description || 
    lowerRow['description']?.original ||
    lowerRow['desc']?.original ||
    lowerRow['narration']?.original ||
    lowerRow['details']?.original ||
    lowerRow['transaction description']?.original;
  
  if (descColumn) {
    result.description = row[descColumn] || '';
  } else {
    // Try to find any remaining column that might be description
    for (const key of Object.keys(row)) {
      const lower = key.toLowerCase();
      if (!['amount', 'amt', 'date', 'type', 'category', 'paymentmethod', 'balance'].includes(lower)) {
        if (row[key] && row[key].toString().length > result.description.length) {
          result.description = row[key].toString();
        }
      }
    }
  }

  // Find date
  const dateColumn = columnMapping.date ||
    lowerRow['date']?.original ||
    lowerRow['transaction date']?.original ||
    lowerRow['transaction_date']?.original ||
    lowerRow['txn date']?.original ||
    lowerRow['txn_date']?.original ||
    lowerRow['posting date']?.original ||
    lowerRow['posting_date']?.original;
  
  if (dateColumn && row[dateColumn]) {
    const parsed = parseDate(row[dateColumn]);
    if (parsed && !isNaN(parsed.getTime())) {
      result.date = parsed;
    }
  }

  if (!result.date) {
    result.date = new Date();
  }

  // Find category
  const categoryColumn = columnMapping.category ||
    lowerRow['category']?.original ||
    lowerRow['cat']?.original;
  
  if (categoryColumn && row[categoryColumn]) {
    result.category = row[categoryColumn];
  }

  // Find payment method
  const paymentColumn = columnMapping.paymentmethod || columnMapping['paymentMethod'] ||
    lowerRow['paymentmethod']?.original ||
    lowerRow['payment_method']?.original ||
    lowerRow['payment method']?.original ||
    lowerRow['mode']?.original;

  if (paymentColumn && row[paymentColumn]) {
    result.paymentMethod = row[paymentColumn].toLowerCase();
  }

  // Find type if explicitly provided
  const typeColumn = columnMapping.type ||
    lowerRow['type']?.original ||
    lowerRow['transaction type']?.original;
  
  if (typeColumn && row[typeColumn]) {
    const typeVal = row[typeColumn].toString().toLowerCase();
    if (typeVal.includes('income') || typeVal.includes('credit') || typeVal.includes('cr')) {
      result.type = 'income';
    } else if (typeVal.includes('expense') || typeVal.includes('debit') || typeVal.includes('dr')) {
      result.type = 'expense';
    }
  }

  // Handle separate debit/credit columns
  const debitColumn = lowerRow['debit']?.original || lowerRow['dr']?.original;
  const creditColumn = lowerRow['credit']?.original || lowerRow['cr']?.original;
  
  if (debitColumn && creditColumn) {
    const debitVal = parseAmount(row[debitColumn]);
    const creditVal = parseAmount(row[creditColumn]);
    
    if (creditVal.amount && creditVal.amount > 0) {
      result.amount = creditVal.amount;
      result.type = 'income';
      result.confidence = Math.max(result.confidence, creditVal.confidence);
    } else if (debitVal.amount && debitVal.amount > 0) {
      result.amount = debitVal.amount;
      result.type = 'expense';
      result.confidence = Math.max(result.confidence, debitVal.confidence);
    }
  }

  return result;
}

module.exports = {
  parseAmount,
  findAmounts,
  determineTransactionType,
  detectAmountColumn,
  parseCSVRow,
  parseDate,
  detectNumberFormat,
  validateAmountRange,
  parseIndianNumber,
  parseEuropeanNumber,
  parseUSNumber
};
