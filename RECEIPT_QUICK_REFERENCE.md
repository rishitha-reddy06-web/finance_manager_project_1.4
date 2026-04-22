# Receipt Scanning - Quick Reference & Cheat Sheet

## 📝 Installation (Copy-Paste)

```bash
cd backend

# Core (required)
npm install sharp

# Optional OCR alternatives
npm install @google-cloud/vision      # For better accuracy
npm install aws-sdk                   # For AWS Textract
npm install @azure/cognitiveservices-computervision @azure/ms-rest-js  # For Azure
```

## 🚀 Quickest Integration (5 minutes)

### 1. Add to server.js
```javascript
const enhancedReceiptService = require('./services/enhancedReceiptService');

app.post('/api/receipts/scan', multer().single('receipt'), async (req, res) => {
  const result = await enhancedReceiptService.processReceiptImage(req.file.path);
  res.json(result.extracted);
});
```

### 2. Frontend (React)
```javascript
const handleReceiptUpload = async (file) => {
  const formData = new FormData();
  formData.append('receipt', file);
  
  const response = await fetch('/api/receipts/scan', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  console.log(result.items); // Array of { item, amount, category }
};
```

## 📊 Output Format

```json
{
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
  "tax": 29.50,
  "confidence": 0.89
}
```

## ⚙️ Configuration

### Environment Variables (.env)
```env
OCR_PROVIDER=tesseract                 # or: google-vision, aws-textract, azure-vision
ENABLE_PREPROCESSING=true
USE_INDIAN_PARSER=true
NODE_ENV=production
```

### Quick Setup for Google Vision
```bash
# 1. Get API key from: https://console.cloud.google.com
# 2. Save JSON key as: credentials.json
# 3. Set environment variable:
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/credentials.json
```

## 🎯 Common Usage Patterns

### Pattern 1: Basic Scan
```javascript
const result = await enhancedService.processReceiptImage(imagePath);
// Returns: Full parsed receipt with items, store, total, etc.
```

### Pattern 2: Fast Processing (No Preprocessing)
```javascript
const result = await enhancedService.processReceiptImage(imagePath, {
  preprocess: false  // Faster but lower accuracy
});
```

### Pattern 3: Best Accuracy (Google Vision)
```javascript
const result = await enhancedService.processReceiptImage(imagePath, {
  ocrProvider: 'google-vision',
  preprocess: true
});
```

### Pattern 4: Batch Processing
```javascript
const results = await enhancedService.batchProcessReceipts(filePaths, {
  concurrency: 2  // Process 2 at a time
});
```

### Pattern 5: Debug Mode
```javascript
const result = await enhancedService.processReceiptImage(imagePath, {
  saveDebugImages: true,      // Save preprocessed images
  debugOutputDir: './debug'   // Where to save
});
```

## 🔍 Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Low accuracy (<70%) | Use Google Vision: `ocrProvider: 'google-vision'` |
| Slow processing | Disable preprocessing: `preprocess: false` OR use Google Vision |
| Wrong amounts | Happens with low res - enable preprocessing |
| Missing items | Check OCR text first: `result.steps.ocr` |
| Indian rupee issues | Enable: `useIndianParser: true` |
| Google Vision fails | Check: `GOOGLE_APPLICATION_CREDENTIALS` env var |

## 📈 Accuracy vs Speed vs Cost

```
Tesseract:     70% accuracy | 5-10s | Free
Google Vision: 90% accuracy | 1-2s  | $15 for 10K images
```

**Recommendation for different scenarios:**
- **MVP/Prototype**: Tesseract (free, 5-min setup)
- **Production**: Google Vision (high accuracy, low cost)
- **Enterprise**: AWS Textract (best accuracy, structure understanding)

## ✅ Validation Examples

