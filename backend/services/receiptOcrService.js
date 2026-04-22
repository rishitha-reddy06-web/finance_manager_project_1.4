const Tesseract = require('tesseract.js');
const fs = require('fs');

/**
 * Normalizes category by checking keywords in the raw text
 */
function normalizeCategory(text) {
    if (!text) return 'Other';  
    const lower = text.toLowerCase();

    // 1. Food & Dining: Includes Groceries, Dairy, Bakery, Produce, etc.
    if (
        lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe') ||
        lower.includes('dining') || lower.includes('grocery') || lower.includes('supermarket') ||
        lower.includes('milk') || lower.includes('dairy') || lower.includes('bread') ||
        lower.includes('bakery') || lower.includes('fruit') || lower.includes('veg') ||
        lower.includes('meat') || lower.includes('chicken') || lower.includes('egg') ||
        lower.includes('drink') || lower.includes('bev') || lower.includes('snack') ||
        lower.includes('candy') || lower.includes('lunch') || lower.includes('dinner') ||
        lower.includes('breakf') || lower.includes('tea') || lower.includes('coffee') ||
        lower.includes('sugar') || lower.includes('salt') || lower.includes('oil') ||
        lower.includes('spic') || lower.includes('rice') || lower.includes('atta')
    ) return 'Food & Dining';

    // 2. Shopping / Household: Cleaning, clothes, etc.
    if (
        lower.includes('shopping') || lower.includes('mart') || lower.includes('store') ||
        lower.includes('detergent') || lower.includes('soap') || lower.includes('shampoo') ||
        lower.includes('household') || lower.includes('clean') || lower.includes('clot') ||
        lower.includes('shirt') || lower.includes('pant') || lower.includes('shoe') ||
        lower.includes('fashion') || lower.includes('gift') || lower.includes('perfume') ||
        lower.includes('watch') || lower.includes('bag')
    ) return 'Shopping';

    // Transport
    if (
        lower.includes('uber') || lower.includes('lyft') || lower.includes('taxi') ||
        lower.includes('transport') || lower.includes('gas') || lower.includes('fuel') ||
        lower.includes('petrol') || lower.includes('diesel') || lower.includes('parking')
    ) return 'Transport';

    // Healthcare
    if (
        lower.includes('pharmacy') || lower.includes('health') || lower.includes('hospital') ||
        lower.includes('clinic') || lower.includes('medicine') || lower.includes('drug') ||
        lower.includes('vitamin')
    ) return 'Healthcare';

    // Entertainment
    if (
        lower.includes('movie') || lower.includes('cinema') || lower.includes('show') ||
        lower.includes('concert') || lower.includes('game') || lower.includes('fun') ||
        lower.includes('ticket')
    ) return 'Entertainment';

    return 'Other';
}

/**
 * Extracts line items, amount, date, and merchant from raw OCR text
 */
function parseReceiptText(text) {
    const result = {
        amount: null,
        date: null,
        merchant: '',
        category: 'Other',
        items: [],
        rawText: text
    };

    if (!text) return result;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 1. Extract Merchant
    for (let line of lines) {
        if (line.match(/[A-Za-z]{3,}/) && !line.match(/date|total|amount|receipt|item|tax|qty/i)) {
            result.merchant = line.substring(0, 50).trim();
            break;
        }
    }

    // 2. Extract Date
    const dateRegex = /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?,\s+\d{4}\b/gi;
    let m;
    while ((m = dateRegex.exec(text)) !== null) {
        const d = new Date(m[0]);
        if (!isNaN(d.getTime())) {
            result.date = d.toISOString().slice(0, 10);
            break;
        }
    }
    if (!result.date) result.date = new Date().toISOString().slice(0, 10);

    // 3. Extract Line Items (Improved Logic)
    // Regex for: Item Name ... Price (anywhere in line)
    const itemRegex = /(.+?)\s+[:$₹]?\s*(\d{1,6}(?:[\.,]\d{1,2})?)\s*(?:[A-Z*]|tax|each|qty)?\s*$/i;

    for (let line of lines) {
        // Cleaning line from common artifacts
        line = line.replace(/^\s*[\-\*•]\s+/, ''); // Remove bullets/dashes

        // 1. Skip lines that definitely look like metadata or totals
        if (line.match(/\btotal\b|\bsubtotal\b|\btax\b|\bcash\b|\bchange\b|due|paid|balance|\bvisa\b|\bmastercard\b|\bcard\b|\*\*\*\*|auth|ref|terminal|store|date|time/i)) {
            continue;
        }

        // 2. Try matching the item regex
        const match = line.match(itemRegex);
        if (match) {
            const name = match[1].trim();
            const amountStr = match[2].replace(',', '.');
            const amount = parseFloat(amountStr);

            // Refined validation
            if (name.length >= 2 && !name.match(/^\d+$/) && amount > 0 && amount < 100000) {
                result.items.push({
                    description: name,
                    amount: amount,
                    category: normalizeCategory(name),
                    type: 'expense'
                });
            }
        }
    }

    // 4. Extract Total Amount (fallback or verification)
    const totalRegex = /(?:total|sum|due|balance|paid)\s*[:$₹]?\s*(\d{1,5}[\.,]\d{2})\b/gi;
    let maxAmount = 0;
    while ((m = totalRegex.exec(text)) !== null) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(val) && val > maxAmount) maxAmount = val;
    }

    // If no items found, try the general amount extraction from before
    if (result.items.length === 0) {
        const anyAmountRegex = /[:$₹]?\s*(\d{1,5}[\.,]\d{2})\b/g;
        while ((m = anyAmountRegex.exec(text)) !== null) {
            const val = parseFloat(m[1].replace(',', '.'));
            if (!isNaN(val) && val > maxAmount) maxAmount = val;
        }
    }

    result.amount = maxAmount;
    result.category = normalizeCategory(result.merchant + " " + text);

    return result;
}

/**
 * Runs OCR on the given image path and parses the result
 */
async function processReceipt(imagePath) {
    try {
        // Read file into buffer to avoid extension issues
        const imageBuffer = fs.readFileSync(imagePath);
        const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
          config: '--psm 6 --oem 2'  // PSM 6: Single text block (optimal for receipts), OEM 2: Legacy + Neural
        });
        const parsed = parseReceiptText(text);
        return {
            success: true,
            ...parsed
        };
    } catch (err) {
        console.error("OCR Error:", err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    processReceipt,
    parseReceiptText
};
