const config = require('../config');

/**
 * Build prompt for resume analysis
 * @param {string} resumeText - The resume text content
 * @param {Array} filters - Fields to extract
 * @param {string} freeformMessage - Additional instructions
 * @returns {string} - Built prompt
 */
function buildPrompt(resumeText, filters, freeformMessage) {
  const requestedFields = Array.isArray(filters) && filters.length > 0
    ? filters
    : config.DEFAULT_RESUME_FIELDS;

  const fieldsList = requestedFields.map(f => `- ${f}`).join('\n');

  const instructions = `You are an information extraction system. Given a resume and optional criteria, extract the requested fields.\n\nRequirements:\n- Output ONLY valid JSON.\n- Include all requested fields exactly as keys.\n- Use null when a field is not found.\n- For "skills", return an array of strings.\n- Keep values concise.\n\nRequested fields:\n${fieldsList}\n\nOptional guidance from user: ${freeformMessage || 'N/A'}\n\nResume:\n"""\n${resumeText}\n"""\n\nReturn JSON only.`;

  return instructions;
}

/**
 * Build prompt for job posting keyword extraction
 * @param {string} jobPostingText - The job posting text content
 * @returns {string} - Built prompt
 */
function buildJobPostingKeywordPrompt(jobPostingText) {
  return `You are a keyword extraction system for job postings. Extract key requirements, skills, technologies, and qualifications from the following job posting.

Requirements:
- Output ONLY valid JSON.
- Extract keywords in these categories: "required_skills", "preferred_skills", "technologies", "experience_level", "education", "certifications", "soft_skills"
- Use arrays for skills and technologies
- Use strings for experience_level and education
- Keep values concise and standardized

Job Posting:
"""
${jobPostingText}
"""

Return JSON only.`;
}

/**
 * Build prompt for cover letter generation
 * @param {string} resumeText - The resume text content
 * @param {string} jobPostingText - The job posting text content
 * @param {Object} resumeData - Structured resume data
 * @param {Object} jobPostingData - Structured job posting data
 * @returns {string} - Built prompt
 */
function buildCoverLetterPrompt(resumeText, jobPostingText, resumeData, jobPostingData, options = {}) {
  const selectedTone = options.tone || 'professional';
  const selectedLength = options.length || 'medium';
  const lengthGuidance = selectedLength === 'short' ? 'Keep it to ~2 concise paragraphs.' : selectedLength === 'long' ? 'Write 5 or more detailed paragraphs.' : 'Keep it concise but impactful (3-4 paragraphs).';
  const toneGuidance = `Use a ${selectedTone} tone.`;
  return `You are a professional cover letter writer. Generate a personalized, compelling cover letter based on the resume and job posting provided.

Instructions:
- Write a professional cover letter that highlights relevant experience and skills
- ${toneGuidance}
- Include specific examples from the resume that align with job requirements
- Address key requirements mentioned in the job posting
- ${lengthGuidance}
- Include a strong opening and closing
- DO NOT include placeholder text like [Your Name], [Company Name] - use actual information when available
- Format as plain text, ready to be copied

Resume Information:
Name: ${resumeData.full_name || 'Applicant'}
Email: ${resumeData.email || ''}
Current Title: ${resumeData.current_title || ''}
Years of Experience: ${resumeData.years_of_experience || ''}
Key Skills: ${resumeData.skills ? resumeData.skills.join(', ') : ''}
Education: ${resumeData.education || ''}
Notable Projects: ${resumeData.notable_projects || ''}

Job Requirements (Key Skills): ${jobPostingData.required_skills ? jobPostingData.required_skills.join(', ') : ''}
Preferred Skills: ${jobPostingData.preferred_skills ? jobPostingData.preferred_skills.join(', ') : ''}
Technologies: ${jobPostingData.technologies ? jobPostingData.technologies.join(', ') : ''}

Full Resume Text:
"""
${resumeText}
"""

Full Job Posting:
"""
${jobPostingText}
"""

Generate a professional cover letter:`;
}

module.exports = {
  buildPrompt,
  buildJobPostingKeywordPrompt,
  buildCoverLetterPrompt
};
