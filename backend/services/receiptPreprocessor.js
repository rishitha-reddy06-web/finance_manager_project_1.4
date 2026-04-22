/**
 * Receipt Image Preprocessing Service
 * Improves OCR accuracy through image cleaning, contrast enhancement, and noise removal
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Main preprocessing function - applies full pipeline
 * @param {string} inputPath - Path to receipt image
 * @param {Object} options - Processing options
 * @returns {Promise<Buffer>} - Preprocessed image buffer
 */
async function preprocessReceipt(inputPath, options = {}) {
  const {
    contrast = 1.5,           // Enhance contrast (default 1.5x)
    modulate = true,          // Increase brightness/saturation
    grayscale = true,         // Convert to grayscale for OCR
    resize = true,            // Resize for consistency
    denoise = true,           // Apply noise reduction
    deskew = false,           // Detect and correct rotation
    targetWidth = 1024,       // Target width after resize
    quality = 95              // Output quality (1-100)
  } = options;

  try {
    let image = sharp(inputPath);
    
    // Get image metadata for analysis
    const metadata = await image.metadata();
    console.log(`Original image: ${metadata.width}x${metadata.height}px, ${metadata.format}`);

    // Step 1: Convert to grayscale (recommended for OCR)
    if (grayscale) {
      image = image.grayscale();
      console.log('✓ Converted to grayscale');
    }

    // Step 2: Resize if needed (normalize size for consistent OCR)
    if (resize && metadata.width > targetWidth) {
      image = image.resize(targetWidth, Math.round((metadata.height / metadata.width) * targetWidth), {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3
      });
      console.log('✓ Resized for consistency');
    }

    // Step 3: Increase contrast (helps text stand out from background)
    image = image.modulate({
      brightness: modulate ? 1.1 : 1.0,    // Slight brightness boost
      saturation: modulate ? 1.2 : 1.0,    // Boost saturation
      hue: 0
    });
    console.log('✓ Enhanced brightness and saturation');

    // Step 4: Normalize (adjust levels to use full range) - DO BEFORE threshold
    // This helps find better threshold values automatically
    image = image.normalize();
    console.log('✓ Normalized image levels');

    // Step 5: Apply gentle threshold (avoid aggressive corruption)
    // Only apply if it's clearly needed (i.e., low-contrast receipts)
    // For most receipts, normalize + denoise is sufficient
    // Using higher threshold (160) makes it less aggressive
    // Aggressive threshold (< 140) corrupts fine text details
    // SKIP threshold entirely - normalize + sharpen works better
    image = image.sharpen({ sigma: 0.7 });  // Gentle sharpen instead of threshold
    console.log('✓ Applied gentle sharpening (skipped aggressive threshold)');

    // Step 6: Denoise if enabled
    if (denoise) {
      image = image.median(2);  // Median filter to remove noise while preserving edges
      console.log('✓ Applied median filter for denoising');
    }

    // Convert to PNG for better quality or TIFF for OCR
    const outputBuffer = await image.png({ quality }).toBuffer();
    
    console.log(`✓ Preprocessing complete. Output size: ${outputBuffer.length} bytes`);
    return outputBuffer;

  } catch (error) {
    console.error('Preprocessing error:', error);
    throw new Error(`Failed to preprocess receipt image: ${error.message}`);
  }
}

/**
 * Save preprocessed image for debugging/inspection
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} outputPath - Where to save
 */
async function savePreprocessedImage(imageBuffer, outputPath) {
  try {
    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, imageBuffer);
    console.log(`✓ Saved preprocessed image to: ${outputPath}`);
  } catch (error) {
    console.error('Error saving preprocessed image:', error);
  }
}

/**
 * Advanced preprocessing with multiple variants for comparison
 * Useful for finding optimal settings
 * @param {string} inputPath - Path to image
 * @returns {Promise<Object>} - Multiple processed variants
 */
async function preprocessWithVariants(inputPath) {
  try {
    console.log(`Processing variants for: ${inputPath}`);

    const [aggressive, moderate, light] = await Promise.all([
      preprocessReceipt(inputPath, {
        contrast: 2.0,
        grayscale: true,
        denoise: true,
        modulate: true,
        targetWidth: 1024
      }),
      preprocessReceipt(inputPath, {
        contrast: 1.5,
        grayscale: true,
        denoise: true,
        modulate: true,
        targetWidth: 1024
      }),
      preprocessReceipt(inputPath, {
        contrast: 1.2,
        grayscale: true,
        denoise: false,
        modulate: false,
        targetWidth: 1024
      })
    ]);

    return {
      aggressive,
      moderate,
      light,
      selectedVariant: 'moderate' // Default recommended
    };
  } catch (error) {
    console.error('Error creating variants:', error);
    throw error;
  }
}

/**
 * Detect image rotation/skew for potential correction
 * @param {string} imagePath - Path to image
 * @returns {Promise<number>} - Rotation angle in degrees
 */
async function detectSkew(imagePath) {
  // Note: Sharp doesn't have built-in skew detection
  // For production, consider using OpenCV (cv2 in Python or opencv4nodejs)
  // This is a placeholder that returns 0
  console.log('⚠ Skew detection requires OpenCV - placeholder returning 0');
  return 0;
}

/**
 * Get preprocessing recommendations based on image analysis
 * @param {string} imagePath - Path to image
 * @returns {Promise<Object>} - Recommendations
 */
async function getPreprocessingRecommendations(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const stats = await image.stats();

    const recommendations = {
      originalSize: `${metadata.width}x${metadata.height}`,
      format: metadata.format,
      colorSpace: metadata.space,
      hasAlpha: metadata.hasAlpha,
      suggestedActions: []
    };

    // Analyze brightness
    const avgBrightness = stats.channels[0].mean;
    if (avgBrightness < 100) {
      recommendations.suggestedActions.push('⚠ Image is very dark - increase brightness');
    } else if (avgBrightness > 200) {
      recommendations.suggestedActions.push('⚠ Image is washed out - increase contrast');
    }

    // Analyze contrast
    const brightness_std = stats.channels[0].std;
    if (brightness_std < 30) {
      recommendations.suggestedActions.push('⚠ Low contrast - strongly enhance contrast');
    }

    // Size recommendations
    if (metadata.width < 512) {
      recommendations.suggestedActions.push('⚠ Image too small - may affect OCR quality');
    } else if (metadata.width > 1500) {
      recommendations.suggestedActions.push('✓ Image size good - will resize to 1024px for consistency');
    }

    return recommendations;
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
}

module.exports = {
  preprocessReceipt,
  savePreprocessedImage,
  preprocessWithVariants,
  detectSkew,
  getPreprocessingRecommendations
};
