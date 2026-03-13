/**
 * Natural Language Parser for Transaction Details
 * Parses voice input to extract amount, category, and description
 */

// Category keywords mapping
const CATEGORY_KEYWORDS = {
  'Food & Dining': [
    'food', 'meal', 'lunch', 'dinner', 'breakfast', 'restaurant', 'grocery', 'groceries',
    'coffee', 'pizza', 'burger', 'sushi', 'thali', 'biryani', 'dosa', 'idli', 'snack',
    'takeout', 'take out', 'delivery', 'fast food', 'cafe', 'bakery', 'sweet', 'mithai',
    'vegetables', 'fruits', 'market', 'supermarket', 'zomato', 'swiggy', 'ubereats'
  ],
  'Transport': [
    'transport', 'transportation', 'taxi', 'uber', 'ola', 'bus', 'metro', 'train',
    'petrol', 'gas', 'fuel', 'diesel', 'parking', 'toll', 'auto', 'rickshaw',
    'flight', 'airplane', 'air', 'car', 'bike', 'scooter', 'vehicle', 'maintenance',
    'repair', 'oil change', 'dmv', 'license', 'registration'
  ],
  'Shopping': [
    'shopping', 'clothes', 'clothing', 'dress', 'shirt', 'pants', 'shoes', 'sneakers',
    'amazon', 'flipkart', 'myntra', 'fashion', 'accessories', 'watch', 'jewelry',
    'bag', 'wallet', 'electronics', 'phone', 'laptop', 'computer', 'tablet', ' gadget',
    'furniture', 'home', 'decor', 'kitchen', 'utensils', 'appliance'
  ],
  'Entertainment': [
    'entertainment', 'movie', 'movies', 'cinema', 'theatre', 'netflix', 'amazon prime',
    'hotstar', 'spotify', 'music', 'game', 'gaming', 'concert', 'show', 'event',
    'party', 'celebration', 'subscription', 'streaming', 'ott', 'disney', 'hulu'
  ],
  'Healthcare': [
    'healthcare', 'health', 'medical', 'medicine', 'pharmacy', 'doctor', 'hospital',
    'clinic', 'dental', 'dentist', 'eye', 'optical', 'health insurance', 'mediclaim',
    'vitamins', 'prescription', 'treatment', 'surgery', 'test', 'lab', 'diagnostic',
    'vaccine', 'covid', 'corona', 'consultation', 'therapy'
  ],
  'Utilities': [
    'utilities', 'electricity', 'bill', 'bills', 'water', 'gas', 'power', 'internet',
    'wifi', 'broadband', 'mobile', 'phone', 'recharge', 'prepaid', 'postpaid',
    'cable', 'dish', 'maintenance', 'society', 'apartment', 'rent', 'cooking gas'
  ],
  'Housing': [
    'housing', 'rent', 'emi', 'loan', 'mortgage', 'property', 'home', 'apartment',
    'maintenance', 'society', 'association', 'HOA', 'insurance', 'home insurance'
  ],
  'Education': [
    'education', 'school', 'college', 'university', 'tuition', 'coaching', 'course',
    'books', 'stationery', 'exam', 'fee', 'subscription', 'learning', 'training',
    'certification', 'degree', 'diploma', 'online course', 'udemy', 'coursera'
  ],
  'Travel': [
    'travel', 'trip', 'vacation', 'holiday', 'hotel', 'airbnb', 'booking', 'resort',
    'tour', 'package', 'flight', 'train', 'bus', 'cab', 'visa', 'passport',
    'travel insurance', 'sightseeing', 'beach', 'mountain', 'destination'
  ],
  'Investment': [
    'investment', 'invest', 'stock', 'stocks', 'share', 'shares', 'mutual fund', 'FD',
    'fixed deposit', 'RD', 'recurring deposit', 'gold', 'crypto', 'bitcoin',
    'bond', 'NPS', 'ppf', 'insurance', 'SIP', 'dividend', 'returns', 'portfolio'
  ],
  'Salary': [
    'salary', 'income', 'wage', 'pay', 'payroll', 'bonus', 'incentive', 'commission',
    'allowance', 'reimbursement', 'refund'
  ],
  'Freelance': [
    'freelance', 'freelancing', 'contract', 'project', 'consulting', 'client',
    'gig', 'side hustle', 'earnings'
  ],
  'Business': [
    'business', 'office', 'supplies', 'equipment', 'marketing', 'advertising',
    'software', 'tools', 'professional', 'services', 'accounting', 'legal'
  ],
  'Insurance': [
    'insurance', 'premium', 'policy', 'claim', 'coverage', 'term', 'life insurance',
    'health insurance', 'vehicle insurance', 'car insurance', 'bike insurance'
  ],
  'EMI & Loans': [
    'EMI', 'loan', 'loans', 'credit', 'card', 'credit card', 'debt', 'repayment',
    'monthly payment', 'installment', 'interest', 'principal'
  ],
  'Subscriptions': [
    'subscription', 'membership', 'monthly', 'annual', 'yearly', 'recurring',
    'netflix', 'spotify', 'prime', 'disney', 'hotstar', 'youtube', 'medium',
    'linkedin', 'github', 'adobe', 'microsoft', 'office 365'
  ],
  'Gifts & Donations': [
    'gift', 'donation', 'charity', 'contribution', 'present', 'birthday',
    'anniversary', 'wedding', 'festival', 'puja', 'festive', 'donate'
  ],
  'Bank Charges': [
    'bank charge', 'charge', 'fee', 'bank fee', 'processing fee', 'service charge',
    'ATM', 'withdrawal', 'transfer charge', 'NEFT', 'RTGS', 'IMPS'
  ],
  'Other': [
    'other', 'miscellaneous', 'misc', 'various', 'undry', 'expense', 'spending'
  ]
};

