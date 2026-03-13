const pdf = require('pdf-parse');
console.log('Type of pdf.PDFParse:', typeof pdf.PDFParse);
if (typeof pdf.PDFParse === 'function') {
    console.log('pdf.PDFParse is a function');
}

// Check other keys for functions
for (const key in pdf) {
    if (typeof pdf[key] === 'function') {
        console.log(`Key "${key}" is a function`);
    }
}
