const { Submission } = require('../models/Submission');
const { extractTextFromFile, extractTextFromUrl } = require('./textExtraction');
const { callNebius, extractJsonFromString } = require('../services/nebiusService');
const { buildPrompt, buildJobPostingKeywordPrompt } = require('./promptBuilders');

/**
 * Get or parse resume data with caching
 * @param {Object} item - Submission document
 * @param {Array} filtersArray - Fields to extract
 * @param {string} message - Additional instructions
 * @returns {Promise<{resumeData: Object, resumeText: string}>}
 */
async function getOrParseResumeData(item, filtersArray = [], message = '') {
  // Check if we have cached resume data
  if (item.resumeData && item.resumeDataParsedAt) {
    console.log('Using cached resume data for submission:', item._id);
    return {
      resumeData: item.resumeData,
      resumeText: item.resumeText || ''
    };
  }

  // Extract text if not cached
  let resumeText = item.resumeText;
  if (!resumeText) {
    console.log('Extracting resume text for submission:', item._id);
    resumeText = await extractTextFromFile(item.filePath, item.fileMimeType);
    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Failed to extract text from resume file');
    }
  }

  // Parse resume data using LLM
  console.log('Parsing resume data with LLM for submission:', item._id);
  const resumePrompt = buildPrompt(resumeText, filtersArray, message);
  const resumeResponse = await callNebius(resumePrompt);
  const resumeData = extractJsonFromString(resumeResponse);

  if (!resumeData) {
    throw new Error('Failed to parse resume data');
  }

  // Cache the results
  await Submission.findByIdAndUpdate(item._id, {
    resumeData: resumeData,
    resumeText: resumeText,
    resumeDataParsedAt: new Date()
  });

  console.log('Cached resume data for submission:', item._id);
  return { resumeData, resumeText };
}

/**
 * Get or parse job posting data with caching
 * @param {Object} item - Submission document
 * @returns {Promise<{jobPostingData: Object, jobPostingText: string}>}
 */
async function getOrParseJobPostingData(item) {
  // Check if we have cached job posting data
  if (item.jobPostingData && item.jobPostingDataParsedAt) {
    console.log('Using cached job posting data for submission:', item._id);
    return {
      jobPostingData: item.jobPostingData,
      jobPostingText: item.jobPostingText || ''
    };
  }

  // Extract text if not cached
  let jobPostingText = item.jobPostingText;
  if (!jobPostingText) {
    console.log('Extracting job posting text for submission:', item._id);
    if (item.jobPostFilePath && item.jobPostMimeType) {
      jobPostingText = await extractTextFromFile(item.jobPostFilePath, item.jobPostMimeType);
    } else if (item.jobPostUrl) {
      jobPostingText = await extractTextFromUrl(item.jobPostUrl);
    }
    if (!jobPostingText || jobPostingText.trim().length === 0) {
      throw new Error('Failed to extract text from job posting (file/URL)');
    }
  }

  // Parse job posting data using LLM
  console.log('Parsing job posting data with LLM for submission:', item._id);
  const jobPostingPrompt = buildJobPostingKeywordPrompt(jobPostingText);
  const jobPostingResponse = await callNebius(jobPostingPrompt);
  const jobPostingData = extractJsonFromString(jobPostingResponse);

  if (!jobPostingData) {
    throw new Error('Failed to parse job posting data');
  }

  // Cache the results
  await Submission.findByIdAndUpdate(item._id, {
    jobPostingData: jobPostingData,
    jobPostingText: jobPostingText,
    jobPostingDataParsedAt: new Date()
  });

  console.log('Cached job posting data for submission:', item._id);
  return { jobPostingData, jobPostingText };
}

/**
 * Get both resume and job posting data with caching
 * @param {string} submissionId - Submission ID
 * @param {string} userId - Current user ID for ownership check
 * @param {Array} filtersArray - Fields to extract for resume
 * @param {string} message - Additional instructions for resume
 * @returns {Promise<{resumeData: Object, jobPostingData: Object, resumeText: string, jobPostingText: string}>}
 */
async function getOrParseBothData(submissionId, filtersArray = [], message = '', userId = null) {
  const query = userId ? { _id: submissionId, userId } : { _id: submissionId };
  const item = await Submission.findOne(query);
  if (!item) {
    throw new Error('Submission not found');
  }

  // Validate files exist
  if (!item.filePath || !item.fileMimeType) {
    throw new Error('Resume file not found in submission');
  }
  if (!((item.jobPostFilePath && item.jobPostMimeType) || item.jobPostUrl)) {
    throw new Error('Job posting not found in submission (file or URL required)');
  }

  // Get or parse both datasets
  const [resumeResult, jobPostingResult] = await Promise.all([
    getOrParseResumeData(item, filtersArray, message),
    getOrParseJobPostingData(item)
  ]);

  return {
    resumeData: resumeResult.resumeData,
    jobPostingData: jobPostingResult.jobPostingData,
    resumeText: resumeResult.resumeText,
    jobPostingText: jobPostingResult.jobPostingText
  };
}

module.exports = {
  getOrParseResumeData,
  getOrParseJobPostingData,
  getOrParseBothData
};
