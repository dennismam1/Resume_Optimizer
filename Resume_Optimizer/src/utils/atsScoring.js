/**
 * Calculate semantic similarity between resume and job posting data and produce a score breakdown.
 * This uses lightweight heuristics that are deterministic and fast.
 * @param {Object} resumeData - Structured resume data
 * @param {Object} jobPostingData - Structured job posting data
 * @returns {Object} - ATS scoring results with score_breakdown for UI
 */
function calculateSemanticSimilarity(resumeData, jobPostingData) {
  // Helpers
  const toLowerSet = (arr) => new Set((Array.isArray(arr) ? arr : []).map((s) => String(s).toLowerCase()));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const parseYears = (value) => {
    if (value == null) return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? parseFloat(match[1]) : null;
  };
  const educationRank = (text) => {
    if (!text) return 0;
    const t = String(text).toLowerCase();
    if (/(phd|doctorate)/.test(t)) return 3;
    if (/(master|ms|msc|ma|mba)/.test(t)) return 2;
    if (/(bachelor|bs|ba|bsc)/.test(t)) return 1;
    return 0;
  };
  const expTargetYears = (levelText) => {
    if (!levelText) return null;
    const t = String(levelText).toLowerCase();
    if (/entry|junior|intern/.test(t)) return 1.5;
    if (/(mid|intermediate)/.test(t)) return 3.5;
    if (/(senior|sr\.?)/.test(t)) return 6;
    if (/(lead|principal|staff)/.test(t)) return 8;
    const num = String(levelText).match(/([0-9]+)\+?\s*years?/i);
    return num ? parseFloat(num[1]) : null;
  };

  // Extract skills/keywords
  const resumeSkills = toLowerSet(resumeData.skills);
  const jobRequiredSkills = toLowerSet(jobPostingData.required_skills);
  const jobPreferredSkills = toLowerSet(jobPostingData.preferred_skills);
  const jobTechnologies = toLowerSet(jobPostingData.technologies);
  const jobSoftSkills = toLowerSet(jobPostingData.soft_skills);

  // Union of all job keywords
  const jobAllKeywords = new Set([
    ...jobRequiredSkills,
    ...jobPreferredSkills,
    ...jobTechnologies,
    ...jobSoftSkills
  ]);

  // Matches
  const requiredMatches = [...jobRequiredSkills].filter((s) => resumeSkills.has(s));
  const preferredMatches = [...jobPreferredSkills].filter((s) => resumeSkills.has(s));
  const keywordMatches = [...jobAllKeywords].filter((s) => resumeSkills.has(s));

  // Scores
  const requiredScore = jobRequiredSkills.size > 0 ? (requiredMatches.length / jobRequiredSkills.size) * 100 : 0;
  const preferredScore = jobPreferredSkills.size > 0 ? (preferredMatches.length / jobPreferredSkills.size) * 100 : 0;
  const keywordsScore = jobAllKeywords.size > 0 ? (keywordMatches.length / jobAllKeywords.size) * 100 : 0;
  const skillsAlignment = (requiredScore * 0.7) + (preferredScore * 0.3);

  // Experience relevance
  const resumeYears = parseYears(resumeData.years_of_experience);
  const targetYears = expTargetYears(jobPostingData.experience_level);
  let experienceScore = 70; // default reasonable base
  if (resumeYears != null && targetYears != null) {
    const diff = Math.abs(resumeYears - targetYears);
    // Penalize 10 points per year difference up to 50
    experienceScore = clamp(100 - diff * 10, 40, 100);
  }

  // Format & structure
  const formatChecks = [
    !!resumeData.full_name,
    !!resumeData.email,
    !!resumeData.current_title,
    Array.isArray(resumeData.skills) && resumeData.skills.length >= 5,
    !!resumeData.education,
    resumeYears != null
  ];
  const formatScore = (formatChecks.filter(Boolean).length / formatChecks.length) * 100;

  // Education match
  const requiredEduRank = educationRank(jobPostingData.education);
  const resumeEduRank = educationRank(resumeData.education);
  let educationScore = 70; // default if unknown
  if (requiredEduRank > 0 && resumeEduRank > 0) {
    if (resumeEduRank >= requiredEduRank) educationScore = 100;
    else if (requiredEduRank - resumeEduRank === 1) educationScore = 60;
    else educationScore = 40;
  }

  // Overall score (weighted)
  const overallScore = (
    keywordsScore * 0.25 +
    skillsAlignment * 0.35 +
    experienceScore * 0.2 +
    formatScore * 0.1 +
    educationScore * 0.1
  );

  return {
    ats_score: Math.round(overallScore),
    // Keep legacy fields for other UI sections (matched/missing skills)
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
    // New breakdown used by the updated UI
    score_breakdown: {
      keywords_match: {
        percentage: Math.round(keywordsScore),
        matched_count: keywordMatches.length,
        total_keywords: jobAllKeywords.size
      },
      skills_alignment: {
        percentage: Math.round(skillsAlignment)
      },
      experience_relevance: {
        percentage: Math.round(experienceScore),
        resume_years: resumeYears,
        target_years: targetYears
      },
      format_structure: {
        percentage: Math.round(formatScore)
      },
      education_match: {
        percentage: Math.round(educationScore)
      }
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
