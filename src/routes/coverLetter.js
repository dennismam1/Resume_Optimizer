const express = require('express');
const { Submission } = require('../models/Submission');
const { extractTextFromFile } = require('../utils/textExtraction');
const { callOpenAI, extractJsonFromString } = require('../services/openaiService');
const { buildPrompt, buildJobPostingKeywordPrompt, buildCoverLetterPrompt } = require('../utils/promptBuilders');
const { generateWordDocument, generatePDFDocument } = require('../utils/documentGeneration');
const { getOrParseBothData } = require('../utils/dataCache');
const config = require('../config');

const router = express.Router();

// Generate cover letter based on resume and job posting
router.post('/generate-cover-letter', async (req, res) => {
  try {
    console.log('Cover letter request body:', req.body);
    const { submissionId, tone, length } = req.body;

    if (!submissionId) {
      console.log('Missing submissionId in request body');
      return res.status(400).json({ error: 'submissionId is required' });
    }

    // Use cached data or parse if not available
    const { resumeData, jobPostingData, resumeText, jobPostingText } = await getOrParseBothData(
      String(submissionId),
      [],
      '',
      req.user?.id
    );

    // Generate cover letter using OpenAI
    const coverLetterPrompt = buildCoverLetterPrompt(resumeText, jobPostingText, resumeData, jobPostingData, { tone, length });
    const coverLetterResponse = await callOpenAI(coverLetterPrompt);

    return res.json({
      ok: true,
      model: config.OPENAI_MODEL_ID,
      type: 'cover_letter',
      cover_letter: coverLetterResponse,
      resume_data: resumeData,
      job_posting_data: jobPostingData
    });

  } catch (err) {
    console.error('Cover letter generation error:', err);
    res.status(500).json({ error: 'Failed to generate cover letter', details: err.message });
  }
});

// Export cover letter as Word document
router.post('/export-cover-letter/word', async (req, res) => {
  try {
    console.log('Word export request body:', req.body);
    const { submissionId, tone, length } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }

    // Use cached data or parse if not available
    const { resumeData, jobPostingData, resumeText, jobPostingText } = await getOrParseBothData(
      String(submissionId),
      [],
      '',
      req.user?.id
    );

    // Generate cover letter
    const coverLetterPrompt = buildCoverLetterPrompt(resumeText, jobPostingText, resumeData, jobPostingData, { tone, length });
    const coverLetterText = await callOpenAI(coverLetterPrompt);

    // Generate Word document
    const wordBuffer = await generateWordDocument(coverLetterText, resumeData.full_name);

    // Set headers for download
    const filename = `Cover_Letter_${resumeData.full_name || 'Applicant'}_${Date.now()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', wordBuffer.length);

    res.send(wordBuffer);

  } catch (err) {
    console.error('Word export error:', err);
    res.status(500).json({ error: 'Failed to export cover letter as Word document', details: err.message });
  }
});

// Export cover letter as PDF
router.post('/export-cover-letter/pdf', async (req, res) => {
  try {
    console.log('PDF export request body:', req.body);
    const { submissionId, tone, length } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }

    // Use cached data or parse if not available
    const { resumeData, jobPostingData, resumeText, jobPostingText } = await getOrParseBothData(
      String(submissionId),
      [],
      '',
      req.user?.id
    );

    // Generate cover letter
    const coverLetterPrompt = buildCoverLetterPrompt(resumeText, jobPostingText, resumeData, jobPostingData, { tone, length });
    const coverLetterText = await callOpenAI(coverLetterPrompt);

    // Generate PDF document
    const pdfBuffer = await generatePDFDocument(coverLetterText, resumeData.full_name);

    // Set headers for download
    const filename = `Cover_Letter_${resumeData.full_name || 'Applicant'}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: 'Failed to export cover letter as PDF', details: err.message });
  }
});

module.exports = router;
