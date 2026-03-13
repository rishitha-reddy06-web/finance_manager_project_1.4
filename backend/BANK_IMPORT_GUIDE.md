# Bank Statement Import Guide

This guide explains how to use the PDF and CSV bank statement import features to automatically extract and import your transactions.

## Features

### PDF Bank Statement Import
- **Automatic Parsing**: Extracts date, description, amount, and transaction type from PDF files
- **Multi-Bank Support**: Detects and handles various bank statement formats (HDFC, ICICI, SBI, Axis, Yes Bank, Kotak, IDBI)
- **Format Detection**: Automatically identifies statement format and statement type (table or narrative)
- **Duplicate Prevention**: Prevents importing the same transaction twice
- **Intelligent Categorization**: Automatically categorizes transactions based on description
- **Error Handling**: Provides detailed error messages and suggestions for troubleshooting

### CSV Import
- **Flexible Column Detection**: Automatically finds amount, date, and description columns
- **Multiple Amount Formats**: Supports various number formats (1,234.56 | 1.234,56 | 1,00,000.00)
- **Debit/Credit Handling**: Automatically detects transaction type from column names or values
- **Column Flexibility**: Works with common column name variations

## Supported Bank Statement Formats

### PDF Formats
- **Indian Banks**: HDFC, ICICI, SBI, Axis, Yes Bank, Kotak, IDBI
- **Statement Styles**: 
  - Table format (Date | Description | Debit | Credit | Balance)
  - Narrative format (date and transaction details in text)
- **Date Formats**:
  - DD/MM/YYYY (e.g., 15/03/2024)
  - YYYY-MM-DD (e.g., 2024-03-15)
  - DD-Mon-YYYY (e.g., 15-Mar-2024)
  - Other common formats

### CSV Formats

#### Minimal Required Columns
```csv
date,description,amount
2024-03-15,Salary Payment,50000
2024-03-16,Coffee Shop,-500
```

#### Recommended Columns
```csv
date,description,amount,type,category,payment_method
2024-03-15,Salary Payment,50000,income,Salary,bank_transfer
2024-03-16,Grocery Store,1200,expense,Shopping,card
```

#### Alternative with Debit/Credit Columns
```csv
date,description,debit,credit
2024-03-15,Salary Payment,,50000
2024-03-16,Coffee Shop,500,
```

## Valid Categories

### Income Categories
- Salary
- Freelance
- Business
- Investment
- Other

### Expense Categories
- Food & Dining
- Transport
- Shopping
- Entertainment
- Healthcare
- Utilities
- Housing
- Education
- Travel
- Insurance
- EMI & Loans
- Subscriptions
- Gifts & Donations
- Bank Charges
- Other

## API Endpoints

### Upload PDF Bank Statement
```
POST /api/transactions/import-pdf
Content-Type: multipart/form-data

file: <PDF file>
```

### Upload CSV File
```
POST /api/transactions/import
Content-Type: multipart/form-data

file: <CSV file>
```

### Generic Import (Auto-detect)
```
POST /api/transactions/import
Content-Type: multipart/form-data

file: <PDF or CSV file>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Successfully imported 25 transactions from PDF",
  "data": {
    "imported": 25,
    "skipped": 2,
    "total": 27,
    "transactions": [...],
    "duplicates": [...],
    "parser": "pdf-parse",
    "statementFormat": {
      "bank": "HDFC",
      "format": "table",
      "hasRunningBalance": true,
      "dateFormat": "DD/MM/YYYY",
      "confidence": "medium"
    }
  }
}
```

### Error Response with Suggestions
```json
{
  "success": false,
  "message": "Failed to parse PDF: Unable to read PDF content",
  "errors": ["The file may be encrypted or corrupted"],
  "suggestions": [
    "Ensure the PDF is a text-based statement (not only scanned images)",
    "Check whether the PDF is password-protected",
    "Try a different statement format or page range"
  ]
}
```

## Transaction Categorization

The system automatically categorizes transactions based on keywords in the description:

### Food & Dining
- Keywords: food, restaurant, cafe, zomato, swiggy, hotel, meal, dining, burger, pizza

### Transport
- Keywords: uber, ola, metro, bus, train, taxi, petrol, fuel, auto, transport, cab

### Shopping
- Keywords: amazon, flipkart, myntra, shopping, store, mall, ebay, gift

### Entertainment
- Keywords: netflix, spotify, movie, entertainment, hotstar, disney, theatre, cinema

### Healthcare
- Keywords: hospital, doctor, health, clinic, medical, pharma, medicine, dental, pharmacy

### And more...

You can manually edit categories after import if needed.

## Troubleshooting

### "No transactions found in PDF"
**Causes:**
- PDF is a scanned image without OCR
- Statement format is not recognized
- Missing standard columns (Date, Amount, Description)

**Solutions:**
1. Ensure the PDF is text-based, not just an image
2. Use OCR software to convert scanned PDFs to searchable text
3. Verify the statement has standard transaction columns
4. Try uploading a different page or statement

### "File is empty" or "Invalid file type"
**Causes:**
- File didn't upload correctly
- Wrong file format

**Solutions:**
1. Check file size (max 10MB)
2. Ensure file is PDF or CSV
3. Try uploading again
4. Check internet connection

### "All transactions are duplicates"
**Causes:**
- You've already imported this statement
- First transaction import is being re-uploaded

**Solutions:**
1. Check your transaction history
2. Upload a different bank statement
3. Delete duplicate transactions if needed and re-import

### "Amount parsing failed"
**For CSV files:**
1. Remove currency symbols (₹, $, etc.)
2. Use standard number formats (1234.56 or 1,234.56)
3. Ensure amount column exists
4. Check for text in amount columns

## CSV Column Name Variations

The system recognizes these column name variations:

**Amount:**
- amount, amt, value, transaction_amount, txn_amount
- debit, credit, dr, cr
- withdrawal, deposit
- amount_in, amount_out

**Date:**
- date, transaction_date, txn_date, posting_date

**Description:**
- description, desc, narration, details, transaction_description

**Type:**
- type, transaction_type

**Category:**
- category, cat

## Best Practices

1. **PDF Selection**
   - Use recent, text-based statements
   - Ensure statements are clear and readable
   - Avoid encrypted or password-protected PDFs

2. **CSV Preparation**
   - Include a header row with column names
   - Use consistent date format
   - Remove extra whitespace in amounts
   - Check for special characters that might break parsing

3. **Data Verification**
   - Review imported transactions before consolidating
   - Check automatic categorization
   - Verify amounts and dates are correct
   - Update category assignments if needed

4. **Regular Imports**
   - Import monthly statements for consistency
   - Keep statements organized by date
   - Archive imported statements locally

## Supported File Sizes
- **Maximum**: 10MB
- **Recommended**: Under 5MB for optimal performance

## Encoding
- **CSV**: UTF-8 recommended
- **PDF**: Any standard encoding supported

## Performance Notes
- PDF parsing may take a few seconds for large statements
- CSV parsing is generally faster
- Duplicate detection runs after parsing
- Budget updates are automatic

## Contact Support
For issues not covered here, please provide:
1. Bank statement type (PDF/CSV)
2. Bank name (if PDF)
3. Error message received
4. Number of transactions
5. Sample transaction line (sanitized for privacy)
