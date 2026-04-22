/**
 * Enhanced Receipt OCR Service (Integrated)
 * Combines preprocessing + improved parsing + OCR alternatives
 * 
 * Usage:
 * const service = require('./services/enhancedReceiptService');
 * const result = await service.processReceiptImage(imagePath, { preprocess: true });
 */

const fs = require('fs');
const path = require('path');
const preprocessor = require('./receiptPreprocessor');
const improvedParser = require('./improvedReceiptParser');
const indianParser = require('./indianReceiptParser');
const ocrAlternatives = require('./ocrAlternatives');
const Tesseract = require('tesseract.js');

/**
 * Main function - Process receipt image end-to-end
 * @param {string} imagePath - Path to receipt image
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Structured receipt data
 */
async function processReceiptImage(imagePath, options = {}) {
  const {
    preprocess = true,
    ocrProvider = 'tesseract',
    useIndianParser = true,
    saveDebugImages = false,
    debugOutputDir = './receipt-debug',
    maxRetries = 1,
    timeout = 30000
  } = options;

  const startTime = Date.now();
  const result = {
    status: 'processing',
    file: path.basename(imagePath),
    timestamps: { started: new Date().toISOString() },
    steps: {},
    extracted: null,
    warnings: [],
    errors: []
  };

  try {
    // Step 1: Validate input
    result.steps.validation = { status: 'running' };
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
    result.steps.validation = { status: 'completed' };

    // Step 2: Get preprocessing recommendations
    result.steps.analysis = { status: 'running' };
    const recommendations = await preprocessor.getPreprocessingRecommendations(imagePath);
    result.steps.analysis = {
      status: 'completed',
      imageSize: recommendations.originalSize,
      suggestedActions: recommendations.suggestedActions
    };

    // Step 3: Preprocess image
    let processedImageBuffer = null;
    if (preprocess) {
      result.steps.preprocessing = { status: 'running' };
      try {
        processedImageBuffer = await preprocessor.preprocessReceipt(imagePath, {
          contrast: 1.5,
          grayscale: true,
          denoise: true,
          targetWidth: 1024
        });

        // Save debug image if requested
        if (saveDebugImages) {
          const debugPath = path.join(debugOutputDir, `${Date.now()}_preprocessed.png`);
          await preprocessor.savePreprocessedImage(processedImageBuffer, debugPath);
          result.steps.preprocessing.debugPath = debugPath;
        }

        result.steps.preprocessing = { status: 'completed' };
      } catch (error) {
        result.warnings.push(`Preprocessing failed: ${error.message}, using original image`);
        result.steps.preprocessing = { status: 'failed', error: error.message };
        processedImageBuffer = null;
      }
    }

    // Step 4: OCR Processing
    result.steps.ocr = { status: 'running', provider: ocrProvider };
    let ocrText = null;
    let ocrResult = null;

    try {
      if (ocrProvider.toLowerCase() === 'tesseract') {
        ocrResult = await performTesseractOCR(
          processedImageBuffer || imagePath,
          maxRetries,
          timeout
        );
      } else {
        ocrResult = await ocrAlternatives.processReceiptWithProvider(
          imagePath,
          { provider: ocrProvider, fallback: true }
        );
      }

      if (ocrResult.success) {
        ocrText = ocrResult.text || ocrResult.rawText;
        result.steps.ocr = {
          status: 'completed',
          provider: ocrProvider,
          confidence: ocrResult.metadata?.confidence || 'N/A',
          textLength: ocrText.length
        };
      } else {
        throw new Error(ocrResult.error || 'OCR failed');
      }
    } catch (error) {
      result.steps.ocr = { status: 'failed', error: error.message };
      result.errors.push(`OCR failed with provider ${ocrProvider}: ${error.message}`);
      throw error;
    }

    // Step 5: Parse receipt
    result.steps.parsing = { status: 'running' };
    let parsed;

    try {
      // Check if Indian receipt
      if (useIndianParser && indianParser.isIndianReceipt(ocrText)) {
        parsed = indianParser.parseIndianReceipt(ocrText);
        result.steps.parsing = {
          status: 'completed',
          parserUsed: 'indianParser',
          itemsFound: parsed.items?.length || 0
        };
      } else {
        // Use improved general parser
        parsed = improvedParser.parseImprovedReceipt(ocrText, { useIndianParser });
        result.steps.parsing = {
          status: 'completed',
          parserUsed: 'improvedParser',
          itemsFound: parsed.items?.length || 0,
          confidence: parsed.quality?.confidence
        };
      }
    } catch (error) {
      result.steps.parsing = { status: 'failed', error: error.message };
      result.errors.push(`Parsing failed: ${error.message}`);
      throw error;
    }

    // Step 6: Validation & Enhancement
    result.steps.validation = { status: 'running' };
    try {
      parsed = enhanceAndValidateReceipt(parsed, ocrText);
      result.steps.validation = { status: 'completed' };
    } catch (error) {
      result.warnings.push(`Validation step failed: ${error.message}`);
      result.steps.validation = { status: 'completed_with_warnings' };
    }

    // Build final result
    result.status = 'completed';
    result.extracted = {
      store: parsed.storeName || parsed.metadata?.store,
      date: parsed.date || parsed.metadata?.date,
      items: parsed.items || [],
      subtotal: parsed.subtotal || parsed.metadata?.subtotal,
      tax: parsed.totalTax || parsed.metadata?.tax,
      total: parsed.total || parsed.metadata?.total,
      paymentMethod: parsed.paymentMethod,
      confidence: parsed.confidence || parsed.quality?.confidence || 'N/A'
    };

    result.timestamps.completed = new Date().toISOString();
    result.processingTimeMs = Date.now() - startTime;

    return result;

  } catch (error) {
    result.status = 'failed';
    result.errors.push({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    result.timestamps.failed = new Date().toISOString();
    result.processingTimeMs = Date.now() - startTime;

    return result;
  }
}

/**
 * Perform OCR using Tesseract with retries
 * @param {string|Buffer} imageInput - Path or buffer
 * @param {number} maxRetries - Max retry attempts
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Object>}
 */
async function performTesseractOCR(imageInput, maxRetries = 1, timeout = 30000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tesseract OCR attempt ${attempt + 1}/${maxRetries + 1}...`);

      const imageBuffer = typeof imageInput === 'string'
        ? fs.readFileSync(imageInput)
        : imageInput;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tesseract OCR timeout')), timeout)
      );

      const ocrPromise = Tesseract.recognize(imageBuffer, 'eng', {
        config: '--psm 11 --oem 2',  // PSM 11: Sparse text (BEST for receipts), OEM 2: Legacy + Neural
        langPath: path.join(__dirname, '..'), // Use local .traineddata files in backend root
        logger: (m) => {
          if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 25 === 0) {
            console.log(`Tesseract: ${m.status} - ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const { data: { text } } = await Promise.race([ocrPromise, timeoutPromise]);

      return {
        success: true,
        text: text,
        provider: 'tesseract',
        metadata: { confidence: 0.75 }
      };
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1} failed: ${error.message}`);

      if (attempt < maxRetries) {
        console.log(`Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  return {
    success: false,
    error: lastError.message || 'Tesseract OCR failed'
  };
}

/**
 * Enhance and validate parsed receipt
 * @param {Object} parsed - Parsed receipt data
 * @param {string} ocrText - Original OCR text for reference
 * @returns {Object} - Enhanced receipt
 */
function enhanceAndValidateReceipt(parsed, ocrText) {
  // Remove items that appear to be duplicates
  const uniqueItems = [];
  const seen = new Set();

  for (const item of parsed.items || []) {
    const key = `${item.item?.toLowerCase()}|${item.amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  parsed.items = uniqueItems;

  // Verify total makes sense
  if (parsed.items && parsed.total) {
    const itemSum = parsed.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const estimatedTotal = itemSum + (parsed.totalTax || 0);

    // If total is significantly different, flag it
    if (Math.abs(estimatedTotal - parsed.total) > estimatedTotal * 0.05) {
      parsed.validationWarnings = parsed.validationWarnings || [];
      parsed.validationWarnings.push(
        `Total (${parsed.total}) may be incorrect. Sum of items: ${itemSum}, tax: ${parsed.totalTax}`
      );
    }
  }

  // Fill missing categories
  for (const item of parsed.items || []) {
    if (!item.category) {
      item.category = improvedParser.inferCategory(item.item);
    }
  }

  return parsed;
}

/**
 * Batch process multiple receipt images
 * @param {Array<string>} imagePaths - Array of image paths
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Results array
 */
async function batchProcessReceipts(imagePaths, options = {}) {
  const results = [];
  const concurrency = options.concurrency || 2;

  console.log(`Processing ${imagePaths.length} receipts with concurrency=${concurrency}...`);

  for (let i = 0; i < imagePaths.length; i += concurrency) {
    const batch = imagePaths.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(imagePath => processReceiptImage(imagePath, options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Get OCR provider comparison
 * @param {string} imagePath - Image to test
 * @returns {Promise<Object>} - Comparison results
 */
async function getProviderComparison(imagePath) {
  return ocrAlternatives.compareOCRProviders(imagePath);
}

module.exports = {
  processReceiptImage,
  batchProcessReceipts,
  performTesseractOCR,
  enhanceAndValidateReceipt,
  getProviderComparison,
  // Re-export for convenience
  preprocessor,
  improvedParser,
  indianParser,
  ocrAlternatives
};