// Number word mappings
const NUMBER_WORDS = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
  'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000,
  'lakh': 100000, 'lac': 100000, 'million': 1000000
};

// Currency symbols and keywords
const CURRENCY_KEYWORDS = ['rupees', 'rupee', 'rs', '₹', 'dollar', 'dollars', '$'];

// Command patterns for adding transactions
const ADD_TRANSACTION_PATTERNS = [
  /^(?:i\s+)?(?:spent|pay(?:ed)?|bought|bought\s+something|paid|used|disbursed|log|add|record|enter|create)\s+(?:a\s+)?(?:transaction\s+of\s+)?(?:rupees?\s+)?(\d+(?:\.\d{1,2})?)\s*(?:rupees?)?/i,
  /^(?:i\s+)?(?:just\s+)?(?:spent|paid|bought)\s+(?:rupees?\s+)?(\d+(?:\.\d{1,2})?)\s*(?:rupees?)?\s*(?:on|for)\s+/i,
  /^(?:rupees?|rs\.?)\s*(\d+(?:\.\d{1,2})?)\s*(?:spent|paid|for|on)/i,
  /(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?)\s*(?:spent|paid|for|on)/i,
  /^(?:spent|pay|paid)\s+(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?)?/i,
  /(\d+(?:\.\d{1,2})?)\s+(?:rupees?|rs\.?)/i,
  /(\d+(?:\.\d{1,2})?)\s+(?:for|on|in)\s+/i,
  /^(\d+(?:\.\d{1,2})?)$/
];

