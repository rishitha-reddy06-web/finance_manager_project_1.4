const crypto = require('crypto');
const Transaction = require('../models/Transaction');

// Core Identification Keywords
const DEBIT_KEYWORDS = ['debited', 'spent', 'paid', 'used', 'withdrawn', 'payment', 'purchase', 'sent to'];
const CREDIT_KEYWORDS = ['credited', 'received', 'earned', 'salary', 'refund', 'deposit', 'income'];
const NOISE_WORDS = ['ref', 'transaction', 'using', 'date', 'towards', 'a/c', 'xx', 'ending', 'info', 'bal', 'available', 'limit', 'otp', 'code'];

/**
 * Clean and Hash message to prevent duplicates
 */
const getMessageHash = (userId, text) => {
  const cleanText = text.toLowerCase().replace(/\s/g, '');
  return crypto.createHash('md5').update(`${userId}_${cleanText}`).digest('hex');
};

/**
 * High-Precision Amount Extractor
 * Handles: 100, 1,000.00, ₹50, Rs 500, INR 120.50
 */
const extractRobustAmount = (text) => {
  // Pattern to find currency values
  const currencyPattern = /(?:inr|rs\.?|₹|inr)\s*([\d,]+\.?\d*)/i;
  const match = text.match(currencyPattern);
  if (match) return parseFloat(match[1].replace(/,/g, ''));

  // Fallback: Look for any number that looks like a decimal amount at the end of key phrases
  const fallbackPattern = /(?:for|of|amount)\s*([\d,]+\.?\d*)/i;
  const fbMatch = text.match(fallbackPattern);
  if (fbMatch) return parseFloat(fbMatch[1].replace(/,/g, ''));

  return null;
};

/**
 * Advanced Merchant Name Isolation
 */
const isolateMerchant = (text, type) => {
  let cleaned = text;

  // 1. Find the "at" or "to" or "from" marker
  const markers = type === 'expense' ? ['at', 'to', 'on'] : ['from', 'by', 'at'];
  let merchant = '';
  
  for (const marker of markers) {
    const regex = new RegExp(`\\b${marker}\\b\\s+([A-Z0-9\\s.,&*-]+)`, 'i');
    const match = text.match(regex);
    if (match) {
      merchant = match[1].trim();
      break;
    }
  }

  if (!merchant) return 'Unknown Merchant';

  // 2. Aggressive Noise Cleaning
  // Split at noise keywords like "on", "date", "Ref", "A/c"
  const splitters = ['\\s+is\\b', '\\s+on\\b', '\\s+date\\b', '\\s+using\\b', '\\s+Ref\\b', '\\s+A/c\\b', '\\s+at\\b'];
  const splitRegex = new RegExp(`(?:${splitters.join('|')})`, 'i');
  merchant = merchant.split(splitRegex)[0].trim();

  // 3. Remove trailing symbols/dots
  merchant = merchant.replace(/[.*-]$/, '').replace(/\s+/g, ' ').trim();

  return merchant || 'Merchant';
};

/**
 * Robust Transaction Parsing Logic (Heuristic Engine)
 */
