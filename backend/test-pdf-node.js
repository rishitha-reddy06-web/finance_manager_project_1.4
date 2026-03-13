const pdfNode = require('pdf-parse/node');
console.log('Type of pdfNode:', typeof pdfNode);
console.log('pdfNode keys:', Object.keys(pdfNode));
if (pdfNode.default) {
    console.log('Type of pdfNode.default:', typeof pdfNode.default);
}