// Query patterns
const QUERY_PATTERNS = [
  /^(?:what|how much|show|tell me)\s+(?:is\s+)?(?:my\s+)?(?:total\s+)?(?:expenses?spending|spent)\s+(?:in|for|during|this|last|past)?\s*(?:month|week|year|today)?/i,
  /^(?:show|list|get|give)\s+(?:me\s+)?(?:my\s+)?(?:transactions?|expenses?|spending)\s+(?:in|for|during|this|last|past)?\s*(?:month|week|year|today)?/i,
  /^(?:how much|what(?:'s| is))\s+(?:did i|i have)\s+spent\s+(?:on|in|during|this|last|past)?\s*(\w+)?/i,
  /^(?:what(?:'s| is))\s+(?:my\s+)?(?:spending|expenses?)\s+on\s+(\w+)/i,
  /^(?:show|list)\s+(?:me\s+)?(?:my\s+)?(\w+)\s+(?:expenses?|spending|transactions?)/i
];

// Confirmation patterns
const CONFIRM_PATTERNS = /^(?:yes|confirm|correct|yeah|yup|ok|okay|do it|save)\b/i;
const CANCEL_PATTERNS = /^(?:no|cancel|stop|wrong|wait|don't)\b/i;

/**
 * Parse number from text (including number words)
 */
function parseNumber(text) {
  const lowerText = text.toLowerCase().trim();

  // First try direct numeric patterns
  const numericPatterns = [
    /(\d+(?:\.\d{1,2})?)/,
    /(\d+),\d{3}(?:\.\d{1,2})?/  // Handle comma-separated numbers
  ];

  for (const pattern of numericPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }

  // Try parsing number words
  let total = 0;
  let currentNumber = 0;
  const words = lowerText.split(/\s+/);

  for (const word of words) {
    const cleanWord = word.replace(/[.,]/g, '');

    if (NUMBER_WORDS[cleanWord] !== undefined) {
      const value = NUMBER_WORDS[cleanWord];

      if (value === 100) {
        currentNumber = currentNumber === 0 ? 100 : currentNumber * 100;
      } else if (value >= 1000) {
        currentNumber = currentNumber === 0 ? value : currentNumber * value;
        total += currentNumber;
        currentNumber = 0;
      } else {
        currentNumber += value;
      }
    }
  }

  total += currentNumber;

  return total > 0 ? total : null;
}

/**
 * Extract amount from text
 */
function extractAmount(text) {
  const lowerText = text.toLowerCase();

  // Check for currency indicators
  const hasCurrency = CURRENCY_KEYWORDS.some(kw => lowerText.includes(kw));

  // Try each pattern
  for (const pattern of ADD_TRANSACTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      if (amount > 0 && amount < 10000000) { // Reasonable limit
        return amount;
      }
    }
  }

  // If no pattern matched but currency mentioned, try to find any number
  if (hasCurrency) {
    const numbers = text.match(/\d+(?:\.\d{1,2})?/g);
    if (numbers) {
      for (const num of numbers) {
        const amount = parseFloat(num);
        if (amount > 0 && amount < 10000000) {
          return amount;
        }
      }
    }
  }

  return null;
}

/**
 * Detect category from text
 */
function detectCategory(text) {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  let bestMatch = {
    category: 'Other',
    score: 0
  };

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;

    for (const keyword of keywords) {
      // Check for exact word match
      if (words.includes(keyword)) {
        score += 3;
      }
      // Check for substring match
      else if (lowerText.includes(keyword)) {
        score += 1;
      }
    }

    if (score > bestMatch.score) {
      bestMatch = { category, score };
    }
  }

  // Only return a category if we have a reasonable match
  return bestMatch.score > 0 ? bestMatch.category : 'Other';
}

/**
 * Extract description from text
 */
function extractDescription(text, amount, category) {
  let description = text;

  // Remove common command phrases
  const removePhrases = [
    /^(?:i\s+)?(?:spent|pay(?:ed)?|bought|paid|used|disbursed)\s+(?:rupees?\s+)?\d+(?:\.\d{1,2})?\s*(?:rupees?)?\s*(?:on\s+)?/i,
    /^(?:add|record|log|enter|create)\s+(?:a\s+)?(?:transaction\s+)?(?:of\s+)?(?:rupees?\s+)?\d+(?:\.\d{1,2})?\s*(?:rupees?)?\s*(?:on\s+)?/i,
    /^(?:rupees?|rs\.?)\s*\d+(?:\.\d{1,2})?\s*(?:spent|paid|for|on)/i,
    /(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?)\s*(?:spent|paid|for|on)/i,
    /^(?:spent|pay|paid)\s+\d+(?:\.\d{1,2})?\s*(?:rupees?|rs\.?)?\s*(?:on|for)/i
  ];

  for (const phrase of removePhrases) {
    description = description.replace(phrase, '');
  }

  // Remove amount mentions
  description = description.replace(/\d+(?:\.\d{1,2})?\s*(?:rupees?|rs\.?|₹|dollars?)?/gi, '');

  // Remove category keywords
  for (const keywords of Object.values(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      description = description.replace(regex, '');
    }
  }

  // Clean up
  description = description
    .replace(/\s+/g, ' ')
    .replace(/^(?:on|for|to|with|in|at)\s+/i, '')
    .trim();

  // If description is empty or too short, use a default
  if (description.length < 2) {
    description = category !== 'Other' ? `Voice entry - ${category}` : 'Voice entry';
  }

  // Capitalize first letter
  description = description.charAt(0).toUpperCase() + description.slice(1);

  // Limit length
  if (description.length > 200) {
    description = description.substring(0, 197) + '...';
  }

  return description;
}

/**
 * Determine transaction type (expense or income)
 */
function detectTransactionType(text) {
  const lowerText = text.toLowerCase();

  // Income keywords
  const incomeKeywords = ['received', 'earned', 'income', 'salary', 'wage', 'bonus',
    'profit', 'gain', 'refund', 'reimbursement', 'credit'];

  // Check for income indicators
  for (const keyword of incomeKeywords) {
    if (lowerText.includes(keyword)) {
      return 'income';
    }
  }

  // Default to expense
  return 'expense';
}

/**
 * Parse voice command for transaction details
 */
function parseTransactionCommand(text) {
  const amount = extractAmount(text);

  if (!amount) {
    return {
      success: false,
      error: 'Could not detect an amount. Please specify the amount clearly.',
      missing: ['amount']
    };
  }

  const type = detectTransactionType(text);
  const category = detectCategory(text);
  const description = extractDescription(text, amount, category);

  return {
    success: true,
    data: {
      type,
      amount,
      category,
      description,
      date: new Date(),
      importSource: 'voice'
    }
  };
}

/**
 * Parse query command
 */
function parseQueryCommand(text) {
  const lowerText = text.toLowerCase();

  // Determine query type
  let queryType = 'summary';
  let timePeriod = 'this month';
  let category = null;

  // Time period detection
  if (lowerText.includes('today') || lowerText.includes('today\'s')) {
    timePeriod = 'today';
  } else if (lowerText.includes('week') || lowerText.includes('weekly')) {
    timePeriod = 'this week';
  } else if (lowerText.includes('last month') || lowerText.includes('previous month')) {
    timePeriod = 'last month';
  } else if (lowerText.includes('year') || lowerText.includes('yearly') || lowerText.includes('annual')) {
    timePeriod = 'this year';
  } else {
    timePeriod = 'this month'; // Default
  }

  // Category detection for specific queries
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        category = cat;
        break;
      }
    }
    if (category) break;
  }

  // Query type detection
  if (lowerText.includes('transaction') || lowerText.includes('transactions')) {
    queryType = 'transactions';
  } else if (lowerText.includes('category') || lowerText.includes('breakdown')) {
    queryType = 'by category';
  }

  return {
    success: true,
    query: {
      type: queryType,
      timePeriod,
      category
    }
  };
}

/**
 * Main parse function - determines if it's a transaction or query
 */
function parse(text) {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: 'No text provided',
      type: 'unknown'
    };
  }

  const lowerText = text.toLowerCase().trim();

  // Check for confirmation patterns
  if (CONFIRM_PATTERNS.test(lowerText)) {
    return { success: true, type: 'confirm' };
  }

  if (CANCEL_PATTERNS.test(lowerText)) {
    return { success: true, type: 'cancel' };
  }

  // Check for query patterns first
  const isQuery = QUERY_PATTERNS.some(pattern => pattern.test(text));

  if (isQuery) {
    return {
      ...parseQueryCommand(text),
      type: 'query'
    };
  }

  // Otherwise treat as transaction command
  return {
    ...parseTransactionCommand(text),
    type: 'transaction'
  };
}

export default {
  parse,
  parseTransactionCommand,
  parseQueryCommand,
  extractAmount,
  detectCategory,
  extractDescription,
  detectTransactionType,
  CATEGORY_KEYWORDS
};
