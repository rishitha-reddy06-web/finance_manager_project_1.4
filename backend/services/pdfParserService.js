const fs = require('fs');
const pdf = require('pdf-parse');
const PDFParser = require('pdf2json');

/**
 * PDF Parser Service for Bank Statements
 * Extracts transactions across different statement layouts.
 */
class PdfParserService {
  constructor() {
    this.datePatterns = [
      // DD-Mon-YYYY or DD/Mon/YYYY (e.g., 05-Mar-2026)
      /(\d{1,2})[-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/](\d{4})/i,
      // DD Mon YYYY (e.g., 05 Mar 2026)
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
      // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
      // DD/MM/YY or DD-MM-YY
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/,
      // YYYY-MM-DD
      /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
    ];

    this.bankPatterns = {
      hdfc: /HDFC Bank/i,
      icici: /ICICI Bank/i,
      sbi: /State Bank/i,
      axis: /Axis Bank/i,
      yes: /Yes Bank/i,
      kotak: /Kotak Mahindra/i,
      idbi: /IDBI Bank/i,
      abc: /ABC Bank/i,
      pnb: /Punjab National/i,
      bob: /Bank of Baroda/i,
      canara: /Canara Bank/i,
      union: /Union Bank/i,
    };

    this.creditKeywords = [
      'credit', 'credited', 'deposit', 'salary', 'refund', 'interest', 'transfer in', 'received', 'neft cr', 'rtgs cr', 'imps cr', 'upi cr', 'upi credit', 'gpay credit', 'phonepe credit', 'paytm credit', 'wallet credit', 'qr received', 'collect request'
    ];

    this.debitKeywords = [
      'debit', 'debited', 'withdrawal', 'purchase', 'payment', 'bank charge', 'fee', 'charges', 'transfer out', 'neft dr', 'rtgs dr', 'imps dr', 'upi dr', 'upi debit', 'gpay debit', 'phonepe debit', 'paytm debit', 'wallet debit', 'qr payment', 'send money', 'collect request paid'
    ];

    this.upiKeywords = [
      'upi', 'gpay', 'google pay', 'phonepe', 'paytm', 'bhim', 'amazon pay', 'mobikwik', 'freecharge', 'airtel pay', 'jio pay', 'whatsapp pay', 'scan', 'qr', '@upi', '@bank'
    ];
  }

  async parsePdf(filePath) {
    try {
      let text = '';
      let pageCount = 0;
      let usedParser = 'pdf-parse';

      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(dataBuffer);
        text = pdfData.text || '';
        pageCount = pdfData.numpages || 0;
      } catch (parseError) {
        console.warn('pdf-parse failed, trying pdf2json:', parseError.message);
      }

      if (!text || text.trim().length === 0) {
        usedParser = 'pdf2json';
        const jsonData = await this.parseWithPdf2json(filePath);
        text = this.getRawTextFromPdf2json(jsonData);
        pageCount = Array.isArray(jsonData.Pages) ? jsonData.Pages.length : 0;
      }

      if (!text || text.trim().length === 0) {
        throw new Error('Unable to read PDF content. The file may be encrypted, scanned, or corrupted.');
      }

      const lines = text
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      const detectedBank = this.detectBank(text);
      const statementFormat = this.detectStatementFormat(text);

      // Try multiple extraction strategies and combine results
      let extracted = [];

      // Strategy 1: Table format with Debit/Credit columns
      extracted = this.extractTableTransactions(lines);

      // Strategy 2: Pattern-based extraction
      if (extracted.length === 0) {
        extracted = this.extractByPattern(lines);
      }

      // Strategy 3: Line format extraction
      if (extracted.length === 0) {
        extracted = this.extractFromLineFormat(lines);
      }

      // Strategy 4: Generic extraction
      if (extracted.length === 0) {
        extracted = this.extractGenericTransactions(lines);
      }

      // Strategy 5: Relaxed extraction (last resort)
      if (extracted.length === 0) {
        extracted = this.extractRelaxedTransactions(lines);
      }

      const validTransactions = this.validateTransactions(extracted);

      return {
        success: true,
        pageCount,
        transactionCount: validTransactions.length,
        transactions: validTransactions,
        detectedBank,
        statementFormat,
        parser: usedParser,
        rawText: text.substring(0, 1000),
        isScanned: false,
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      const isScannedError = error.message.includes('scanned') || error.message.includes('Unable to read');
      return {
        success: false,
        error: error.message,
        transactions: [],
        isScanned: isScannedError,
      };
    }
  }

