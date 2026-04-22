/**
 * EXAMPLE: Complete Receipt Scanning Integration
 * Demonstrates using the enhanced receipt service in a real application
 * 
 * Copy this as a starting point for your receipt scanning feature
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const enhancedService = require('./services/enhancedReceiptService');

const router = express.Router();

// Configure upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/receipts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|bmp)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// ============================================================================
// ROUTE: POST /api/receipts/scan
// Upload and process a single receipt
// ============================================================================

router.post('/scan', upload.single('receipt'), async (req, res) => {
  const requestId = `req-${Date.now()}`;
  console.log(`[${requestId}] Receipt scan request`);

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No receipt image uploaded'
      });
    }

    console.log(`[${requestId}] Processing: ${req.file.filename}`);

    // Process the receipt
    const result = await enhancedService.processReceiptImage(
      req.file.path,
      {
        preprocess: true,
        ocrProvider: process.env.OCR_PROVIDER || 'tesseract',
        useIndianParser: true,
        saveDebugImages: process.env.NODE_ENV === 'development'
      }
    );

    if (result.status === 'completed') {
      console.log(`[${requestId}] ✓ Processing successful`);

      // Successful response
      res.json({
        success: true,
        requestId,
        data: {
          storeName: result.extracted.store,
          date: result.extracted.date,
          items: result.extracted.items.map(item => ({
            name: item.item,
            amount: item.amount,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category
          })),
          totals: {
            subtotal: result.extracted.subtotal,
            tax: result.extracted.tax,
            total: result.extracted.total
          },
          paymentMethod: result.extracted.paymentMethod
        },
        metadata: {
          processingTimeMs: result.processingTimeMs,
          ocrProvider: result.steps.ocr.provider,
          confidence: result.extracted.confidence,
          itemCount: result.extracted.items.length
        }
      });

      // Save to database (example)
      // await Transaction.bulkCreate(result.extracted.items.map(item => ({
      //   description: item.item,
      //   amount: item.amount,
      //   category: item.category,
      //   date: result.extracted.date,
      //   type: 'expense'
      // })));

    } else if (result.status === 'failed') {
      console.log(`[${requestId}] ✗ Processing failed:`, result.errors);

      res.status(400).json({
        success: false,
        requestId,
        error: 'Receipt processing failed',
        reasons: result.errors,
        processingDetails: result.steps
      });

    } else {
      // Uncertain status
      res.status(500).json({
        success: false,
        requestId,
        error: 'Unexpected processing state',
        status: result.status
      });
    }

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      requestId,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Try again later'
    });
  }
});

// ============================================================================
// ROUTE: POST /api/receipts/batch
// Upload and process multiple receipts
// ============================================================================

router.post('/batch', upload.array('receipts', 10), async (req, res) => {
  const requestId = `batch-${Date.now()}`;
  console.log(`[${requestId}] Batch receipt scan: ${req.files.length} files`);

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No receipt images uploaded'
      });
    }

    const filePaths = req.files.map(f => f.path);

    console.log(`[${requestId}] Processing ${filePaths.length} receipts...`);

    // Process receipts with concurrency limit
    const results = await enhancedService.batchProcessReceipts(
      filePaths,
      {
        preprocess: true,
        concurrency: 2,
        ocrProvider: process.env.OCR_PROVIDER || 'tesseract'
      }
    );

    // Separate successful and failed results
    const successful = results.filter(r => r.status === 'completed');
    const failed = results.filter(r => r.status === 'failed');

    console.log(`[${requestId}] Results: ${successful.length} success, ${failed.length} failed`);

    // Build response
    const response = {
      success: failed.length === 0,
      requestId,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        totalProcessingTimeMs: results.reduce((sum, r) => sum + r.processingTimeMs, 0)
      },
      successfulReceipts: successful.map(r => ({
        fileName: r.file,
        store: r.extracted.store,
        date: r.extracted.date,
        total: r.extracted.total,
        itemCount: r.extracted.items.length,
        confidence: r.extracted.confidence,
        processingTimeMs: r.processingTimeMs
      })),
      failedReceipts: failed.map(r => ({
        fileName: r.file,
        error: r.errors[0]?.message || 'Unknown error',
        processingTimeMs: r.processingTimeMs
      }))
    };

    res.json(response);

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);

    // Clean up
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      requestId,
      error: 'Batch processing failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Try again later'
    });
  }
});

// ============================================================================
// ROUTE: GET /api/receipts/providers
// Get available OCR providers and their costs
// ============================================================================

router.get('/providers', (req, res) => {
  res.json({
    available: [
      {
        name: 'tesseract',
        displayName: 'Tesseract OCR (Free)',
        accuracy: '70-80%',
        speed: 'Slow',
        cost: 'Free',
        recommended: false,
        pros: ['No setup needed', 'Free'],
        cons: ['Lower accuracy', 'Slower processing']
      },
      {
        name: 'google-vision',
        displayName: 'Google Vision API',
        accuracy: '90-95%',
        speed: 'Very Fast',
        cost: '$0.0015/image',
        recommended: true,
        pros: ['High accuracy', 'Very fast', 'Excellent for mixed languages'],
        cons: ['Requires API key', 'Pay-per-use']
      },
      {
        name: 'aws-textract',
        displayName: 'AWS Textract',
        accuracy: '92-96%',
        speed: 'Medium',
        cost: '$0.0015/image',
        recommended: false,
        pros: ['Highest accuracy', 'Understands document structure'],
        cons: ['More complex setup', 'Async processing']
      },
      {
        name: 'azure-vision',
        displayName: 'Azure Computer Vision',
        accuracy: '85-92%',
        speed: 'Fast',
        cost: '$1/1000 images',
        recommended: false,
        pros: ['Good accuracy', 'Enterprise ready'],
        cons: ['Regional availability']
      }
    ],
    current: process.env.OCR_PROVIDER || 'tesseract'
  });
});

// ============================================================================
// ROUTE: POST /api/receipts/compare
// Compare OCR providers on a sample receipt
// ============================================================================

router.post('/compare', upload.single('receipt'), async (req, res) => {
  const requestId = `compare-${Date.now()}`;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No receipt image provided'
      });
    }

    console.log(`[${requestId}] Comparing OCR providers...`);

    const comparison = await enhancedService.getProviderComparison(req.file.path);

    res.json({
      success: true,
      requestId,
      comparison: {
        tesseract: {
          success: comparison.tesseract?.success,
          duration_ms: comparison.tesseract?.duration_ms,
          confidence: comparison.tesseract?.confidence,
          cost: comparison.tesseract?.cost
        },
        googleVision: {
          success: comparison['google-vision']?.success,
          duration_ms: comparison['google-vision']?.duration_ms,
          confidence: comparison['google-vision']?.confidence,
          cost: comparison['google-vision']?.cost
        },
        awsTextract: {
          success: comparison['aws-textract']?.success,
          duration_ms: comparison['aws-textract']?.duration_ms,
          confidence: comparison['aws-textract']?.confidence,
          cost: comparison['aws-textract']?.cost
        },
        azureVision: {
          success: comparison['azure-vision']?.success,
          duration_ms: comparison['azure-vision']?.duration_ms,
          confidence: comparison['azure-vision']?.confidence,
          cost: comparison['azure-vision']?.cost
        }
      },
      recommendation: {
        provider: comparison.recommendation.provider,
        reason: comparison.recommendation.pros?.[0] || 'Best option',
        bestFor: comparison.recommendation.bestFor
      },
      totalComparison_ms: comparison.totalTime_ms
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);

    res.status(500).json({
      success: false,
      requestId,
      error: 'Comparison failed',
      message: error.message
    });
  }
});

// ============================================================================
// ROUTE: POST /api/receipts/extract-text
// Get raw OCR text (for debugging)
// ============================================================================

router.post('/extract-text', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No receipt image provided'
      });
    }

    const Tesseract = require('tesseract.js');
    const fs = require('fs');

    const imageBuffer = fs.readFileSync(req.file.path);
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');

    res.json({
      success: true,
      rawText: text,
      charCount: text.length,
      lineCount: text.split('\n').length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// Error handling middleware
// ============================================================================

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large (max 10MB)'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: error.message || 'Unknown error'
  });
});

module.exports = router;

// ============================================================================
// USAGE IN SERVER.JS:
// ============================================================================

/*
const receiptRoutes = require('./routes/receipts-enhanced');
app.use('/api/receipts', receiptRoutes);

// Frontend usage:
// 
// POST /api/receipts/scan with FormData:
// const formData = new FormData();
// formData.append('receipt', fileInput.files[0]);
// const response = await fetch('/api/receipts/scan', { method: 'POST', body: formData });
//
// Expected: { success: true, data: { items: [...], total: 619.50 } }
*/
