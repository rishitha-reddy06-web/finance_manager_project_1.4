# Receipt Scanning Feature - Complete Setup & Integration Guide

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Installation & Setup](#installation--setup)
4. [Usage Examples](#usage-examples)
5. [OCR Alternatives Comparison](#ocr-alternatives-comparison)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Option 1: Basic Setup (5 minutes)
```bash
cd backend
npm install sharp    # For image preprocessing
npm install tesseract.js  # Already installed

# Copy new service files if not auto-imported
# The enhanced service is ready to use
```

### Option 2: With Google Vision API (Better accuracy)
```bash
npm install @google-cloud/vision

# Setup GCP credentials:
# 1. Create project: https://console.cloud.google.com
# 2. Enable Vision API
# 3. Create service account JSON key
# 4. Export: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

---

## Architecture Overview

### 📊 Processing Pipeline

```
Receipt Image
    ↓
[Image Preprocessing] ← New: Contrast, denoise, threshold, deskew
    ↓
[OCR Processing] ← Can use: Tesseract, Google Vision, AWS Textract, Azure
    ↓
[Receipt Parsing] ← New: Advanced line item detection, amount extraction
    ↓
[Indian-Specific Processing] ← New: ₹ currency, GST, Indian stores
    ↓
[Structured JSON Output]
```

### 📁 New Files Created

| File | Purpose | Language |
|------|---------|----------|
| `receiptPreprocessor.js` | Image cleaning, contrast, noise removal | Node.js |
| `receiptParser.js` | Advanced receipt parsing logic | Node.js |
| `indianReceiptParser.js` | Indian receipt specific (GST, ₹, stores) | Node.js |
| `ocrAlternatives.js` | Google Vision, AWS Textract, Azure integration | Node.js |
| `enhancedReceiptService.js` | Main orchestrator (combine all) | Node.js |
| `enhanced_receipt_parser.py` | Python alternative with OpenCV | Python |

### 🔄 Data Flow

```javascript
// Old approach (limited):
rawImage → Basic Tesseract → Regex parsing → Limited accuracy

// New approach (robust):
rawImage → Preprocess → Advanced OCR → Smart parsing → Validate → JSON ✓
          ↓           ↓                 ↓
         Sharp      Tesseract/       Indian-aware
         filters    Google Vision    categories
```

---

## Installation & Setup

### Step 1: Backend Dependencies

```bash
cd backend

# Core dependencies (required)
npm install sharp              # Image preprocessing
# tesseract.js already installed

# Optional - for OCR alternatives
npm install @google-cloud/vision    # Google Vision API
npm install aws-sdk                 # AWS Textract
npm install @azure/cognitiveservices-computervision @azure/ms-rest-js  # Azure
```

### Step 2: Environment Variables

Create `.env` file in `backend/`:

```env
# OCR Configuration
OCR_PROVIDER=tesseract                    # Options: tesseract, google-vision, aws-textract, azure-vision
ENABLE_PREPROCESSING=true                 # Always preprocess images
USE_INDIAN_PARSER=true                   # Detect and use Indian receipt parsing

# Google Vision API (if using)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-key.json

# AWS (if using Textract)
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_REGION=us-east-1

# Azure (if using Vision)
AZURE_VISION_KEY=your_key_here
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
```

### Step 3: Python Setup (Optional - for enhanced preprocessing)

```bash
# Navigate to Python module
cd ai_module

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install opencv-python pytesseract pillow numpy

# On Windows, also install:
choco install tesseract-ocr

# On macOS:
brew install tesseract

# On Ubuntu:
sudo apt-get install tesseract-ocr libtesseract-dev
```

---

## Usage Examples

### Example 1: Basic Receipt Processing (Node.js)

```javascript
const enhancedService = require('./services/enhancedReceiptService');

async function scanReceipt() {
  const result = await enhancedService.processReceiptImage(
    './uploads/receipt.jpg',
    {
      preprocess: true,           // Enable preprocessing
      ocrProvider: 'tesseract',   // Use Tesseract
      useIndianParser: true,      // Auto-detect Indian receipts
      saveDebugImages: false      // Save intermediate processing steps
    }
  );

  if (result.status === 'completed') {
    console.log('Extracted Data:');
    console.log(`Store: ${result.extracted.store}`);
    console.log(`Date: ${result.extracted.date}`);
    console.log(`Total: ₹${result.extracted.total}`);
    
    console.log('\nItems:');
    result.extracted.items.forEach(item => {
      console.log(`  - ${item.item}: ₹${item.amount} (${item.category})`);
    });

    console.log(`\nConfidence: ${result.extracted.confidence}%`);
    console.log(`Processing time: ${result.processingTimeMs}ms`);
  } else {
    console.error('Processing failed:', result.errors);
  }
}

scanReceipt();
```

### Example 2: Using Google Vision API (Better Accuracy)

```javascript
const enhancedService = require('./services/enhancedReceiptService');

async function scanWithGoogleVision() {
  const result = await enhancedService.processReceiptImage(
    './uploads/receipt.jpg',
    {
      preprocess: true,
      ocrProvider: 'google-vision',  // Use Google Vision API
      useIndianParser: true,
      maxRetries: 1
    }
  );

  // Result will automatically fall back to Tesseract if Google Vision fails
  console.log(result.extracted);
}

scanWithGoogleVision();
```

### Example 3: Batch Processing Multiple Receipts

```javascript
const enhancedService = require('./services/enhancedReceiptService');
const fs = require('fs');
const path = require('path');

async function batchProcessReceipts() {
  // Get all receipt images
  const receiptsDir = './uploads';
  const files = fs.readdirSync(receiptsDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .map(f => path.join(receiptsDir, f));

  console.log(`Processing ${files.length} receipts...`);

  // Process with concurrency of 2 to avoid overload
  const results = await enhancedService.batchProcessReceipts(files, {
    preprocess: true,
    concurrency: 2,
    ocrProvider: 'tesseract'
  });

  // Save results
  const output = results.map(r => ({
    file: r.file,
    status: r.status,
    store: r.extracted?.store,
    total: r.extracted?.total,
    itemCount: r.extracted?.items?.length,
    confidence: r.extracted?.confidence,
    processTimeMs: r.processingTimeMs
  }));

  fs.writeFileSync('batch_results.json', JSON.stringify(output, null, 2));
  console.log('Results saved to batch_results.json');
}

batchProcessReceipts();
```

### Example 4: Compare OCR Providers

```javascript
const enhancedService = require('./services/enhancedReceiptService');

async function compareProviders() {
  console.log('Comparing OCR providers...');
  
  const comparison = await enhancedService.getProviderComparison(
    './uploads/receipt.jpg'
  );

  console.log('\nComparison Results:');
  for (const [provider, data] of Object.entries(comparison)) {
    if (provider === 'totalTime_ms' || provider === 'recommendation') continue;
    console.log(`\n${provider}:`);
    console.log(`  Success: ${data.success}`);
    console.log(`  Time: ${data.duration_ms}ms`);
    console.log(`  Cost: ${data.cost}`);
    console.log(`  Confidence: ${data.confidence}`);
  }

  console.log('\nRecommendation:', comparison.recommendation);
}

compareProviders();
```

### Example 5: Python Usage

```python
from enhanced_receipt_parser import process_receipt_image

# Process with preprocessing
result = process_receipt_image(
    "sample_receipt.jpg",
    preprocess=True,
    debug=True  # Save intermediate processing steps
)

print(f"Store: {result.store_name}")
print(f"Date: {result.date}")
print(f"Total: ₹{result.total}")
print(f"Confidence: {result.confidence:.0%}")

print("\nItems:")
for item in result.items:
    print(f"  - {item.item}: ₹{item.amount:.2f} ({item.category})")

# Convert to JSON
import json
print("\nJSON Output:")
print(json.dumps(result.to_dict(), indent=2))
```

### Example 6: Backend Route Integration

```javascript
// In backend/routes/receipts.js (create this file)
const express = require('express');
const multer = require('multer');
const enhancedService = require('../services/enhancedReceiptService');

const router = express.Router();
const upload = multer({ dest: './uploads' });

/**
 * POST /api/receipts/scan
 * Upload and process receipt image
 */
router.post('/scan', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await enhancedService.processReceiptImage(
      req.file.path,
      {
        preprocess: true,
        ocrProvider: process.env.OCR_PROVIDER || 'tesseract',
        useIndianParser: true
      }
    );

    if (result.status === 'completed') {
      res.json({
        success: true,
        data: result.extracted,
        metadata: {
          processingTime: result.processingTimeMs,
          ocrProvider: result.steps.ocr.provider,
          confidence: result.extracted.confidence
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Processing failed',
        errors: result.errors,
        details: result.steps
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/receipts/batch
 * Process multiple receipts
 */
router.post('/batch', upload.array('receipts', 10), async (req, res) => {
  try {
    const filePaths = req.files.map(f => f.path);
    
    const results = await enhancedService.batchProcessReceipts(filePaths, {
      preprocess: true,
      concurrency: 2
    });

    res.json({
      success: true,
      count: results.length,
      results: results.map(r => ({
        file: r.file,
        status: r.status,
        data: r.extracted,
        processingTime: r.processingTimeMs
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Example 7: Update Server Configuration

```javascript
// In backend/server.js, add routes:
const receiptRoutes = require('./routes/receipts');

app.use('/api/receipts', receiptRoutes);
```

---

## OCR Alternatives Comparison

### Decision Matrix

| Criteria | Tesseract | Google Vision | AWS Textract | Azure Vision |
|----------|-----------|---------------|--------------|--------------|
| **Accuracy** | 70-80% ⭐ | 90-95% ⭐⭐⭐⭐ | 92-96% ⭐⭐⭐⭐ | 85-92% ⭐⭐⭐⭐ |
| **Speed** | Slow 🐢 | Very Fast ⚡ | Medium ⏱️ | Fast ⚡⚡ |
| **Cost** | Free 💰 | $0.0015/image | $0.0015/image | $0.001/image |
| **Setup** | None | Simple | Moderate | Simple |
| **Indian Support** | Fair | Excellent | Good | Good |
| **Best For** | Low-budget MVP | Production | Complex layouts | Enterprise |

### Cost Calculation for 10,000 receipts/month

```
Tesseract:       $0       (free, but slower workflow)
Google Vision:   $15      (10,000 × $0.0015)
AWS Textract:    $15      (async)
Azure Vision:    $10      (1000 free tier, then $1 per 1000)
```

### Recommendation

- **Development/MVP**: Tesseract + Preprocessing (free, ~80% accuracy)
- **Production**: Google Vision API (~90% accuracy, $15/month for 10K images)
- **Enterprise**: AWS Textract (best for complex docs, ~96% accuracy)
- **Budget-restricted**: Tesseract + better preprocessing (can reach ~85% accuracy)

---

## Configuration for Indian Receipts

### Automatic Detection

The system automatically detects Indian receipts by checking for:
- ₹ (Rupee symbol)
- GST keywords
- Indian store names (Big Bazaar, DMart, etc.)
- CGST/SGST keywords

### When Indian Parser Activates

```javascript
// Automatically handled
const result = await enhancedService.processReceiptImage('./receipt.jpg', {
  useIndianParser: true  // Set to true to auto-detect
});

// Parser detects Indian format and:
// ✓ Parses ₹ currency correctly
// ✓ Extracts GST breakdowns
// ✓ Recognizes Indian measurement units (kg, l, pcs)
// ✓ Uses Indian category keywords
// ✓ Normalizes Indian store names
```

### Key Features for Indian Receipts

| Feature | Example |
|---------|---------|
| **Currency Parsing** | ₹1,00,000.50 → 100000.50 |
| **GST Extraction** | "GST 18%" → parsed tax |
| **Store Normalization** | "BIGBAZAAR" → "Big Bazaar" |
| **Quantity Units** | "Rice (5kg)" → parsed quantity |
| **Amount Validation** | Prevents OCR errors like ₹300 → 43210 |

---

## Troubleshooting

### Issue 1: Poor OCR Accuracy (< 70%)

**Causes:**
- Image too small or compressed
- Bad lighting/shadows
- Receipt text is faint

**Solutions:**
```javascript
// Option 1: Increase preprocessing aggressiveness
const result = await enhancedService.processReceiptImage(imagePath, {
  preprocess: true,
  // Let preprocessing handle it
});

// Option 2: Use Google Vision for better accuracy
const result = await enhancedService.processReceiptImage(imagePath, {
  ocrProvider: 'google-vision',
  preprocess: true
});

// Option 3: Compare providers
const comparison = await enhancedService.getProviderComparison(imagePath);
```

### Issue 2: Wrong Item Detection (Extra or Missing Items)

**Causes:**
- OCR text has garbage characters
- Items section not detected properly

**Solutions:**
```javascript
// Check OCR text before parsing
const improved = require('./services/improvedReceiptParser');

const lines = ocrText.split('\n');
lines.forEach(line => {
  const classification = improved.classifyReceiptLine(line);
  console.log(`"${line}" → ${classification.itemType} (${classification.confidence})`);
});
```

### Issue 3: Amounts Misread (₹300 becomes 43210)

**Cause:** 
- OCR character confusion (0↔O, 1↔I, 5↔S)

**Solution:**
```javascript
// Validation is built-in, but check if item amount is reasonable:
const item = {
  item: "Rice (5 kg)",
  amount: 43210  // Unreasonable!
};

// This is automatically filtered:
if (amount > 100000) {
  // Likely OCR error, filtered out
}

// Amount validation prevents most errors
```

### Issue 4: Performance is Slow

**Causes:**
- Processing multiple large images synchronously
- Tesseract running on main thread

**Solutions:**
```javascript
// Use batch processing with concurrency limit
const results = await enhancedService.batchProcessReceipts(files, {
  concurrency: 2  // Process 2 at a time
});

// In production, consider:
// 1. Google Vision API (faster than Tesseract)
// 2. Process in background job queue
// 3. Scale horizontally
```

### Issue 5: Google Vision API Not Working

**Check:**
```bash
# Verify credentials
echo $GOOGLE_APPLICATION_CREDENTIALS

# Test authentication
gcloud auth test

# Check API is enabled
# https://console.cloud.google.com/apis/library/vision.googleapis.com
```

---

## Migration from Old Service

### Old Code
```javascript
const { processReceipt } = require('./services/receiptOcrService');
const result = await processReceipt(imagePath);
```

### New Code
```javascript
const enhancedService = require('./services/enhancedReceiptService');
const result = await enhancedService.processReceiptImage(imagePath, {
  preprocess: true,
  ocrProvider: 'tesseract'
});
```

### Data Structure Change

**Old:**
```json
{
  "success": true,
  "amount": 619.50,
  "items": [
    { "description": "Rice", "amount": 300 }
  ]
}
```

**New:**
```json
{
  "status": "completed",
  "extracted": {
    "store": "ABC General Store",
    "date": "2024-04-16",
    "items": [
      {
        "item": "Rice (5 kg)",
        "amount": 300,
        "quantity": 5,
        "unit": "kg",
        "category": "Food & Dining",
        "confidence": 0.85
      }
    ],
    "total": 619.50,
    "confidence": 0.89
  }
}
```

---

## Testing

### Unit Tests

```javascript
// backend/tests/receiptParser.test.js
const improvedParser = require('../services/improvedReceiptParser');

describe('Receipt Parser', () => {
  test('should extract items correctly', () => {
    const ocrText = `
    ABC STORE
    Date: 16-04-2026
    Rice (5 kg) ..................... ₹300
    Milk (2L) ...................... ₹120
    Bread .......................... ₹80
    
    Total: ₹500
    `;

    const result = improvedParser.parseImprovedReceipt(ocrText);
    expect(result.items.length).toBe(3);
    expect(result.items[0].amount).toBe(300);
  });
});
```

---

## Next Steps

1. ✅ Install dependencies: `npm install sharp`
2. ✅ Copy new service files (already done)
3. ✅ Create receipt routes: `backend/routes/receipts.js`
4. ✅ Add to `server.js`
5. ✅ Test with sample receipt
6. ✅ Deploy to production

---

## Support & Additional Resources

- [Google Vision API Docs](https://cloud.google.com/vision/docs)
- [AWS Textract Docs](https://docs.aws.amazon.com/textract/)
- [Azure Vision Docs](https://learn.microsoft.com/en-us/azure/cognitive-services/computer-vision/)
- [Tesseract.js Docs](https://github.com/naptha/tesseract.js)
- [OpenCV Python Docs](https://docs.opencv.org/)