  async parseWithPdf2json(filePath) {
    return new Promise((resolve, reject) => {
      const parser = new PDFParser();
      parser.on('pdfParser_dataError', (err) => reject(err.parserError));
      parser.on('pdfParser_dataReady', (data) => resolve(data));
      parser.loadPDF(filePath);
    });
  }

  getRawTextFromPdf2json(pdfData) {
    let fullText = '';
    const pages = Array.isArray(pdfData.Pages) ? pdfData.Pages : [];

    pages.forEach((page) => {
      const linesMap = {};
      const texts = Array.isArray(page.Texts) ? page.Texts : [];

      texts.forEach((item) => {
        const y = item.y;
        const x = item.x;
        const raw = item?.R?.[0]?.T || '';
        const token = decodeURIComponent(raw);

        if (!linesMap[y]) linesMap[y] = [];
        linesMap[y].push({ x, text: token });
      });

      Object.keys(linesMap)
        .sort((a, b) => parseFloat(a) - parseFloat(b))
        .forEach((y) => {
          const line = linesMap[y]
            .sort((a, b) => a.x - b.x)
            .map((t) => t.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (line) fullText += `${line}\n`;
        });
    });

    return fullText;
  }

  async checkIfScanned(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      const text = pdfData.text || '';
      const pageCount = pdfData.numpages || 0;
      
      if (!text || text.trim().length === 0) {
        const jsonData = await this.parseWithPdf2json(filePath);
        const rawText = this.getRawTextFromPdf2json(jsonData);
        
        if (!rawText || rawText.trim().length === 0) {
          return { isScanned: true, isEncrypted: false, pageCount, reason: 'No text content detected. PDF may contain only images.' };
        }
        return { isScanned: false, isEncrypted: false, pageCount };
      }
      
      return { isScanned: false, isEncrypted: false, pageCount };
    } catch (error) {
      if (error.message?.includes('encrypted') || error.message?.includes('password')) {
        return { isScanned: false, isEncrypted: true, pageCount: 0, reason: 'PDF is password protected' };
      }
      throw error;
    }
  }

  detectBank(text) {
    for (const [name, pattern] of Object.entries(this.bankPatterns)) {
      if (pattern.test(text)) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
    return 'Unknown';
  }

  extractByPattern(lines) {
    const transactions = [];
    for (const line of lines) {
      const tx = this.parseTransactionLine(line);
      if (tx) transactions.push(tx);
    }
    return transactions;
  }

  extractFromTableFormat(lines) {
    const transactions = [];
    for (const line of lines) {
      const tx = this.parseTransactionLine(line);
      if (tx) transactions.push(tx);
    }
    return transactions;
  }

  extractFromLineFormat(lines) {
    const transactions = [];
    let pending = null;

    for (const line of lines) {
      const direct = this.parseTransactionLine(line);
      if (direct) {
        if (pending) transactions.push(pending);
        pending = direct;
        continue;
      }

      if (pending && pending.description.length < 180 && !this.findDate(line)) {
        const continuation = line.replace(/\s+/g, ' ').trim();
        if (continuation && !this.looksLikeHeader(continuation)) {
          pending.description = `${pending.description} ${continuation}`.trim().substring(0, 200);
        }
      }
    }

    if (pending) transactions.push(pending);
    return transactions;
  }

  extractGenericTransactions(lines) {
    const transactions = [];
    for (const line of lines) {
      const dateMatch = this.findDate(line);
      if (!dateMatch) continue;
      const amounts = this.findAmountsAfterDate(line, dateMatch);
      if (amounts.length === 0) continue;

      const description = this.extractDescription(line, dateMatch.index);
      if (!description) continue;

      transactions.push({
        date: dateMatch.date,
        description,
        amount: Math.abs(amounts[0]),
        type: this.determineTransactionType(line),
      });
    }
    return transactions;
  }

  // Relaxed extraction for PDFs with non-standard formats
  extractRelaxedTransactions(lines) {
    const transactions = [];

    for (const line of lines) {
      // Skip very short lines or header-like lines
      if (line.length < 10 || this.looksLikeHeader(line)) continue;

      // Try to find any date in the line
      const dateMatch = this.findDate(line);
      if (!dateMatch) continue;

      // Get part after date
      const afterDate = line.substring(dateMatch.index + dateMatch.match.length).trim();

      // Find amounts (numbers that look like money) after the date
      const amounts = [];
      const amountRegex = /(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)/g;
      let match;
      while ((match = amountRegex.exec(afterDate)) !== null) {
        const numStr = match[1].replace(/,/g, '');
        const num = parseFloat(numStr);
        if (num >= 10 && num < 10000000) {
          if (!amounts.some(a => Math.abs(a - num) < 0.01)) {
            amounts.push(num);
          }
        }
      }

      if (amounts.length === 0) continue;

      // Get description
      let description = afterDate
        .replace(/[\d,]+\.?\d*/g, '')
        .replace(/-/g, ' ')
        .replace(/[()ν₹]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (description.length < 2) {
        description = 'Bank Transaction';
      }

      transactions.push({
        date: dateMatch.date,
        description: description.substring(0, 200),
        amount: Math.abs(amounts[0]),
        type: this.determineTransactionType(line),
      });
    }

    return transactions;
  }

  // More relaxed amount finding
  findRelaxedAmounts(line) {
    const amounts = [];
    // Match numbers that look like money (with or without decimals)
    const patterns = [
      /(?:Rs\.?|INR|₹|ν)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)/g,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g,
      /(\d+\.\d{1,2})/g,
      /\b(\d{2,7})\b/g,  // Simple whole numbers (2-7 digits)
    ];

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.source, 'g');
      while ((match = regex.exec(line)) !== null) {
        const numStr = match[1].replace(/,/g, '');
        const num = parseFloat(numStr);
        // Filter out likely non-money numbers (years, small numbers, etc.)
        if (num >= 10 && num < 10000000) {
          // Avoid adding duplicates
          if (!amounts.some(a => Math.abs(a - num) < 0.01)) {
            amounts.push(num);
          }
        }
      }
    }

