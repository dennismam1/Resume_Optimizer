const express = require('express');
const path = require('path');
const { Submission } = require('../models/Submission');
const { upload } = require('../middleware');

const router = express.Router();

// Create submission with both resume and job posting files
router.post('/submissions', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'jobPost', maxCount: 1 }]), async (req, res) => {
  try {
    const { message } = req.body;
    const resumeFile = req.files && req.files['file'] ? req.files['file'][0] : null;
    const jobPostFile = req.files && req.files['jobPost'] ? req.files['jobPost'][0] : null;

    if (!resumeFile && !jobPostFile && !message) {
      return res.status(400).json({ error: 'Provide at least a resume file, job posting file, or a message.' });
    }

    const newSubmission = new Submission({
      // Resume file
      fileOriginalName: resumeFile ? resumeFile.originalname : undefined,
      fileStoredName: resumeFile ? path.basename(resumeFile.path) : undefined,
      fileMimeType: resumeFile ? resumeFile.mimetype : undefined,
      filePath: resumeFile ? resumeFile.path : undefined,
      fileSize: resumeFile ? resumeFile.size : undefined,
      
      // Job posting file
      jobPostOriginalName: jobPostFile ? jobPostFile.originalname : undefined,
      jobPostStoredName: jobPostFile ? path.basename(jobPostFile.path) : undefined,
      jobPostMimeType: jobPostFile ? jobPostFile.mimetype : undefined,
      jobPostFilePath: jobPostFile ? jobPostFile.path : undefined,
      jobPostFileSize: jobPostFile ? jobPostFile.size : undefined,
      
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
router.get('/submissions', async (req, res) => {
  try {
    const items = await Submission.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list submissions' });
  }
});

// Get single submission
router.get('/submissions/:id', async (req, res) => {
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

module.exports = router;