const parseRobustSMS = (text) => {
  const lower = text.toLowerCase();
  
  // 1. Transaction Type Detection
  let type = 'expense';
  if (CREDIT_KEYWORDS.some(kw => lower.includes(kw)) && !lower.includes('bill payment')) {
    type = 'income';
  }

  // 2. Amount Extraction
  const amount = extractRobustAmount(text);
  if (!amount || isNaN(amount)) return null;

  // 3. Merchant Isolation
  const description = isolateMerchant(text, type);

  // 4. Smart Categorization
  let category = 'Other';
  const descLower = description.toLowerCase();
  const textLower = lower;

  const catMap = {
    'Food & Dining': ['swiggy', 'zomato', 'restaurant', 'cafe', 'eat', 'food', 'bakery', 'hotel', 'dhaba', 'pizza', 'burger', 'kfc', 'mcdonald', 'starbucks', 'chai', 'coffee', 'breakfast', 'lunch', 'dinner', 'dessert', 'sweet', 'mithai', 'haldiram', 'bikaji'],
    'Shopping': ['amazon', 'flipkart', 'myntra', 'nykaa', 'shopping', 'retail', 'dmart', 'bazaar', 'reliance', 'jio mart', 'more retail', 'spencer', 'big bazaar', 'shoppers stop', 'zudio', 'westside', 'clothes', 'fashion', 'grocery', 'supermarket'],
    'Transport': ['uber', 'ola', 'petrol', 'fuel', 'metro', 'taxi', 'irctc', 'train', 'bus', 'rapido', 'indigo', 'air india', 'spicejet', 'automotive', 'garage', 'parking', 'toll'],
    'Utilities': ['jio', 'airtel', 'vi', 'bill', 'electricity', 'water', 'recharge', 'prepaid', 'postpaid', 'broadband', 'wifi', 'dish tv', 'tata play', 'gas', 'lpg', 'indane', 'hp gas', 'maintenance'],
    'Healthcare': ['pharmacy', 'apollo', 'hospital', 'medical', 'clinic', 'medplus', 'doctor', 'diagnostic', 'dentist', '1mg', 'pharmeasy', 'netmeds'],
    'Entertainment': ['netflix', 'prime', 'spotify', 'movie', 'cinema', 'bookmyshow', 'pvr', 'inox', 'theatre', 'gaming', 'subscription', 'hotstar', 'youtube'],
    'Salary': ['salary', 'allowance', 'payroll', 'stipend', 'bonus', 'incentive', 'credit', 'interest']
  };

  for (const [cat, keywords] of Object.entries(catMap)) {
    if (keywords.some(kw => descLower.includes(kw) || textLower.includes(kw))) {
      category = cat;
      break;
    }
  }

  // Force Salary to Income
  if (category === 'Salary') type = 'income';

  return { amount, description, type, category };
};

/**
 * Filter out OTP and junk messages
 */
const isValidTransactionSMS = (text) => {
  const lower = text.toLowerCase();
  if (lower.match(/\b(otp|password|login|verification|code|secret)\b/)) return false;
  
  // Must have a number and some bank-like words
  const hasAmount = /[\d,]+\.?\d*/.test(text);
  const isBankLike = DEBIT_KEYWORDS.some(kw => lower.includes(kw)) || 
                     CREDIT_KEYWORDS.some(kw => lower.includes(kw)) ||
                     /₹|rs|inr/i.test(text);
                     
  return hasAmount && isBankLike;
};

/**
 * Main Processing Handler
 */
const processIncomingMessage = async (userId, messageText, io) => {
  try {
    if (!isValidTransactionSMS(messageText)) return { success: false, reason: 'noise' };

    const hash = getMessageHash(userId, messageText);
    
    // Check for duplicates in recent transactions
    const recentTx = await Transaction.findOne({ 
      user: userId, 
      createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      description: { $regex: new RegExp(hash.substring(0, 6)) } 
    });
    
    if (recentTx) return { success: false, reason: 'duplicate' };

    const parsed = parseRobustSMS(messageText);
    if (!parsed) return { success: false, reason: 'unparseable' };

    // DO NOT SAVE TO DB YET (REQUESTED: "ask permission while adding")
    // Send the detection to the frontend via WebSocket for approval
    const detectionDetails = {
      ...parsed,
      hash: hash.substring(0, 6),
      rawMessage: messageText,
      date: new Date()
    };

    if (io) {
      io.to(userId.toString()).emit('new_detection_for_approval', detectionDetails);
    }

    return { success: true, pendingApproval: true, detection: detectionDetails };
  } catch (err) {
    console.error('Robust Parser Error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  processIncomingMessage,
  isValidTransactionSMS,
  parseRobustSMS
};
