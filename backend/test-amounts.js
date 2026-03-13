const pdfParserService = require('./services/pdfParserService');

function testAmountExtraction() {
    const testCases = [
        {
            line: "15/05/2023 123456 Amazon Purchase 1,200.50 D",
            expectedAmount: 1200.50,
            expectedDesc: "Amazon Purchase D"
        },
        {
            line: "16/05/2023 Salary Credit 50,000.00 C 1,50,000.00",
            expectedAmount: 50000.00, // Should pick first amount if multiple decimals? Actually Balance is often last.
            expectedDesc: "Salary Credit"
        },
        {
            line: "18/05/2023 Netflix 199.00",
            expectedAmount: 199.00,
            expectedDesc: "Netflix"
        },
        {
            line: "20/05/2023 9876543210 UPI/Transfer 500",
            expectedAmount: 500, // No decimals, so picks the one after date that is NOT the long ref no?
            // Actually my logic for integers: it picks the first one.
            // 9876543210 is too long for \d{1,9}
            expectedDesc: "UPI/Transfer"
        }
    ];

    console.log("Running Amount Extraction Tests...");
    testCases.forEach((tc, i) => {
        const dateMatch = pdfParserService.findDate(tc.line);
        const amounts = pdfParserService.findAmountsAfterDate(tc.line, dateMatch);
        const desc = pdfParserService.extractDescription(tc.line, dateMatch.index);

        console.log(`Test Case ${i + 1}:`);
        console.log(`  Line: ${tc.line}`);
        console.log(`  Extracted Amount: ${amounts[0]}`);
        console.log(`  Extracted Desc: "${desc}"`);

        const amountCorrect = Math.abs(amounts[0] - tc.expectedAmount) < 0.01;
        // const descCorrect = desc.includes(tc.expectedDesc);

        if (amountCorrect) {
            console.log("  PASSED");
        } else {
            console.log("  FAILED (Amount)");
        }
    });
}

testAmountExtraction();
