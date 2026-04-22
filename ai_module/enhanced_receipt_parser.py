"""
Receipt Scanning & Parsing - Python Implementation
Provides alternatives for Node.js + advanced ML-based parsing features

Usage:
    from enhanced_receipt_parser import process_receipt_image
    result = process_receipt_image("receipt.jpg", preprocess=True)
    print(result.to_dict())

Installation:
    pip install opencv-python pytesseract pillow numpy google-cloud-vision
"""

import cv2
import numpy as np
import pytesseract
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# IMAGE PREPROCESSING (ADVANCED)
# ============================================================================

class ReceiptPreprocessor:
    """Advanced image preprocessing for receipt OCR"""

    @staticmethod
    def preprocess_receipt(image_path: str, debug: bool = False) -> np.ndarray:
        """
        Apply advanced preprocessing pipeline
        
        Steps:
        1. Read image
        2. Convert to grayscale
        3. Denoise
        4. Apply threshold
        5. Deskew if needed
        6. Enhance contrast
        """
        # Read image
        img = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")

        logger.info(f"Original size: {img.shape}")

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        logger.info("✓ Converted to grayscale")

        # Denoise
        denoised = cv2.medianBlur(gray, 5)
        logger.info("✓ Applied median filter (denoising)")

        # Enhance contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        logger.info("✓ Enhanced contrast")

        # Threshold (convert to pure black & white)
        _, threshold = cv2.threshold(enhanced, 150, 255, cv2.THRESH_BINARY)
        logger.info("✓ Applied threshold")

        # Deskew
        deskewed = ReceiptPreprocessor._deskew(threshold)
        logger.info("✓ Deskewed image")

        # Dilate to fill gaps in text
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        dilated = cv2.dilate(deskewed, kernel, iterations=1)
        logger.info("✓ Applied morphological dilation")

        # Resize for consistency
        height, width = dilated.shape
        if width > 1024:
            scale = 1024 / width
            dilated = cv2.resize(dilated, (1024, int(height * scale)))
            logger.info(f"✓ Resized to width=1024")

        if debug:
            cv2.imwrite("debug_01_grayscale.png", gray)
            cv2.imwrite("debug_02_denoised.png", denoised)
            cv2.imwrite("debug_03_enhanced.png", enhanced)
            cv2.imwrite("debug_04_threshold.png", threshold)
            cv2.imwrite("debug_05_deskewed.png", deskewed)
            cv2.imwrite("debug_06_final.png", dilated)

        return dilated

    @staticmethod
    def _deskew(image: np.ndarray) -> np.ndarray:
        """Detect and correct image skew/rotation"""
        try:
            # Find contours
            contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if not contours:
                return image

            # Get bounding rect of largest contour
            largest = max(contours, key=cv2.contourArea)
            rect = cv2.minAreaRect(largest)
            angle = rect[2]

            # Correct if angle is significant
            if abs(angle) > 0.5:  # More than 0.5 degrees
                h, w = image.shape
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, -angle, 1.0)
                rotated = cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
                logger.info(f"  Corrected rotation: {angle:.2f}°")
                return rotated

        except Exception as e:
            logger.warning(f"Deskew failed: {e}")

        return image


# ============================================================================
# ADVANCED RECEIPT PARSING
# ============================================================================

@dataclass
class ReceiptItem:
    """Structured receipt item"""
    item: str
    amount: float
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    confidence: float = 0.5


@dataclass
class ParsedReceipt:
    """Structured receipt data"""
    store_name: Optional[str] = None
    date: Optional[str] = None
    items: List[ReceiptItem] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    payment_method: Optional[str] = None
    confidence: float = 0.0
    warnings: List[str] = None

    def __post_init__(self):
        if self.items is None:
            self.items = []
        if self.warnings is None:
            self.warnings = []

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'store_name': self.store_name,
            'date': self.date,
            'items': [asdict(item) for item in self.items],
            'subtotal': self.subtotal,
            'tax': self.tax,
            'total': self.total,
            'payment_method': self.payment_method,
            'confidence': self.confidence,
            'warnings': self.warnings
        }


