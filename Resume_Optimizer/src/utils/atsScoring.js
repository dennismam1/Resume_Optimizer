/**
 * Calculate semantic similarity between resume and job posting data
 * @param {Object} resumeData - Structured resume data
 * @param {Object} jobPostingData - Structured job posting data
 * @returns {Object} - ATS scoring results
 */
function calculateSemanticSimilarity(resumeData, jobPostingData) {
  // Simple keyword matching algorithm - can be enhanced with more sophisticated NLP
  const resumeSkills = new Set();
  const jobRequiredSkills = new Set();
  const jobPreferredSkills = new Set();

  // Extract skills from resume
  if (resumeData.skills && Array.isArray(resumeData.skills)) {
    resumeData.skills.forEach(skill => resumeSkills.add(skill.toLowerCase()));
  }

  // Extract skills from job posting
  if (jobPostingData.required_skills && Array.isArray(jobPostingData.required_skills)) {
    jobPostingData.required_skills.forEach(skill => jobRequiredSkills.add(skill.toLowerCase()));
  }
  if (jobPostingData.preferred_skills && Array.isArray(jobPostingData.preferred_skills)) {
    jobPostingData.preferred_skills.forEach(skill => jobPreferredSkills.add(skill.toLowerCase()));
  }
  if (jobPostingData.technologies && Array.isArray(jobPostingData.technologies)) {
    jobPostingData.technologies.forEach(tech => jobRequiredSkills.add(tech.toLowerCase()));
  }

  // Calculate matches
  const requiredMatches = [...jobRequiredSkills].filter(skill => resumeSkills.has(skill));
  const preferredMatches = [...jobPreferredSkills].filter(skill => resumeSkills.has(skill));

  // Calculate scores
  const requiredScore = jobRequiredSkills.size > 0 ? (requiredMatches.length / jobRequiredSkills.size) * 100 : 0;
  const preferredScore = jobPreferredSkills.size > 0 ? (preferredMatches.length / jobPreferredSkills.size) * 100 : 0;
  const overallScore = (requiredScore * 0.7) + (preferredScore * 0.3); // Weight required skills more

  return {
    ats_score: Math.round(overallScore),
    required_skills_match: {
      matched: requiredMatches,
      total_required: jobRequiredSkills.size,
      match_percentage: Math.round(requiredScore)
    },
    preferred_skills_match: {
      matched: preferredMatches,
      total_preferred: jobPreferredSkills.size,
      match_percentage: Math.round(preferredScore)
    },
    missing_skills: {
      required: [...jobRequiredSkills].filter(skill => !resumeSkills.has(skill)),
      preferred: [...jobPreferredSkills].filter(skill => !resumeSkills.has(skill))
    },
    resume_skills: [...resumeSkills],
    job_requirements: {
      required_skills: [...jobRequiredSkills],
      preferred_skills: [...jobPreferredSkills]
    }
  };
}

module.exports = {
  calculateSemanticSimilarity
};
