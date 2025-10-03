const fs = require('fs');
const puppeteer = require('puppeteer');

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
 * Extract text content from a public web page URL using headless browser
 * - Strips scripts/styles and returns visible text
 * - Waits for network idle for basic client-side rendered pages
 * @param {string} url
 * @returns {Promise<string>}
 */
async function extractTextFromUrl(url) {
  if (!url) return '';
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 45000 });
    // remove script/style and get innerText
    const text = await page.evaluate(() => {
      const cloned = document.documentElement.cloneNode(true);
      // remove script and style
      cloned.querySelectorAll('script, style, noscript').forEach(n => n.remove());
      // attempt to remove nav/footer if overly long
      cloned.querySelectorAll('header, nav, footer').forEach(n => n.remove());
      const body = cloned.querySelector('body') || cloned;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
      const chunks = [];
      /** @type {Text} */
      let node;
      while ((node = walker.nextNode())) {
        const s = node.textContent.replace(/\s+/g, ' ').trim();
        if (s.length) chunks.push(s);
      }
      return chunks.join('\n');
    });
    return text || '';
  } catch (err) {
    return '';
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

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
  extractTextFromFile,
  extractTextFromUrl
};
