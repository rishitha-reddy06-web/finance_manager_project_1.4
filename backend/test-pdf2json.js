const PDFParser = require("pdf2json");
const fs = require("fs");
const path = require("path");

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    console.log("PDF parsed successfully with pdf2json");
    // console.log("Extracted text length:", JSON.stringify(pdfData).length);
    // Log a small part of the structure
    console.log("Pages found:", pdfData.Pages.length);
    if (pdfData.Pages.length > 0) {
        console.log("Text tokens in first page:", pdfData.Pages[0].Texts.length);
        if (pdfData.Pages[0].Texts.length > 0) {
            console.log("First text token:", JSON.stringify(pdfData.Pages[0].Texts[0]));
        }
    }
});

const filePath = path.join(__dirname, 'dummy_statement.pdf');
pdfParser.loadPDF(filePath);
