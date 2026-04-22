/**
 * Improved Receipt Parser with Advanced Heuristics
 * Fixes issues with:
 * - Multiple item detection
 * - Distinguishing item amounts from totals
 * - Better number extraction
 */

const indianParser = require('./indianReceiptParser');

/**
 * Detect if a line is a total/summary line (STRENGTHENED TO CATCH MORE METADATA)
 * @param {string} line - Receipt line
 * @returns {boolean}
 */
function isTotalLine(line) {
  const totalPatterns = [
    // Amount/Total patterns
    /\b(subtotal|sub.?total|amount payable|total|grand total|balance due|net amount|total amount)\b/i,
    // Payment patterns
    /\b(cash|paid|change|received|amount paid)\b/i,
    /^\s*(visa|mastercard|amex|upi|check|cheque|card|payment|method|debit|credit)/i,
    // Tax patterns
    /\b(tax|gst|sgst|cgst|igst|tax included|inclusive|taxable)\b/i,
    // Time/Date patterns
    /\b(time|date|receipt|invoice|receipt no|bill no|transaction)\b/i,
    // Store/Address patterns
    /\b(address|store|location|phone|contact|website|thank you|welcome)\b/i,
    // Section breaks
    /\*{3,}|={3,}|\-{5,}/, // Multiple special chars indicate section break
    // Metadata that appears alone
    /^\s*(Thank you|Thank You|Welcome|WELCOME|Your order|Order|GST|Receipt #|Items Purchased|Subtotal|TOTAL AMOUNT)/i
  ];

  return totalPatterns.some(pattern => pattern.test(line));
}

/**
 * Detect if a line is metadata/contact info (phone numbers, addresses, etc.)
 * These should NOT be extracted as items
 * @param {string} line - Receipt line
 * @returns {boolean} - True if this is metadata
 */
function isMetadataLine(line) {
  if (!line || line.length < 2) return false;
  
  const metadataPatterns = [
    // Phone numbers in various formats (including corrupted OCR)
    /^[\s]*\+?[\d\s\-().]{10,}$/,  // Phone format: +91 987654 3210
    /Phone[\s:]*[\+\d\s\-().]+$/i,  // "Phone: +91..."
    /Contact[\s:]*[\+\d\s\-().]+$/i,  // "Contact: +91..."
    /Tel[\s:]*[\+\d\s\-().]+$/i,  // "Tel: +91..."
    /Mobile[\s:]*[\+\d\s\-().]+$/i,  // "Mobile: +91..."
    
    // Phone-like patterns (corrupted or partial)
    /\+91[\s\d]{6,}/i,  // +91 followed by digits
    /^[\s]*[+]?[\d]{10}[\s]*$/,  // 10-digit phone number alone
    /^[\s]*[+]?[\d\s-]{12,}$/,  // Long digit sequences (phone numbers)
    
    // Email addresses
    /[\w\.-]+@[\w\.-]+\.\w+/,  // user@domain.com
    
    // Website URLs
    /https?:\/\/|www\./i,
    
    // Address patterns
    /^[\s]*\d+[\s,]*[A-Z][a-z\s]+St(?:reet)?[\s,]*/i,  // "123 Main Street"
    /^[\s]*Street|Road|Avenue|Boulevard|Lane|Drive|Court|Plaza/i,
    /PIN[\s:]*\d{4,6}/i,  // Postal code
    /Zip[\s:]*\d{5}/i,  // ZIP code
    
    // Store metadata
    /^Store[\s#:]*\d+/i,  // "Store #123"
    /Manager|Cashier|Associate/i,  // Staff info
  ];
  
  return metadataPatterns.some(pattern => pattern.test(line.trim()));
}

/**
 * Clean OCR noise from text
 * @param {string} text - Text with OCR errors
 * @returns {string} - Cleaned text
 */
function cleanOCRNoise(text) {
  let cleaned = text;

  // Fix common OCR substitutions
  const substitutions = {
    '|': 'l',      // Pipe to letter L
    '0': 'O',      // Zero to O in some contexts
    'S': '5',      // S to 5
    'I': '1',      // I to 1
    '`': "'",      // Backtick to apostrophe
    'ï»¿': '',        // Remove BOM
  };

  // These are aggressive - only replace if confident
  // Keep commented unless needed
  // for (const [wrong, right] of Object.entries(substitutions)) {
  //   cleaned = cleaned.replace(new RegExp(wrong, 'g'), right);
  // }

  // FIX COMMON INDIAN OCR MISREADINGS
  // These are specific to Indian receipt text and Tesseract errors
  const indianOCRFixes = [
    [/TE Ricel/gi, 'Rice'],        // "TE Ricel" → "Rice"
    [/Ricel\(/gi, 'Rice ('],       // "Ricel(" → "Rice("
    [/Milki/gi, 'Milk'],           // "Milki" → "Milk"
    [/Lit8ns/gi, 'Liters'],        // "Lit8ns" → "Liters"
    [/\(2ipes\)/gi, '(2 pcs)'],   // "(2ipes)" → "(2 pcs)"
    [/weit:/gi, ''],               // Remove corrupted "weit:"
    [/ hin r/gi, ''],              // Remove corrupted fragments
    [/ivmain/gi, ''],              // Remove corrupted fragments
  ];
  
  indianOCRFixes.forEach(([pattern, replacement]) => {
    cleaned = cleaned.replace(pattern, replacement);
  });

  // Remove excessive whitespace - BUT PRESERVE NEWLINES (critical for line detection)
  // Replace multiple spaces with single space, but keep newlines intact
  cleaned = cleaned.replace(/ +/g, ' ');  // Multiple spaces → single space
  cleaned = cleaned.replace(/\n +/g, '\n');  // Remove trailing spaces on lines
  cleaned = cleaned.replace(/ +\n/g, '\n');  // Remove leading spaces on lines

  // Remove control characters (but not newlines)
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');

  return cleaned;
}

/**
 * Extract amounts from a line with multiple detection strategies
 * INCLUDES RECEIPT-SPECIFIC VALIDATION TO CATCH OCR ERRORS
 * @param {string} line - Receipt line
 * @returns {Array} - [{ amount, position, confidence }]
 */
function extractAmountsFromLine(line) {
  const amounts = [];

  // Pattern 1: Currency symbol + amount (₹100, $50, etc.)
  const currencyRegex = /([₹$€£¥])\s*([\d,]+\.?\d*)/g;
  let match;

  while ((match = currencyRegex.exec(line)) !== null) {
    const parsedAmount = parseAmount(match[2]);
    // RECEIPT VALIDATION: Catch OCR errors (â‚¹43210 is suspicious for item price)
    if (parsedAmount && isReasonableItemPrice(parsedAmount)) {
      amounts.push({
        raw: match[0],
        amount: parsedAmount,
        currency: match[1],
        position: match.index,
        confidence: 0.95
      });
    }
  }

  // Pattern 2: Plain numbers at end of line (often prices)
  const numberEndRegex = /\s+([\d,]+\.?\d*)\s*$/;
  match = line.match(numberEndRegex);
  if (match && !amounts.find(a => a.position > line.length - 20)) {
    const parsedAmount = parseAmount(match[1]);
    if (parsedAmount && isReasonableItemPrice(parsedAmount)) {
      amounts.push({
        raw: match[1],
        amount: parsedAmount,
        position: match.index,
        confidence: 0.7
      });
    }
  }

  // Pattern 3: Numbers after dots/spaces (item separator pattern)
  const afterDotRegex = /\.+\s*([\d,]+\.?\d*)\s*$/;
  match = line.match(afterDotRegex);
  if (match && !amounts.find(a => a.raw === match[1])) {
    const parsedAmount = parseAmount(match[1]);
    if (parsedAmount && isReasonableItemPrice(parsedAmount)) {
      amounts.push({
        raw: match[1],
        amount: parsedAmount,
        position: match.index,
        confidence: 0.8
      });
    }
  }

  // Remove duplicates
  return amounts.filter((a, i, arr) => arr.findIndex(x => x.amount === a.amount) === i);
}

/**
 * Validate if an amount is a reasonable item price (not OCR error)
 * Catches patterns like: â‚¹43210 (OCR misread of â‚¹300)
 * @param {number} amount - Parsed amount
 * @returns {boolean} - True if reasonable item price
 */
function isReasonableItemPrice(amount) {
  if (!amount || amount <= 0) return false;
  
  // STRICT range for typical grocery items
  // Minimum: ₹5 (smallest item)
  // Maximum: ₹5000 (covers premium items, avoids OCR corruption like ₹43210)
  const MIN_ITEM_PRICE = 5;
  const MAX_ITEM_PRICE = 5000;
  
  if (amount < MIN_ITEM_PRICE || amount > MAX_ITEM_PRICE) {
    return false;
  }
  
  return true;
}


/**
 * Parse amount with robust handling
 * @param {string} amountStr - Amount string
 * @returns {number} - Parsed amount
 */
function parseAmount(amountStr) {
  if (!amountStr) return null;

  let cleaned = amountStr.toString().trim();

  // Handle different formats
  // Indian: 1,00,000.50
  // US/EU: 1000.50 or 1.000,50
  // Simple: 100 or 100.5

  // Remove common thousand separators and normalize
  // Count occurrences of . and ,
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (dotCount === 1 && commaCount === 0) {
    // US format: 1000.50
    cleaned = cleaned.replace(/,/g, '');
  } else if (dotCount === 0 && commaCount === 1) {
    // European format: 1.000,50 (but this case only has one comma)
    // Could be 100,50 (European) or 1,000 (Indian thousands)
    // Assume European decimal
    cleaned = cleaned.replace('.', '').replace(',', '.');
  } else if (dotCount > 1) {
    // Multiple dots - Indian format: 1,00,000.50
    // Remove all but last dot
    const lastDot = cleaned.lastIndexOf('.');
    cleaned = cleaned.substring(0, lastDot).replace(/[.,]/g, '') + '.' + cleaned.substring(lastDot + 1);
  } else if (commaCount > 1) {
    // European: 1.000.000,50
    const lastComma = cleaned.lastIndexOf(',');
    cleaned = cleaned.substring(0, lastComma).replace(/[.,]/g, '') + '.' + cleaned.substring(lastComma + 1);
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Determine if a line is likely an item line (not metadata)
 * @param {string} line - Receipt line
 * @returns {Object} - { isItem: boolean, itemType: string, confidence: number }
 */
function classifyReceiptLine(line) {
  const classifications = {
    isItem: false,
    itemType: 'unknown',
    confidence: 0,
    reasons: []
  };

  if (!line || line.length < 3) {
    classifications.reasons.push('Line too short');
    return classifications;
  }

  // CRITICAL: Check for metadata FIRST (phone numbers, addresses, etc.)
  // These should never be treated as items
  if (isMetadataLine(line)) {
    classifications.itemType = 'metadata';
    classifications.confidence = 0.95;
    classifications.reasons.push('Detected as metadata (phone/address/contact info)');
    return classifications;
  }

  // Check for total markers
  if (isTotalLine(line)) {
    classifications.itemType = 'total';
    classifications.confidence = 0.95;
    classifications.reasons.push('Matched total patterns');
    return classifications;
  }

  // Check for item characteristics
  const amountCandidates = extractAmountsFromLine(line);
  const hasAmount = amountCandidates.length > 0;
  const hasLetters = /[a-zA-Z]/i.test(line);
  const amountAtEnd = amountCandidates.some(a => a.position > line.length - 30);
  const itemNameLength = line.split(/[\d.₹$€£]/)[0].length;

  if (hasAmount && hasLetters && itemNameLength > 2) {
    classifications.isItem = true;
    classifications.itemType = 'line_item';
    classifications.confidence = 0.8;
    classifications.reasons.push('Has amount', 'Has letters', 'Reasonable item name length');

    if (amountAtEnd) {
      classifications.confidence = 0.9;
      classifications.reasons.push('Amount at line end (typical pattern)');
    }
  } else if (hasLetters && itemNameLength > 5) {
    // Might be metadata without amount
    classifications.itemType = 'metadata';
    classifications.confidence = 0.6;
    classifications.reasons.push('Text only, no amount');
  }

  return classifications;
}

/**
 * Extract item from a line with multiple parsing attempts
 * @param {string} line - Receipt line
 * @returns {Object} - { item, amount, quantity } or null
 */
function extractItemFromLine(line) {
  if (!line || line.length < 3) return null;

  const classification = classifyReceiptLine(line);
  if (!classification.isItem) return null;

  const amountCandidates = extractAmountsFromLine(line);
  if (amountCandidates.length === 0) return null;

  // Get the most confident amount (usually at end)
  const amount = amountCandidates.sort((a, b) => {
    const aAtEnd = a.position > line.length - 30 ? 1 : 0;
    const bAtEnd = b.position > line.length - 30 ? 1 : 0;
    return (bAtEnd + b.confidence) - (aAtEnd + a.confidence);
  })[0];

  // Extract item name (everything before the amount)
  const itemName = line
    .substring(0, amount.position)
    .replace(/^\s*[\d\-*•]\s*/, '') // Remove leading bullets/numbers
    .replace(/[.\s]+$/, '')          // Remove trailing dots and whitespace (CRITICAL FIX)
    .trim();

  if (!itemName || itemName.length < 2 || !itemName.match(/[a-zA-Z]/)) {
    return null;
  }

  // Try to extract quantity if present
  // Example: "Rice (5 kg)" or "Milk 2L"
  const quantityMatch = itemName.match(/\(?(\d+\.?\d*)\s*([a-zA-Z]+)\)?/);
  const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : null;
  const unit = quantityMatch ? quantityMatch[2] : null;

  return {
    item: itemName,
    amount: amount.amount,
    quantity: quantity,
    unit: unit,
    category: inferCategory(itemName),
    confidence: classification.confidence * amount.confidence
  };
}

/**
 * Infer category from item name (IMPROVED WITH INDIAN ITEMS)
 * @param {string} itemName - Item name
 * @returns {string} - Category
 */
function inferCategory(itemName) {
  if (!itemName) return 'Other';

  const lower = itemName.toLowerCase();

  const categoryMaps = {
    // ENHANCED with more Indian items
    'Food & Dining': [
      // Staples
      'food', 'rice', 'bread', 'milk', 'egg', 'meat', 'fish', 'chicken', 'mutton',
      'fruit', 'vegetable', 'veg', 'grocery', 'dal', 'pulses', 'atta', 'flour',
      'sugar', 'salt', 'oil', 'ghee', 'butter', 'spice', 'tea', 'coffee', 'sugar',
      // Dairy
      'dairy', 'paneer', 'cheese', 'yogurt', 'curd', 'cream', 'condensed',
      // Bakery/Baked goods
      'bakery', 'biscuit', 'snack', 'chips', 'wafer', 'cookie',
      // Restaurants/Prepared
      'restaurant', 'cafe', 'coffee shop', 'dhaba', 'fast food',
      // Beverages
      'juice', 'soft drink', 'water', 'soda', 'beer', 'wine'
    ],
    'Shopping': [
      'cloth', 'fabric', 'shirt', 'pant', 'dress', 'saree', 'kurta', 'shoe',
      'clothing', 'footwear', 'garment',
      // Household cleaning
      'detergent', 'soap', 'shampoo', 'conditioner', 'toothpaste', 'paste',
      'household', 'cleaning', 'cleaner', 'sanitizer', 'bleach',
      // Accessories/General
      'bag', 'gift', 'gift card', 'accessories', 'belt', 'watch'
    ],
    'Healthcare': [
      'pharmacy', 'medicine', 'drug', 'tablet', 'capsule', 'syrup', 'health',
      'hospital', 'clinic', 'medical', 'vitamin', 'supplement', 'ayurveda',
      'homeopathy', 'ayurvedic', 'ointment', 'cream', 'balm'
    ],
    'Transport': [
      'petrol', 'diesel', 'fuel', 'gas', 'cng', 'lpg',
      'taxi', 'auto', 'auto-rickshaw', 'cab', 'transport', 'bus',
      'parking', 'toll', 'ticket', 'pass',
      'railway', 'train', 'metro', 'flight', 'airline'
    ],
    'Entertainment': [
      'movie', 'cinema', 'theatre', 'theater', 'ticket', 'show', 'concert',
      'game', 'sports', 'activity', 'recreation', 'resort'
    ],
    'Utilities': [
      'electricity', 'power', 'light', 'bill',
      'water', 'supply',
      'phone', 'mobile', 'recharge',
      'internet', 'broadband', 'wifi'
    ],
  };

  // Two-pass matching: first exact phrase, then single word
  for (const [category, keywords] of Object.entries(categoryMaps)) {
    // Pass 1: Multi-word matches for higher accuracy
    const multiKeywords = keywords.filter(k => k.includes(' '));
    if (multiKeywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  
  // Pass 2: Single-word matches
  for (const [category, keywords] of Object.entries(categoryMaps)) {
    const singleKeywords = keywords.filter(k => !k.includes(' '));
    if (singleKeywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }

  return 'Other';
}

/**
 * Parse complete receipt with improved logic
 * PRIORITIZES INDIAN PARSER FOR INDIAN RECEIPTS
 * @param {string} ocrText - Raw OCR text
 * @param {Object} options - Parsing options
 * @returns {Object} - Parsed receipt structure
 */
function parseImprovedReceipt(ocrText, options = {}) {
  const {
    useIndianParser = true,
    detectIndian = true
  } = options;

  if (!ocrText) {
    return { success: false, items: [], message: 'Empty OCR text' };
  }

  // Clean OCR noise
  ocrText = cleanOCRNoise(ocrText);

  // AUTO-DETECT AND USE INDIAN PARSER FOR INDIAN RECEIPTS (CRITICAL FIX)
  // Check multiple indicators to ensure we don't miss Indian receipts
  const isIndian = useIndianParser && detectIndian && indianParser.isIndianReceipt(ocrText);
  
  if (isIndian) {
    try {
      const indianResult = indianParser.parseIndianReceipt(ocrText);
      // Wrap Indian parser result in expected metadata structure
      return {
        success: true,
        usingIndianParser: true,
        items: indianResult.items || [],
        metadata: {
          store: indianResult.storeName || null,
          date: indianResult.date || null,
          total: indianResult.total || null,
          subtotal: indianResult.subtotal || null,
          tax: indianResult.tax || null,
          paymentMethod: indianResult.paymentMethod || null
        },
        totals: {
          itemCount: (indianResult.items || []).length,
          sumOfItems: indianResult.items ? indianResult.items.reduce((sum, item) => sum + (item.amount || 0), 0) : 0,
          parsedTotal: indianResult.total || null
        },
        quality: {
          confidence: indianResult.confidence || 80,
          warnings: indianResult.warnings || []
        }
      };
    } catch (error) {
      console.error('Indian parser failed:', error.message);
      // Fall through to general parser on error
    }
  }

  // General parsing logic
  const result = {
    success: true,
    usingIndianParser: false,
    items: [],
    metadata: {
      store: null,
      date: null,
      total: null,
      subtotal: null,
      tax: null,
      paymentMethod: null
    },
    totals: {
      itemCount: 0,
      sumOfItems: 0,
      parsedTotal: null
    },
    quality: {
      confidence: 0,
      warnings: []
    }
  };

  const lines = ocrText.split('\n');

  let itemsSection = false;
  let maxAmount = 0;
  const foundAmounts = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line || line.length < 2) continue;

    // Extract metadata
    if (!result.metadata.store && line.match(/[A-Za-z]{5,}/) && !isTotalLine(line)) {
      result.metadata.store = line.substring(0, 60);
    }

    // Try to extract date
    if (!result.metadata.date) {
      const dateMatch = line.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/);
      if (dateMatch) {
        result.metadata.date = dateMatch[1];
      }
    }

    // Detect items section
    if (line.match(/items?|description|qty|amount|price/i) && !isTotalLine(line)) {
      itemsSection = true;
      continue;
    }

    // Stop at totals
    if (isTotalLine(line)) {
      itemsSection = false;
      const amounts = extractAmountsFromLine(line);
      if (amounts.length > 0) {
        const lastAmount = amounts[amounts.length - 1].amount;
        if (lastAmount > maxAmount) {
          maxAmount = lastAmount;
          result.metadata.total = lastAmount;
        }
      }
      continue;
    }

    // Try to extract as item
    const item = extractItemFromLine(line);
    if (item) {
      result.items.push(item);
      result.totals.sumOfItems += item.amount;
      foundAmounts.push(item.amount);
    }
  }

  result.totals.itemCount = result.items.length;

  // Detect and validate total
  if (foundAmounts.length > 0) {
    const maxFound = Math.max(...foundAmounts);
    if (maxFound > result.totals.sumOfItems * 0.8) {
      // The max amount is likely the total
      result.metadata.total = maxFound;
      result.totals.parsedTotal = maxFound;
      
      // Check if it makes sense
      if (maxFound <= result.totals.sumOfItems * 1.2) {
        // Reasonable (accounting for tax)
        result.quality.confidence = Math.min(100, 70 + (result.totals.itemCount * 5));
      } else {
        result.quality.warnings.push('Total significantly higher than sum of items - possible OCR error');
      }
    }
  }

  // Quality checks
  if (result.items.length === 0) {
    result.quality.warnings.push('No items extracted');
    result.quality.confidence = 20;
  } else if (result.items.length > 100) {
    result.quality.warnings.push('Unusually high item count - possible parsing error');
  }

  if (!result.metadata.store) {
    result.quality.warnings.push('Store name not detected');
  }

  if (!result.metadata.total) {
    result.quality.warnings.push('Total amount not detected');
  }

  result.quality.confidence = Math.max(0, Math.min(100, result.quality.confidence || 50));

  return result;
}

module.exports = {
  parseImprovedReceipt,
  extractItemFromLine,
  extractAmountsFromLine,
  parseAmount,
  isReasonableItemPrice,
  classifyReceiptLine,
  isTotalLine,
  isMetadataLine,
  cleanOCRNoise,
  inferCategory
};

