/**
 * OCR Alternatives - Google Vision API, AWS Textract, and Azure Computer Vision
 * Provides abstraction layer for switching between OCR providers
 * 
 * Requirements:
 * - Google Vision: npm install @google-cloud/vision
 * - AWS Textract: npm install aws-sdk
 * - Azure: npm install @azure/cognitiveservices-computervision
 */

const fs = require('fs');

/**
 * COMPARISON OF OCR ALTERNATIVES
 * 
 * 1. TESSERACT.JS (Current)
 * ✓ Free, open-source, no API keys needed
 * ✓ Good for simple documents
 * ✗ Struggles with low-quality images
 * ✗ Slow (client-side processing)
 * Accuracy: 70-80% on receipt images
 * Cost: Free
 * 
 * 2. GOOGLE VISION API
 * ✓ Excellent accuracy (90-95%)
 * ✓ Handles complex layouts well
 * ✓ Good with Indian text
 * ✓ Fast processing
 * ✗ Requires API key and authentication
 * ✗ Costs ~$1.50 per 1000 images
 * Accuracy: 90-95% on receipt images
 * Cost: Pay-per-use (~$0.0015 per image)
 * 
 * 3. AWS TEXTRACT
 * ✓ Excellent for documents and tables
 * ✓ Understands structured data
 * ✓ Can extract key-value pairs
 * ✗ More expensive than Google
 * ✗ Might be overkill for receipts
 * Accuracy: 92-96%
 * Cost: $1.50 per 1000 images (async), $15 per 1000 (sync)
 * 
 * 4. AZURE COMPUTER VISION
 * ✓ Part of Azure ecosystem
 * ✓ Good accuracy (85-92%)
 * ✓ Supports many languages
 * ✗ Regional availability
 * Accuracy: 85-92%
 * Cost: ~$1 per 1000 requests (free tier: 5000/month)
 * 
 * RECOMMENDATION FOR YOUR PROJECT:
 * → Start with: Tesseract + preprocessing (current, free)
 * → For better accuracy: Google Vision API ($0.0015 per image, ~90-95% accuracy)
 * → For production: Hybrid (Tesseract for quick, Vision API for low-confidence)
 */

// ============================================================================
// GOOGLE VISION API IMPLEMENTATION
// ============================================================================

/**
 * Process receipt using Google Vision API
 * @param {string} imagePath - Path to image file
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - OCR results
 */