    return amounts;
  }

  // Special extraction for table format with Debit/Credit columns
  extractTableTransactions(lines) {
    const transactions = [];
    let hasDebitCreditHeader = false;

    // Check if this looks like a table with Debit/Credit columns
    for (const line of lines) {
      if (/debit.*credit|credit.*debit|withdrawal.*deposit/i.test(line)) {
        hasDebitCreditHeader = true;
        break;
      }
    }

    if (!hasDebitCreditHeader) return transactions;

    for (const line of lines) {
      if (this.looksLikeHeader(line)) continue;

      const dateMatch = this.findDate(line);
      if (!dateMatch) continue;

      // Get the part after the date
      const afterDate = line.substring(dateMatch.index + dateMatch.match.length).trim();

      // Find all numbers in the line after the date (excluding the date digits)
      const amounts = [];
      const amountRegex = /(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)/g;
      let match;
      while ((match = amountRegex.exec(afterDate)) !== null) {
        const numStr = match[1].replace(/,/g, '');
        const num = parseFloat(numStr);
        // Filter: must be reasonable amount (not year, not tiny)
        if (num >= 10 && num < 10000000) {
          amounts.push(num);
        }
      }

      if (amounts.length === 0) continue;

      // First amount is typically debit/withdrawal, ignore balance (last amount)
      const amount = amounts[0];

      // Get description (text between date and numbers)
      let description = afterDate
        .replace(/[\d,]+\.?\d*/g, '')
        .replace(/-/g, ' ')
        .replace(/[()ν₹]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (description.length < 2) {
        description = 'Bank Transaction';
      }

      // Determine type based on keywords
      let type = 'expense';
      if (/credit|salary|deposit|received|refund|credited/i.test(line)) {
        type = 'income';
      }

      transactions.push({
        date: dateMatch.date,
        description: description.substring(0, 200),
        amount: Math.abs(amount),
        type,
      });
    }

    return transactions;
  }

  parseTransactionLine(line) {
    const dateMatch = this.findDate(line);
    if (!dateMatch) return null;

    const afterDate = line.substring(dateMatch.index + dateMatch.match.length).trim();
    if (!afterDate) return null;

    const amounts = this.extractAmountCandidates(afterDate);
    if (amounts.length === 0) return null;

    const selected = this.selectTransactionAmount(afterDate, amounts);
    if (!selected || selected.value <= 0) return null;

    let type;
    if (selected.marker === 'CR') type = 'income';
    else if (selected.marker === 'DR') type = 'expense';
    else type = this.determineTransactionType(afterDate);

    let description = this.cleanDescription(afterDate, selected.raw);
    // Allow shorter descriptions, use fallback if too short
    if (!description || description.length < 2) {
      description = 'Bank Transaction';
    }

    return {
      date: dateMatch.date,
      description,
      amount: Math.abs(selected.value),
      type,
    };
  }

  extractAmountCandidates(text) {
    const candidates = [];
    // More flexible amount patterns
    const amountPatterns = [
      // Standard format with optional currency and CR/DR markers
      /((?:INR|Rs\.?|₹)?\s*\(?-?\d[\d,]*(?:\.\d{1,2})?\)?\s*(?:CR|DR|Cr|Dr|C|D)?)/g,
      // Simple decimal numbers
      /(\d{1,3}(?:,\d{3})*\.\d{2})/g,
      // Indian format numbers (e.g., 1,00,000)
      /(\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d{2})?)/g,
    ];

    for (const amountRegex of amountPatterns) {
      let match;
      while ((match = amountRegex.exec(text)) !== null) {
        const raw = (match[1] || '').trim();
        if (!raw) continue;

        const parsed = this.parseAmountToken(raw);
        if (!parsed) continue;

        // More lenient filtering
        const hasDecimal = /\.\d{1,2}\b/.test(raw);
        const digitCount = (raw.match(/\d/g) || []).length;

        // Allow amounts without decimals if they have fewer digits
        if (!hasDecimal && !parsed.marker && digitCount >= 8) continue;
        if (parsed.value > 99999999) continue;
        if (parsed.value < 1) continue;

        // Avoid duplicates
        const isDuplicate = candidates.some(c => Math.abs(c.value - parsed.value) < 0.01);
        if (isDuplicate) continue;

        candidates.push({
          raw,
          value: parsed.value,
          marker: parsed.marker,
          index: match.index,
        });
      }
    }

    return candidates;
  }

  parseAmountToken(raw) {
    const markerMatch = raw.match(/\b(CR|DR|Cr|Dr|C|D)\b\s*$/);
    const markerRaw = markerMatch ? markerMatch[1].toUpperCase() : '';
    const marker = markerRaw === 'C' ? 'CR' : markerRaw === 'D' ? 'DR' : markerRaw;

    const negative = /^\(/.test(raw) || /-/.test(raw) || marker === 'DR';

    const cleaned = raw
      .replace(/\b(CR|DR|Cr|Dr|C|D)\b\s*$/g, '')
      .replace(/INR|Rs\.?/g, '')
      .replace(/[()\s]/g, '')
      .replace(/,/g, '');

    const value = parseFloat(cleaned);
    if (Number.isNaN(value) || value <= 0) return null;

    return { value: Math.abs(value), marker: marker || (negative ? 'DR' : '') };
  }

  selectTransactionAmount(lineAfterDate, amounts) {
    if (amounts.length === 0) return null;

    const withMarker = amounts.find((a) => a.marker === 'CR' || a.marker === 'DR');
    if (withMarker) return withMarker;

    const balanceIndex = lineAfterDate.toLowerCase().search(/\bbal(?:ance)?\b/);
    if (balanceIndex >= 0) {
      const beforeBalance = amounts.filter((a) => a.index < balanceIndex);
      if (beforeBalance.length > 0) return beforeBalance[0];
    }

    if (amounts.length >= 2) {
      return amounts[0];
    }

    return amounts[0];
  }

  looksLikeHeader(line) {
    return /date|description|narration|balance|withdrawal|deposit|debit|credit|opening|closing/i.test(line);
  }

  findDate(line) {
    for (const pattern of this.datePatterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const date = this.parseDate(match[0]);
      if (!date) continue;

      return {
        match: match[0],
        index: line.indexOf(match[0]),
        date,
      };
    }
    return null;
  }

  findAllDates(text) {
    const results = [];

    for (const pattern of this.datePatterns) {
      const regex = new RegExp(pattern.source, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const date = this.parseDate(match[0]);
        if (!date) continue;
        results.push({ match: match[0], index: match.index, date });
      }
    }

    return results.sort((a, b) => a.index - b.index);
  }

  parseDate(dateStr) {
    const raw = dateStr.trim();
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    // DD-Mon-YYYY or DD/Mon/YYYY (e.g., 05-Mar-2026)
    let parts = raw.match(/^(\d{1,2})[-\/]([A-Za-z]+)[-\/](\d{4})$/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = monthNames.findIndex((m) => parts[2].toLowerCase().startsWith(m));
      const year = parseInt(parts[3], 10);
      if (month >= 0) return this.toSafeDate(year, month, day);
    }

    // DD Mon YYYY (e.g., 05 Mar 2026)
    parts = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = monthNames.findIndex((m) => parts[2].toLowerCase().startsWith(m));
      const year = parseInt(parts[3], 10);
      if (month >= 0) return this.toSafeDate(year, month, day);
    }

    // YYYY-MM-DD
    parts = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (parts) {
      const year = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const day = parseInt(parts[3], 10);
      return this.toSafeDate(year, month, day);
    }

    // DD/MM/YYYY or DD-MM-YYYY
    parts = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const year = parseInt(parts[3], 10);
      return this.toSafeDate(year, month, day);
    }

    // DD/MM/YY or DD-MM-YY
    parts = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      let year = parseInt(parts[3], 10);
      year += year < 50 ? 2000 : 1900;
      return this.toSafeDate(year, month, day);
    }

    return null;
  }

  toSafeDate(year, month, day) {
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = new Date(year, month, day);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  findAmounts(line) {
    return this.extractAmountCandidates(line).map((a) => a.value);
  }

  findAmountsAfterDate(line, dateMatch) {
    if (!dateMatch) return this.findAmounts(line);
    const afterDate = line.substring(dateMatch.index + dateMatch.match.length);
    return this.extractAmountCandidates(afterDate).map((a) => a.value);
  }

  determineTransactionType(text) {
    const lower = text.toLowerCase();
    for (const keyword of this.creditKeywords) {
      if (lower.includes(keyword)) return 'income';
    }
    for (const keyword of this.debitKeywords) {
      if (lower.includes(keyword)) return 'expense';
    }
    return 'expense';
  }

  cleanDescription(textAfterDate, selectedAmountRaw = '') {
    let description = textAfterDate;

    if (selectedAmountRaw) {
      const escaped = selectedAmountRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      description = description.replace(new RegExp(escaped, 'g'), ' ');
    }

    description = description
      .replace(/\b(CR|DR|C|D)\b/gi, ' ')
      .replace(/\b\d{1,4}[\/-]\d{1,4}[\/-]\d{2,4}\b/g, ' ')
      .replace(/\b\d{6,}\b/g, ' ')
      .replace(/[|+=]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return description.substring(0, 200);
  }

  extractDescription(line, dateIndex) {
    const afterDate = line.substring(dateIndex).replace(/^[\d\s\/.\-]+/, '').trim();
    return this.cleanDescription(afterDate);
  }

  validateTransactions(transactions) {
    const valid = [];
    const seen = new Set();
    const dateAmountPairs = new Map();

    for (const tx of transactions) {
      if (!tx?.date || !tx?.amount || tx.amount <= 0) continue;
      if (Number.isNaN(tx.date.getTime())) continue;

      // Allow dates up to 2 years in the future (for testing/sample data)
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 2);
      if (tx.date > maxDate) continue;

      const normalizedDescription = (tx.description || 'Bank transaction').trim();
      const dateStr = tx.date.toISOString().split('T')[0];
      const amountStr = Number(tx.amount).toFixed(2);

      // Create multiple keys for deduplication
      const exactKey = `${dateStr}-${amountStr}-${normalizedDescription.slice(0, 30).toLowerCase()}`;
      const dateAmountKey = `${dateStr}-${amountStr}`;

      // Skip if exact match already seen
      if (seen.has(exactKey)) continue;

      // Skip if same date+amount combo exists with similar description
      if (dateAmountPairs.has(dateAmountKey)) {
        const existingDesc = dateAmountPairs.get(dateAmountKey);
        const currentDesc = normalizedDescription.toLowerCase();
        // Check if one description contains the other (common in duplicate extractions)
        if (existingDesc.includes(currentDesc.slice(0, 15)) ||
            currentDesc.includes(existingDesc.slice(0, 15))) {
          continue;
        }
      }

      seen.add(exactKey);
      dateAmountPairs.set(dateAmountKey, normalizedDescription.toLowerCase());

      const type = tx.type === 'income' ? 'income' : 'expense';
      const category = this.categorizeTransaction(normalizedDescription, type);
      const paymentMethod = this.detectPaymentMethod(normalizedDescription, type);

      valid.push({
        date: tx.date,
        description: normalizedDescription.substring(0, 200),
        amount: parseFloat(Number(tx.amount).toFixed(2)),
        type,
        category,
        paymentMethod,
        importSource: 'pdf',
      });
    }

    return valid;
  }

  categorizeTransaction(description, type) {
    const desc = description.toLowerCase();
    
    // Income categories
    if (type === 'income') {
      if (/salary|payroll|wages|compensation/.test(desc)) return 'Salary';
      if (/freelance|contract|consulting|commission/.test(desc)) return 'Freelance';
      if (/business|revenue|sales|brokerage|reimbursement/.test(desc)) return 'Business';
      if (/interest|dividend|sip|mutual|stock|investment|bonus/.test(desc)) return 'Investment';
      return 'Other';
    }

    // Expense categories - must match VALID_CATEGORIES in transactions.js exactly
    if (/food|restaurant|cafe|zomato|swiggy|hotel|meal|dining|burger|pizza/.test(desc)) 
      return 'Food & Dining';
    if (/uber|ola|metro|bus|train|taxi|petrol|fuel|auto|transport|cab|bike|bike rental/.test(desc)) 
      return 'Transport';
    if (/amazon|flipkart|myntra|shopping|store|mall|ebay|gift|purchase|shop|retail/.test(desc)) 
      return 'Shopping';
    if (/netflix|spotify|movie|entertainment|hotstar|disney|theatre|cinema|game|music|premium/.test(desc)) 
      return 'Entertainment';
    if (/hospital|doctor|health|clinic|medical|pharma|medicine|healthcare|dental|pharmacy|therapy/.test(desc)) 
      return 'Healthcare';
    if (/electric|water|internet|bill|recharge|mobile|wifi|airtel|jio|broadband|DTH|phone/.test(desc)) 
      return 'Utilities';
    if (/rent|maintenance|society|apartment|flat|lease|property|landlord|housing|deposit/.test(desc)) 
      return 'Housing';
    if (/school|college|education|tuition|course|fee|university|training|institute/.test(desc)) 
      return 'Education';
    if (/flight|travel|trip|vacation|oyo|airbnb|hotel|resort|hostel|tourism/.test(desc)) 
      return 'Travel';
    if (/loan|emi|credit card|installment|payment|mortgage|debt|repayment/.test(desc)) 
      return 'EMI & Loans';
    if (/insurance|policy|premium|claim|coverage/.test(desc)) 
      return 'Insurance';
    if (/subscription|membership|subscription/.test(desc)) 
      return 'Subscriptions';
    if (/gift|donation|charity|contribution|offering/.test(desc)) 
      return 'Gifts & Donations';
    if (/charge|fee|gst|bank|service fee|penalty|interest/.test(desc)) 
      return 'Bank Charges';
    
    return 'Other';
  }

  detectStatementFormat(text) {
    const lower = text.toLowerCase();

    return {
      bank: this.detectBank(text),
      format: /date\s+description\s+.*(debit|credit|balance)/i.test(text) ? 'table' : 'statement',
      hasRunningBalance: /\bbalance\b/.test(lower),
      dateFormat: /\d{2}\/\d{2}\/\d{4}/.test(text)
        ? 'DD/MM/YYYY'
        : /\d{4}-\d{2}-\d{2}/.test(text)
          ? 'YYYY-MM-DD'
          : /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text)
            ? 'DD-Mon-YYYY'
            : 'unknown',
      confidence: text.split('\n').length > 20 ? 'medium' : 'low',
    };
  }

  getSupportedBanks() {
    return Object.keys(this.bankPatterns).map((bank) => bank.charAt(0).toUpperCase() + bank.slice(1));
  }

  detectPaymentMethod(description, type) {
    const desc = description.toLowerCase();
    
    for (const keyword of this.upiKeywords) {
      if (desc.includes(keyword)) {
        return 'upi';
      }
    }
    
    if (/neft|rtgs|imps|transfer|bank.*transfer/i.test(desc)) {
      return 'bank_transfer';
    }
    
    if (/cash|atm|withdrawal/i.test(desc)) {
      return 'cash';
    }
    
    if (/card|credit.*card|debit.*card|pos|swipe/i.test(desc)) {
      return 'card';
    }
    
    return 'other';
  }
}

module.exports = new PdfParserService();