class IndianReceiptParser:
    """Parse Indian retail receipts with GST handling"""

    INDIAN_CATEGORIES = {
        'Food & Dining': ['rice', 'milk', 'bread', 'dairy', 'bakery', 'egg', 'chicken', 'meat',
                         'fruit', 'vegetable', 'grocery', 'dal', 'atta', 'flour', 'sugar', 'oil'],
        'Shopping': ['cloth', 'shirt', 'pant', 'shoe', 'dress', 'detergent', 'household'],
        'Healthcare': ['pharmacy', 'medicine', 'health', 'vitamin'],
        'Transport': ['petrol', 'diesel', 'fuel', 'taxi', 'parking'],
        'Utilities': ['electricity', 'water', 'phone', 'internet'],
    }

    @staticmethod
    def parse_indian_receipt(ocr_text: str) -> ParsedReceipt:
        """Parse Indian receipt in detail"""
        receipt = ParsedReceipt()

        lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]

        # Extract store name
        for line in lines[:5]:
            if len(line) > 5 and not any(x in line.lower() for x in
                                        ['receipt', 'item', 'date', 'amount']):
                receipt.store_name = line
                break

        # Extract date
        date_pattern = r'\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b'
        date_match = re.search(date_pattern, ocr_text)
        if date_match:
            receipt.date = date_match.group(1)

        # Extract items
        items_section = False
        for line in lines:
            # Skip metadata
            if re.search(r'receipt|date|time|store|thank|address|phone', line, re.I):
                continue

            # Detect items section
            if re.search(r'items?|description|product|qty', line, re.I):
                items_section = True
                continue

            # Stop at totals
            if re.search(
                r'subtotal|total|grand total|balance|cash|paid|change',
                line, re.I):
                items_section = False

                # Extract total
                total_match = re.search(r'₹\s*([\d,]+\.?\d*)', line)
                if total_match:
                    receipt.total = IndianReceiptParser.parse_indian_amount(total_match.group(1))
                continue

            # Parse line item
            if items_section or len(receipt.items) == 0:
                item = IndianReceiptParser.parse_line(line)
                if item:
                    receipt.items.append(item)

        # Extract GST info
        gst_pattern = r'GST\s*(\d+)%?\s*[:=]?\s*₹\s*([\d,]+\.?\d*)'
        for match in re.finditer(gst_pattern, ocr_text, re.I):
            rate = int(match.group(1))
            amount = IndianReceiptParser.parse_indian_amount(match.group(2))
            if rate == 18:  # Most common in India
                receipt.tax = amount

        receipt.confidence = ReceiptParser.calculate_confidence(receipt)
        return receipt

    @staticmethod
    def parse_line(line: str) -> Optional[ReceiptItem]:
        """Parse single receipt line"""
        # Pattern: "Item (qty unit) ... ₹amount"
        patterns = [
            r'^(.+?)\s*\(?([\d.]+)\s*([a-z]+)\)?\s*[.\s]+₹\s*([\d,]+\.?\d*)',  # With qty
            r'^(.+?)\s+[.\s]+₹\s*([\d,]+\.?\d*)',  # Without qty
        ]

        for pattern in patterns:
            match = re.search(pattern, line, re.I)
            if match:
                groups = match.groups()
                item_name = groups[0].strip()

                # Validate item name
                if not re.search(r'[a-z]', item_name, re.I) or len(item_name) < 2:
                    continue

                amount = IndianReceiptParser.parse_indian_amount(groups[-1])
                if not amount or amount <= 0 or amount >= 100000:
                    continue

                quantity = float(groups[1]) if len(groups) > 2 and groups[1] else None
                unit = groups[2] if len(groups) > 2 and groups[2] else None

                return ReceiptItem(
                    item=item_name,
                    amount=amount,
                    quantity=quantity,
                    unit=unit,
                    category=IndianReceiptParser.categorize(item_name),
                    confidence=0.7
                )

        return None

    @staticmethod
    def parse_indian_amount(amount_str: str) -> Optional[float]:
        """Parse Indian amount format: ₹1,00,000.50"""
        cleaned = re.sub(r'[₹Rs]|\s', '', amount_str, flags=re.I)
        # Remove all commas to handle 1,00,000 format
        cleaned = cleaned.replace(',', '')
        try:
            return float(cleaned)
        except ValueError:
            return None

    @staticmethod
    def categorize(item_name: str) -> str:
        """Categorize item by name"""
        lower = item_name.lower()
        for category, keywords in IndianReceiptParser.INDIAN_CATEGORIES.items():
            if any(kw in lower for kw in keywords):
                return category
        return 'Other'