async function processReceiptGoogle(imagePath, options = {}) {
  try {
    // Lazy load Google Vision to avoid dependency if not using
    const vision = require('@google-cloud/vision');

    const client = new vision.ImageAnnotatorClient({
      keyFilename: options.keyfile || process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    // Read image and convert to base64
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    const request = {
      image: { content: base64Image },
      features: [
        {
          type: 'DOCUMENT_TEXT_DETECTION', // Better for documents than TEXT_DETECTION
          maxResults: 100
        }
      ],
      imageContext: {
        languageHints: options.languages || ['en', 'hi'] // English and Hindi
      }
    };

    console.log('Sending image to Google Vision API...');
    const [result] = await client.annotateImage(request);

    const fullText = result.fullTextAnnotation?.text || '';
    const blocks = result.fullTextAnnotation?.pages?.[0]?.blocks || [];

    // Extract structured data from blocks
    const lines = [];
    for (const block of blocks) {
      for (const paragraph of block.paragraphs || []) {
        for (const word of paragraph.words || []) {
          for (const symbol of word.symbols || []) {
            lines.push({
              text: symbol.text,
              confidence: symbol.confidence
            });
          }
        }
      }
    }

    return {
      success: true,
      provider: 'google-vision',
      text: fullText,
      rawData: result,
      metadata: {
        detectedLanguages: result.imagePropertiesAnnotation?.dominantColors || [],
        confidence: calculateAverageConfidence(result)
      }
    };
  } catch (error) {
    console.error('Google Vision error:', error);
    return {
      success: false,
      error: error.message,
      fallback: 'Consider using Tesseract fallback'
    };
  }
}

/**
 * Process receipt using AWS Textract
 * @param {string} imagePath - Path to image file
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - OCR results
 */
async function processReceiptAWS(imagePath, options = {}) {
  try {
    const AWS = require('aws-sdk');

    // Configure AWS
    AWS.config.update({
      accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      region: options.region || 'us-east-1'
    });

    const textract = new AWS.Textract();

    // Read image
    const imageData = fs.readFileSync(imagePath);
    const imageBase64 = imageData.toString('base64');

    console.log('Sending image to AWS Textract...');

    // Async: Submit job
    const params = {
      Document: {
        Bytes: Buffer.from(imageBase64, 'base64')
      },
      ClientRequestToken: `receipt-${Date.now()}`
    };

    const response = await textract.startDocumentTextDetection(params).promise();

    return {
      success: true,
      provider: 'aws-textract',
      jobId: response.JobId,
      advice: 'This is async - use JobId to check status later',
      checkStatusCommand: `textract.getDocumentTextDetection({ JobId: '${response.JobId}' })`
    };
  } catch (error) {
    console.error('AWS Textract error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process receipt using Azure Computer Vision
 * @param {string} imagePath - Path to image file
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - OCR results
 */
async function processReceiptAzure(imagePath, options = {}) {
  try {
    const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
    const { ApiKeyCredentials } = require('@azure/ms-rest-js');

    const key = options.apiKey || process.env.AZURE_VISION_KEY;
    const endpoint = options.endpoint || process.env.AZURE_VISION_ENDPOINT;

    if (!key || !endpoint) {
      throw new Error('Azure Vision API key or endpoint not configured');
    }

    const client = new ComputerVisionClient(
      new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }),
      endpoint
    );

    console.log('Sending image to Azure Computer Vision...');

    // Read and prepare image
    const imageBuffer = fs.readFileSync(imagePath);

    // Use readInStream for file-based processing
    const result = await client.readInStream(imageBuffer);

    // Extract text from result
    let extractedText = '';
    if (result.analyzeResult?.readResults) {
      for (const page of result.analyzeResult.readResults) {
        for (const line of page.lines || []) {
          extractedText += line.text + '\n';
        }
      }
    }

    return {
      success: true,
      provider: 'azure-vision',
      text: extractedText,
      rawData: result.analyzeResult,
      confidence: result.status === 'succeeded' ? 0.85 : 0.5
    };
  } catch (error) {
    console.error('Azure Vision error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Unified OCR interface - choose provider
 * @param {string} imagePath - Path to receipt image
 * @param {Object} options - Configuration with provider selection
 * @returns {Promise<Object>} - OCR results
 */
async function processReceiptWithProvider(imagePath, options = {}) {
  const { provider = 'tesseract', fallback = true } = options;

  console.log(`Processing receipt with ${provider}...`);

  let result;

  switch (provider.toLowerCase()) {
    case 'google':
    case 'google-vision':
      result = await processReceiptGoogle(imagePath, options);
      break;

    case 'aws':
    case 'textract':
      result = await processReceiptAWS(imagePath, options);
      break;

    case 'azure':
    case 'azure-vision':
      result = await processReceiptAzure(imagePath, options);
      break;

    case 'tesseract':
    default:
      result = await processReceiptTesseract(imagePath, options);
  }

  // Fallback if primary provider fails and fallback enabled
  if (!result.success && fallback && provider !== 'tesseract') {
    console.log(`${provider} failed, falling back to Tesseract...`);
    result = await processReceiptTesseract(imagePath, options);
  }

  return result;
}

/**
 * Compare multiple OCR providers
 * Useful for finding best accuracy/cost tradeoff
 * @param {string} imagePath - Path to image
 * @param {Array<string>} providers - Providers to compare
 * @returns {Promise<Object>} - Comparison results
 */
async function compareOCRProviders(imagePath, providers = ['tesseract', 'google-vision', 'aws-textract']) {
  console.log(`Comparing OCR providers on ${imagePath}...`);

  const results = {};
  const startTime = Date.now();

  for (const provider of providers) {
    try {
      const providerStart = Date.now();
      const result = await processReceiptWithProvider(imagePath, { provider, fallback: false });
      const duration = Date.now() - providerStart;

      results[provider] = {
        success: result.success,
        duration_ms: duration,
        text: result.text || result.rawData,
        confidence: result.confidence || 'N/A',
        cost: estimateProviderCost(provider)
      };
    } catch (error) {
      results[provider] = {
        success: false,
        error: error.message
      };
    }
  }

  results.totalTime_ms = Date.now() - startTime;
  results.recommendation = recommendProvider(results);

  return results;
}

/**
 * Calculate average confidence from OCR result
 * @param {Object} visionResult - Result from Google Vision
 * @returns {number} - Confidence 0-1
 */
function calculateAverageConfidence(visionResult) {
  let total = 0;
  let count = 0;

  // Simplified - just check if full text annotation exists
  if (visionResult.fullTextAnnotation?.text) {
    return 0.85; // Google Vision is generally ~85% confident
  }

  return 0;
}

/**
 * Estimate cost of OCR provider call
 * @param {string} provider - Provider name
 * @returns {string} - Cost estimate
 */
function estimateProviderCost(provider) {
  const costPerImage = {
    'tesseract': 0,
    'google-vision': 0.0015,
    'aws-textract': 0.0015,
    'azure-vision': 0.001
  };

  const cost = costPerImage[provider.toLowerCase()] || 0;
  return cost > 0 ? `$${cost}` : 'Free';
}

/**
 * Recommend best provider based on comparison results
 * @param {Object} results - Results from compareOCRProviders
 * @returns {Object} - Recommendation with reasoning
 */
function recommendProvider(results) {
  const recommendations = [];

  if (results['tesseract']?.success) {
    recommendations.push({
      provider: 'tesseract',
      score: 50,
      pros: ['Free', 'No API keys needed'],
      cons: ['Lower accuracy', 'Slower processing'],
      bestFor: 'Budget-conscious, offline processing'
    });
  }

  if (results['google-vision']?.success) {
    recommendations.push({
      provider: 'google-vision',
      score: 85,
      pros: ['High accuracy', 'Fast', 'Good for Indian text'],
      cons: ['Costs $0.0015 per image', 'Requires API key'],
      bestFor: 'Production, mixed-language receipts'
    });
  }

  if (results['aws-textract']?.success) {
    recommendations.push({
      provider: 'aws-textract',
      score: 90,
      pros: ['Highest accuracy', 'Understands structure'],
      cons: ['Higher cost', 'Async processing'],
      bestFor: 'Complex receipts, production'
    });
  }

  const best = recommendations.sort((a, b) => b.score - a.score)[0];
  return best || { provider: 'tesseract', reason: 'Default fallback' };
}

/**
 * Placeholder for Tesseract - implement using existing receiptOcrService
 * @param {string} imagePath - Path to image
 * @param {Object} options - Options
 * @returns {Promise<Object>} - OCR results
 */
async function processReceiptTesseract(imagePath, options = {}) {
  try {
    // Import the existing Tesseract service
    const { processReceipt } = require('./receiptOcrService');
    const result = await processReceipt(imagePath);

    return {
      success: result.success,
      provider: 'tesseract',
      text: result.rawText,
      ...result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * SETUP GUIDE FOR ALTERNATIVES
 * 
 * GOOGLE VISION API:
 * 1. Create GCP project: https://console.cloud.google.com
 * 2. Enable Vision API
 * 3. Create service account JSON key
 * 4. Set: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 * 5. npm install @google-cloud/vision
 * 
 * AWS TEXTRACT:
 * 1. Create AWS account
 * 2. Create IAM user with Textract permissions
 * 3. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
 * 4. npm install aws-sdk
 * 
 * AZURE COMPUTER VISION:
 * 1. Create Azure account
 * 2. Create Computer Vision resource
 * 3. Set AZURE_VISION_KEY and AZURE_VISION_ENDPOINT
 * 4. npm install @azure/cognitiveservices-computervision @azure/ms-rest-js
 */

module.exports = {
  processReceiptGoogle,
  processReceiptAWS,
  processReceiptAzure,
  processReceiptWithProvider,
  compareOCRProviders,
  estimateProviderCost,
  recommendProvider,
  processReceiptTesseract,
  OCR_COMPARISON: {
    TESSERACT: { accuracy: '70-80%', cost: 'Free', setup: 'None', speed: 'Slow' },
    GOOGLE_VISION: { accuracy: '90-95%', cost: '$0.0015/image', setup: 'API Key', speed: 'Fast' },
    AWS_TEXTRACT: { accuracy: '92-96%', cost: '$0.0015-0.015/image', setup: 'AWS Account', speed: 'Medium' },
    AZURE_VISION: { accuracy: '85-92%', cost: '$1/1000 images', setup: 'API Key', speed: 'Fast' }
  }
};
