const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const path = require('path');

async function test() {
    try {
        const filePath = path.join(__dirname, 'dummy_statement.pdf');
        const dataBuffer = fs.readFileSync(filePath);
        console.log('Instantiating PDFParse...');
        const pdfInstance = new PDFParse(dataBuffer);
        console.log('Instance keys:', Object.keys(pdfInstance));

        // Let's see if there is a parse method or if it's already parsed
        if (typeof pdfInstance.parse === 'function') {
            const data = await pdfInstance.parse();
            console.log('Parsed data keys:', Object.keys(data));
        } else {
            console.log('No .parse() method found on instance.');
            console.log('Checking instance properties...');
            for (const key in pdfInstance) {
                console.log(`Key "${key}":`, typeof pdfInstance[key]);
            }
        }
    } catch (err) {
        console.error('Error during test:', err);
    }
}

test();
