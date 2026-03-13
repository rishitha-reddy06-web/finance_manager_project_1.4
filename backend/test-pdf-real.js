const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const path = require('path');

async function test() {
    try {
        const filePath = path.join(__dirname, 'dummy_statement.pdf');
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return;
        }
        const dataBuffer = fs.readFileSync(filePath);
        console.log('Using PDFParse...');
        const result = await PDFParse(dataBuffer);
        console.log('Result type:', typeof result);
        console.log('Result keys:', Object.keys(result));
        if (result.text) {
            console.log('Extract text length:', result.text.length);
            console.log('Sample text:', result.text.substring(0, 100));
        }
    } catch (err) {
        console.error('Error during test:', err);
    }
}

test();