class ReceiptParser:
    """Generic receipt parser for all receipts"""

    @staticmethod
    def is_indian_receipt(text: str) -> bool:
        """Detect if receipt is from Indian store"""
        indicators = [
            r'₹',  # Rupee symbol
            r'GST',  # Indian tax
            r'Big Bazaar|DMart|Reliance',  # Common Indian stores
            r'\bINR\b'
        ]
        return any(re.search(pattern, text, re.I) for pattern in indicators)

    @staticmethod
    def parse_receipt(ocr_text: str) -> ParsedReceipt:
        """Parse receipt generically"""
        # Use Indian parser if detected
        if ReceiptParser.is_indian_receipt(ocr_text):
            return IndianReceiptParser.parse_indian_receipt(ocr_text)

        # Generic parsing
        receipt = ParsedReceipt()
        lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]

        # Extract first non-metadata line as store
        for line in lines[:3]:
            if len(line) > 5:
                receipt.store_name = line
                break

        # Extract date
        date_pattern = r'\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b'
        date_match = re.search(date_pattern, ocr_text)
        if date_match:
            receipt.date = date_match.group(1)

        # Extract items and amounts
        for line in lines:
            if not any(x in line.lower() for x in ['total', 'receipt', 'date']):
                # Look for amount pattern
                amount_match = re.search(r'[$₹]?\s*([\d,]+\.?\d*)\s*$', line)
                if amount_match and re.search(r'[a-zA-Z]', line):
                    amount = float(amount_match.group(1).replace(',', ''))
                    if 0 < amount < 100000:
                        item_name = re.sub(r'[$₹]?\s*([\d,]+\.?\d*)\s*$', '', line).strip()
                        if len(item_name) > 2:
                            receipt.items.append(ReceiptItem(
                                item=item_name,
                                amount=amount,
                                confidence=0.6
                            ))

        # Extract total
        total_match = re.search(r'(?:total|balance|due).*?[$₹]?\s*([\d,]+\.?\d*)', ocr_text, re.I)
        if total_match:
            receipt.total = float(total_match.group(1).replace(',', ''))

        receipt.confidence = ReceiptParser.calculate_confidence(receipt)
        return receipt

    @staticmethod
    def calculate_confidence(receipt: ParsedReceipt) -> float:
        """Calculate parse confidence score 0-1"""
        score = 0.0

        if receipt.store_name:
            score += 0.15
        if receipt.date:
            score += 0.15
        if receipt.items:
            score += min(0.3, len(receipt.items) * 0.05)
        if receipt.total:
            score += 0.2
        if len(receipt.warnings) == 0:
            score += 0.15

        return min(1.0, score)


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def process_receipt_image(image_path: str, preprocess: bool = True,
                         debug: bool = False) -> ParsedReceipt:
    """
    Process receipt image end-to-end
    
    Args:
        image_path: Path to receipt image
        preprocess: Apply preprocessing pipeline
        debug: Save debug images
        
    Returns:
        ParsedReceipt object with structured data
    """
    logger.info(f"Processing: {image_path}")

    # Step 1: Preprocess
    if preprocess:
        logger.info("Preprocessing image...")
        processed_img = ReceiptPreprocessor.preprocess_receipt(image_path, debug)
        # Save temp
        temp_path = "temp_preprocessed.png"
        cv2.imwrite(temp_path, processed_img)
        ocr_image = temp_path
    else:
        ocr_image = image_path

    # Step 2: OCR
    logger.info("Running OCR...")
    try:
        ocr_text = pytesseract.image_to_string(ocr_image)
        logger.info(f"OCR extracted {len(ocr_text)} characters")
    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise

    # Step 3: Parse
    logger.info("Parsing receipt...")
    receipt = ReceiptParser.parse_receipt(ocr_text)

    # Step 4: Cleanup
    if preprocess and Path("temp_preprocessed.png").exists():
        Path("temp_preprocessed.png").unlink()

    logger.info(f"✓ Completed. Found {len(receipt.items)} items. "
               f"Confidence: {receipt.confidence:.0%}")

    return receipt


if __name__ == '__main__':
    # Example usage
    result = process_receipt_image("sample_receipt.jpg", preprocess=True, debug=True)
    print(result.to_dict())
