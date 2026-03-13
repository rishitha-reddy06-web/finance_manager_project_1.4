const pdfParserService = require('./services/pdfParserService');
const path = require('path');
const fs = require('fs');

async function testParsing() {
    const filePath = path.join(__dirname, 'dummy_statement.pdf');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    console.log('Parsing file:', filePath);
    const result = await pdfParserService.parsePdf(filePath);

    console.log('Success:', result.success);
    if (result.success) {
        console.log('Transactions found:', result.transactions.length);
        console.log('Detected Bank:', result.detectedBank);
        if (result.transactions.length > 0) {
            console.log('First Transaction:', JSON.stringify(result.transactions[0], null, 2));
        }
    } else {
        console.error('Error:', result.error);
    }
}

testParsing();
