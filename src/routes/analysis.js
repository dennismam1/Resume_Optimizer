const express = require('express');
const { Submission } = require('../models/Submission');
const { extractTextFromFile } = require('../utils/textExtraction');
const { callOpenAI, extractJsonFromString } = require('../services/openaiService');
const { buildPrompt, buildJobPostingKeywordPrompt } = require('../utils/promptBuilders');
const { calculateSemanticSimilarity } = require('../utils/atsScoring');
const { getOrParseBothData, getOrParseResumeData } = require('../utils/dataCache');
const { upload } = require('../middleware');
const config = require('../config');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test OpenAI API
router.get('/test-openai', async (req, res) => {
  try {
    if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    const testPrompt = 'Extract JSON from this resume: John Doe, email: john@test.com, skills: JavaScript. Return: {"name": "John Doe", "email": "john@test.com", "skills": ["JavaScript"]}';
    
    const response = await callOpenAI(testPrompt);
    
    res.json({
      success: true,
      model: config.OPENAI_MODEL_ID,
      response: response,
      generated_text: response
    });
  } catch (error) {
    console.error('OpenAI Test Error:', error);
    res.status(500).json({ 
      error: error.message,
      model: config.OPENAI_MODEL_ID,
      apiKeyPrefix: config.OPENAI_API_KEY.substring(0, 8) + '...'
    });
  }
});

// Analyze a resume file + optional filters/message → structured JSON
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    const uploadedFile = req.file || null;
    const { filters, message, submissionId, fileStoredName, calculateATS } = req.body;

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
      const item = await Submission.findOne({ _id: String(submissionId), userId: req.user?.id }).lean();
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
      const item = await Submission.findOne({ fileStoredName: String(fileStoredName), userId: req.user?.id }).lean();
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

    // Handle ATS score calculation
    if (calculateATS === 'true') {
      if (!submissionId) {
        return res.status(400).json({ error: 'submissionId required for ATS calculation' });
      }

      try {
        // Use cached data or parse if not available, enforcing ownership
        const { resumeData, jobPostingData } = await getOrParseBothData(
          String(submissionId), 
          filtersArray, 
          message,
          req.user?.id
        );

        // Calculate ATS score
        const atsResult = calculateSemanticSimilarity(resumeData, jobPostingData);

        // Persist to ATS history for the submission
        try {
          await Submission.updateOne({ _id: String(submissionId), userId: req.user?.id }, {
            $push: {
              atsHistory: {
                score: atsResult.ats_score,
                result: atsResult,
                createdAt: new Date()
              }
            }
          });
        } catch (persistErr) {
          console.error('Failed to persist ATS history:', persistErr);
        }

        return res.json({
          ok: true,
          model: config.NEBIUS_MODEL_ID,
          type: 'ats_analysis',
          resume_analysis: resumeData,
          job_posting_analysis: jobPostingData,
          ats_result: atsResult
        });
      } catch (err) {
        console.error('ATS calculation error:', err);
        return res.status(422).json({ 
          error: 'Failed to calculate ATS score', 
          details: err.message 
        });
      }
    }

    // Regular resume analysis
    let json, rawResponse;
    
    // Try to use cached data if submissionId is provided and we have cached resume data
    if (submissionId) {
      try {
        const item = await Submission.findOne({ _id: String(submissionId), userId: req.user?.id });
        if (item && item.resumeData && item.resumeDataParsedAt) {
          console.log('Using cached resume data for regular analysis');
          json = item.resumeData;
          rawResponse = 'Used cached data';
        }
      } catch (err) {
        console.log('Failed to retrieve cached data, falling back to LLM parsing');
      }
    }
    
    // If no cached data available, parse with LLM
    if (!json) {
      const prompt = buildPrompt(resumeText, filtersArray, message);
      rawResponse = await callOpenAI(prompt);
      console.log('OpenAI Raw Response:', rawResponse); // Debug log
      json = extractJsonFromString(rawResponse);
      
      // Cache the result if we have a submissionId
      if (submissionId && json) {
        try {
          await Submission.updateOne({ _id: String(submissionId), userId: req.user?.id }, {
            resumeData: json,
            resumeText: resumeText,
            resumeDataParsedAt: new Date()
          });
          console.log('Cached resume data for submission:', submissionId);
        } catch (err) {
          console.error('Failed to cache resume data:', err);
        }
      }
    }

    if (!json) {
      return res.status(200).json({
        ok: true,
        model: config.OPENAI_MODEL_ID,
        usedFilters: filtersArray,
        structured: null,
        raw: rawResponse
      });
    }

    res.json({
      ok: true,
      model: config.OPENAI_MODEL_ID,
      usedFilters: filtersArray,
      structured: json,
      raw: rawResponse
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze resume', details: err.message });
  }
});

module.exports = router;
