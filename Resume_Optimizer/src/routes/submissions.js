const express = require('express');
const path = require('path');
const { Submission } = require('../models/Submission');
const { upload } = require('../middleware');

const router = express.Router();

// ATS History endpoint: returns chronological (ascending) series of {date, score}
router.get('/ats/history', async (req, res) => {
  try {
    // Fetch latest 100 submissions with any atsHistory entries
    const submissions = await Submission.find({ 'atsHistory.0': { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Flatten and sort all history points by their createdAt
    const points = [];
    for (const sub of submissions) {
      for (const h of (sub.atsHistory || [])) {
        if (h && typeof h.score === 'number' && h.createdAt) {
          points.push({ date: new Date(h.createdAt), score: h.score });
        }
      }
    }
    points.sort((a, b) => a.date - b.date);

    res.json({ items: points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ATS history' });
  }
});

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
    
    // Enrich submissions with job info and latest ATS scores
    const enrichedItems = items.map(item => {
      const jobTitle = item.jobPostingData?.job_title || 'Position Not Specified';
      const companyName = item.jobPostingData?.company_name || 'Company Not Specified';
      const latestATS = item.atsHistory && item.atsHistory.length > 0 
        ? item.atsHistory[item.atsHistory.length - 1] 
        : null;
      
      // Use manual interview date if set, otherwise null
      const interviewDate = item.interviewDate || null;
      
      return {
        ...item,
        jobTitle,
        companyName,
        latestATSScore: latestATS?.score || null,
        lastAnalyzed: latestATS?.createdAt || item.createdAt,
        interviewDate,
        // Use manual status if set, otherwise derive from ATS score
        manualStatus: item.applicationStatus || null,
        notes: item.notes || ''
      };
    });
    
    res.json({ items: enrichedItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list submissions' });
  }
});

// Get submission statistics
router.get('/submissions/stats', async (req, res) => {
  try {
    // Get total count
    const totalCount = await Submission.countDocuments();
    
    // Get count for this week
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weeklyCount = await Submission.countDocuments({
      createdAt: { $gte: startOfWeek }
    });

    // Get submissions with ATS history
    const submissions = await Submission.find(
      { 'atsHistory.0': { $exists: true } },
      { atsHistory: 1, createdAt: 1 }
    ).lean();

    // Calculate overall average
    let totalScore = 0;
    let scoreCount = 0;
    let weeklyScores = [];
    let previousWeekScores = [];

    const previousWeekStart = new Date(startOfWeek);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    submissions.forEach(sub => {
      const latestScore = sub.atsHistory[sub.atsHistory.length - 1]?.score;
      if (typeof latestScore === 'number') {
        totalScore += latestScore;
        scoreCount++;

        if (sub.createdAt >= startOfWeek) {
          weeklyScores.push(latestScore);
        } else if (sub.createdAt >= previousWeekStart && sub.createdAt < startOfWeek) {
          previousWeekScores.push(latestScore);
        }
      }
    });

    // Calculate averages
    const overallAvg = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    const weeklyAvg = weeklyScores.length > 0 
      ? Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length) 
      : 0;
    const previousWeekAvg = previousWeekScores.length > 0
      ? Math.round(previousWeekScores.reduce((a, b) => a + b, 0) / previousWeekScores.length)
      : 0;

    // Calculate improvement
    let improvement = 0;
    if (weeklyAvg > 0 && previousWeekAvg > 0) {
      improvement = weeklyAvg - previousWeekAvg;
    }

    // Count interviews scheduled
    const interviewsScheduled = await Submission.countDocuments({
      applicationStatus: 'Interview Scheduled'
    });

    res.json({
      total: totalCount,
      weekly: weeklyCount,
      interviews: interviewsScheduled,
      ats: {
        average: overallAvg,
        weeklyAverage: weeklyAvg,
        previousWeekAverage: previousWeekAvg,
        improvement: improvement
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get submission stats' });
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

// Update submission details
router.put('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, jobTitle, applicationStatus, interviewDate, notes } = req.body;
    
    const updateData = {};
    
    // Update job posting data if company name or job title changed
    if (companyName || jobTitle) {
      const item = await Submission.findById(id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      
      const currentJobData = item.jobPostingData || {};
      updateData.jobPostingData = {
        ...currentJobData,
        ...(companyName && { company_name: companyName }),
        ...(jobTitle && { job_title: jobTitle })
      };
    }
    
    // Update application tracking fields
    if (applicationStatus) updateData.applicationStatus = applicationStatus;
    if (interviewDate) updateData.interviewDate = new Date(interviewDate);
    if (notes !== undefined) updateData.notes = notes;
    
    const updatedItem = await Submission.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Application updated successfully', submission: updatedItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// Delete submission
router.delete('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Submission.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Submission deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

module.exports = router;