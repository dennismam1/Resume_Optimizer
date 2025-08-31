const fs = require('fs');

// Dynamically import text extraction libraries
let pdfParse;
let mammoth;
let Tesseract;

try {
  pdfParse = require('pdf-parse');
} catch (e) {}

try {
  mammoth = require('mammoth');
} catch (e) {}

try {
  Tesseract = require('tesseract.js');
} catch (e) {}

/**
 * Extract plain text from an uploaded file based on its MIME type
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromFile(filePath, mimeType) {
  if (!filePath || !mimeType) return '';

  // PDF
  if (mimeType === 'application/pdf') {
    if (!pdfParse) throw new Error('pdf-parse not installed');
    const dataBuffer = fs.readFileSync(filePath);
    const result = await pdfParse(dataBuffer);
    return result.text || '';
  }

  // DOC / DOCX
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    if (!mammoth) throw new Error('mammoth not installed');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  // Images → OCR
  if (
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/gif' ||
    mimeType === 'image/webp'
  ) {
    if (!Tesseract) throw new Error('tesseract.js not installed');
    const { data } = await Tesseract.recognize(filePath, 'eng');
    return data && data.text ? data.text : '';
  }

  // Fallback: try read as text
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

module.exports = {
  extractTextFromFile
};