### Check if parsing succeeded
```javascript
if (result.status === 'completed' && result.extracted.confidence > 0.7) {
  // Good quality extraction, safe to use
  saveToDatabase(result.extracted);
} else if (result.status === 'completed' && result.extracted.confidence < 0.4) {
  // Low confidence, ask user to verify
  showManualEntryForm();
}
```

### Only accept high-confidence items
```javascript
const reliableItems = result.extracted.items.filter(item => 
  item.amount > 0 && item.amount < 100000 && item.category !== 'Other'
);
```

### Validate receipt total
```javascript
const itemSum = result.extracted.items.reduce((s, i) => s + i.amount, 0);
const expectedTotal = itemSum + (result.extracted.tax || 0);
const tolerance = expectedTotal * 0.05; // 5% tolerance

if (Math.abs(result.extracted.total - expectedTotal) > tolerance) {
  console.warn('Receipt total mismatch - OCR may have errors');
}
```

## 🐛 Debug Techniques

### View OCR text before parsing
```javascript
const Tesseract = require('tesseract.js');
const buffer = fs.readFileSync(imagePath);
const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
console.log(text); // Raw OCR output
```

### Check classification of each line
```javascript
const improvedParser = require('./services/improvedReceiptParser');
const lines = ocrText.split('\n');

lines.forEach(line => {
  const classification = improvedParser.classifyReceiptLine(line);
  console.log(`"${line}" → ${classification.itemType}`);
});
```

### Compare OCR providers
```javascript
const comparison = await enhancedService.getProviderComparison(imagePath);
console.log(comparison); // See which provider works best
```

## 📦 Files Organization

```
backend/
├── services/
│   ├── enhancedReceiptService.js      ← Main orchestrator
│   ├── receiptPreprocessor.js         ← Image preprocessing
│   ├── improvedReceiptParser.js       ← Smart parsing
│   ├── indianReceiptParser.js         ← Indian-specific
│   └── ocrAlternatives.js             ← Google/AWS/Azure
├── routes/
│   └── receipts-enhanced.js           ← API endpoints
└── package.json                        ← Add 'sharp' dependency
```

## 🌍 For Other Languages

To support other languages, modify Tesseract configuration:

```javascript
// English only (current)
const { data: { text } } = await Tesseract.recognize(buffer, 'eng');

// English + Hindi (for Indian receipts)
const { data: { text } } = await Tesseract.recognize(buffer, 'eng+hin');

// English + Multiple
const { data: { text } } = await Tesseract.recognize(buffer, 'eng+fra+spa');
```

## 💡 Best Practices

✅ **DO:**
- Always use preprocessing for low-quality images
- Handle errors gracefully with fallbacks
- Show confidence score to users
- Use batch processing for multiple receipts
- Cache OCR results if processing multiple times
- Validate extracted amounts (> 0 and < 999999)

❌ **DON'T:**
- Process images without checking file size
- Ignore warnings from the parser
- Use Tesseract for production critical work (use Google Vision)
- Process large batches sequentially (use concurrency)
- Trust OCR with confidence < 0.5 without review

## 📞 Support

**Issue Templates:**

1. **Low accuracy:** Include preprocessed image from debug output
2. **Performance:** Include image size and processing time
3. **Google Vision:** Share error from `GOOGLE_APPLICATION_CREDENTIALS`
4. **Data parsing:** Share excerpt from OCR text (raw output)

## 🎁 Pro Tips

1. **Improve accuracy by 10%**: Use preprocessing + Google Vision
2. **Speed up 5x**: Use Google Vision API instead of Tesseract
3. **Save money**: Use Tesseract for development, Google Vision for production
4. **Better Indian receipts**: Set `useIndianParser: true`
5. **Batch processing**: Always use concurrency limit (2-4) to avoid memory issues
6. **Mobile users**: Compress images before upload (< 2MB)
7. **Monitoring**: Track `confidence` score over time to catch quality drops

---

**Last Updated:** April 16, 2024
**Version:** 2.0 (Enhanced with preprocessing + multiple OCR providers)
