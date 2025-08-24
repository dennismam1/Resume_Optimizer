const path = require('path');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const validator = require('validator');
require('dotenv').config();

// Text extractors and HTTP client
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

const { Submission } = require('./models/Submission');

const app = express();

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload directory setup
const uploadDirectory = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${safeOriginal}`);
  },
});

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
});

// Static files
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadDirectory));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test Nebius API
app.get('/api/test-nebius', async (req, res) => {
  try {
    if (!NEBIUS_API_KEY || NEBIUS_API_KEY === 'your-nebius-api-key-here') {
      return res.status(500).json({ error: 'Nebius API key not configured' });
    }
    
    const testPrompt = 'Extract JSON from this resume: John Doe, email: john@test.com, skills: JavaScript. Return: {"name": "John Doe", "email": "john@test.com", "skills": ["JavaScript"]}';
    
    const response = await callNebius(testPrompt);
    
    res.json({
      success: true,
      model: NEBIUS_MODEL_ID,
      response: response,
      generated_text: response
    });
  } catch (error) {
    console.error('Nebius Test Error:', error);
    res.status(500).json({ 
      error: error.message,
      model: NEBIUS_MODEL_ID,
      apiKeyPrefix: NEBIUS_API_KEY.substring(0, 8) + '...'
    });
  }
});

// --- Utilities ---
// Nebius Studio configuration
const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IlV6SXJWd1h0dnprLVRvdzlLZWstc0M1akptWXBvX1VaVkxUZlpnMDRlOFUiLCJ0eXAiOiJKV1QifQ.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDExNDQzMDU5NjYxOTQ1OTY5MTE1MyIsInNjb3BlIjoib3BlbmlkIG9mZmxpbmVfYWNjZXNzIiwiaXNzIjoiYXBpX2tleV9pc3N1ZXIiLCJhdWQiOlsiaHR0cHM6Ly9uZWJpdXMtaW5mZXJlbmNlLmV1LmF1dGgwLmNvbS9hcGkvdjIvIl0sImV4cCI6MTkxMzcyMjgwOSwidXVpZCI6IjdkNWFmOTZmLTBiODQtNDA5NS1iZWU4LThhMGNiN2Q5M2M4YiIsIm5hbWUiOiJEZW5uaXMiLCJleHBpcmVzX2F0IjoiMjAzMC0wOC0yM1QxMzo0MDowOSswMDAwIn0.pC5PTOOdZYMhEDV5KeCqGurz2X2bcbIg1p23S-zkQXo';
const NEBIUS_MODEL_ID = process.env.NEBIUS_MODEL_ID || 'meta-llama/Llama-3.3-70B-Instruct';
const NEBIUS_API_URL = 'https://api.studio.nebius.com/v1/chat/completions';

/**
 * Extract plain text from an uploaded file based on its MIME type
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

function buildPrompt(resumeText, filters, freeformMessage) {
  const defaultFields = [
    'full_name',
    'email',
    'phone',
    'years_of_experience',
    'current_title',
    'skills',
    'education',
    'certifications',
    'notable_projects'
  ];

  const requestedFields = Array.isArray(filters) && filters.length > 0
    ? filters
    : defaultFields;

  const fieldsList = requestedFields.map(f => `- ${f}`).join('\n');

  const instructions = `You are an information extraction system. Given a resume and optional criteria, extract the requested fields.\n\nRequirements:\n- Output ONLY valid JSON.\n- Include all requested fields exactly as keys.\n- Use null when a field is not found.\n- For \\"skills\\", return an array of strings.\n- Keep values concise.\n\nRequested fields:\n${fieldsList}\n\nOptional guidance from user: ${freeformMessage || 'N/A'}\n\nResume:\n"""\n${resumeText}\n"""\n\nReturn JSON only.`;

  return instructions;
}

async function callNebius(prompt) {
  if (!NEBIUS_API_KEY || NEBIUS_API_KEY === 'your-nebius-api-key-here') {
    throw new Error('Missing Nebius API key. Set NEBIUS_API_KEY environment variable.');
  }

  try {
    console.log('Calling Nebius with model:', NEBIUS_MODEL_ID);
    console.log('API Key starts with:', NEBIUS_API_KEY.substring(0, 8) + '...');
    
    const requestBody = {
      model: NEBIUS_MODEL_ID,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts structured information from resumes and returns valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 512,
      temperature: 0.2,
      top_p: 0.9
    };

    const response = await fetch(NEBIUS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NEBIUS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nebius API call failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Nebius Response object:', data);
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      throw new Error('Unexpected response format from Nebius API');
    }
  } catch (error) {
    console.error('Nebius API Error:', error);
    if (error.message.includes('401')) {
      throw new Error('Invalid Nebius API key. Check your NEBIUS_API_KEY.');
    }
    if (error.message.includes('404')) {
      throw new Error(`Model ${NEBIUS_MODEL_ID} not found. Try a different model.`);
    }
    throw new Error(`Nebius API error: ${error.message}`);
  }
}

function extractJsonFromString(text) {
  if (!text) return null;
  // Try to find a fenced code block first
  const codeBlockMatch = text.match(/```(?:json)?\n([\s\S]*?)```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : text;

  // Find the first JSON object by brace matching
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const jsonSlice = candidate.slice(start, i + 1);
        try {
          return JSON.parse(jsonSlice);
        } catch (e) {
          // continue searching if parse fails
        }
      }
    }
  }
  return null;
}

// Analyze a resume file + optional filters/message → structured JSON

// need to code this line clean
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    const uploadedFile = req.file || null;
    const { filters, message, submissionId, fileStoredName } = req.body;

    const filtersArray = (() => {
      if (!filters) return [];
      if (Array.isArray(filters)) return filters;
      if (typeof filters === 'string') {
        // split by comma or newline
        return filters
          .split(/[,\n]/)
          .map(s => s.trim())
          .filter(Boolean);
      }
      return [];
    })();

    let resumeText = '';
    // Priority: submissionId → uploaded file → fileStoredName → raw text
    if (submissionId) {
      const item = await Submission.findById(String(submissionId)).lean();
      if (!item) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      if (!item.filePath || !item.fileMimeType) {
        return res.status(400).json({ error: 'Submission has no stored file to analyze' });
      }
      resumeText = await extractTextFromFile(item.filePath, item.fileMimeType);
      if (!resumeText || resumeText.trim().length === 0) {
        return res.status(422).json({ error: 'Failed to extract text from the stored file.' });
      }
    } else if (uploadedFile) {
      resumeText = await extractTextFromFile(uploadedFile.path, uploadedFile.mimetype);
      if (!resumeText || resumeText.trim().length === 0) {
        return res.status(422).json({ error: 'Failed to extract text from the uploaded file.' });
      }
    } else if (fileStoredName) {
      const item = await Submission.findOne({ fileStoredName: String(fileStoredName) }).lean();
      if (!item) {
        return res.status(404).json({ error: 'Submission with given fileStoredName not found' });
      }
      resumeText = await extractTextFromFile(item.filePath, item.fileMimeType);
      if (!resumeText || resumeText.trim().length === 0) {
        return res.status(422).json({ error: 'Failed to extract text from the stored file.' });
      }
    } else if (req.body && req.body.text) {
      const raw = String(req.body.text || '');
      resumeText = raw;
    } else {
      return res.status(400).json({ error: 'Provide a submissionId, a resume file, a fileStoredName, or raw text in "text".' });
    }

    const prompt = buildPrompt(resumeText, filtersArray, message);
    const rawResponse = await callNebius(prompt);
    console.log('Nebius Raw Response:', rawResponse); // Debug log
    const json = extractJsonFromString(rawResponse);

    if (!json) {
      return res.status(200).json({
        ok: true,
        model: NEBIUS_MODEL_ID,
        usedFilters: filtersArray,
        structured: null,
        raw: rawResponse
      });
    }

    res.json({
      ok: true,
      model: NEBIUS_MODEL_ID,
      usedFilters: filtersArray,
      structured: json,
      raw: rawResponse
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze resume', details: err.message });
  }
});

// Create submission
app.post('/api/submissions', upload.single('file'), async (req, res) => {
  try {
    const { link, message } = req.body;
    const uploadedFile = req.file || null;

    if (!uploadedFile && !link && !message) {
      return res.status(400).json({ error: 'Provide at least a file, a link, or a message.' });
    }

    let linkUrl = undefined;
    if (link && link.trim().length > 0) {
      const trimmed = link.trim();
      if (!validator.isURL(trimmed, { require_protocol: true })) {
        return res.status(400).json({ error: 'Invalid link. Include protocol, e.g., https://example.com' });
      }
      linkUrl = trimmed;
    }

    const newSubmission = new Submission({
      fileOriginalName: uploadedFile ? uploadedFile.originalname : undefined,
      fileStoredName: uploadedFile ? path.basename(uploadedFile.path) : undefined,
      fileMimeType: uploadedFile ? uploadedFile.mimetype : undefined,
      filePath: uploadedFile ? uploadedFile.path : undefined,
      fileSize: uploadedFile ? uploadedFile.size : undefined,
      linkUrl,
      message: message && message.trim().length > 0 ? message.trim() : undefined,
    });

    const saved = await newSubmission.save();
    res.status(201).json({
      message: 'Submission saved',
      submission: saved,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

// List submissions
app.get('/api/submissions', async (req, res) => {
  try {
    const items = await Submission.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list submissions' });
  }
});

// Get single submission
app.get('/api/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Submission.findById(id).lean();
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get submission' });
  }
});

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Mongo connection and server start
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/resume_optimizer';

mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });


