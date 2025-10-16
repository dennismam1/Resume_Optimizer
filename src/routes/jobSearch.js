const express = require('express');
const { Submission } = require('../models/Submission');
const { getOrParseResumeData } = require('../utils/dataCache');
const { callOpenAI, extractJsonFromString } = require('../services/openaiService');

const router = express.Router();

// Generate job suggestions using OpenAI from parsed resume data
// GET /api/job-suggestions?submissionId=...&location=...&entryType=...
router.get('/job-suggestions', async (req, res) => {
  try {
    const userId = req.user?.id;
    const submissionId = String(req.query.submissionId || '').trim();
    const location = String(req.query.location || '').trim();
    const entryType = String(req.query.entryType || '').trim(); // e.g., Internship, Entry Level, Mid, Senior

    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }

    // Load the submission and ensure it belongs to the user
    const submission = await Submission.findOne({ _id: submissionId, userId });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Ensure resume is parsed or parse it (cached)
    const { resumeData, resumeText } = await getOrParseResumeData(submission, [
      'full_name', 'email', 'current_title', 'target_title', 'years_of_experience', 'skills', 'education', 'seniority_level', 'location'
    ], '');

    // Build a prompt for OpenAI to suggest jobs
    const safeLocation = location || (resumeData.location || 'Remote');
    const years = typeof resumeData.years_of_experience === 'number' ? `${resumeData.years_of_experience} years` : (resumeData.years_of_experience || '');
    const title = resumeData.current_title || resumeData.target_title || '';
    const topSkillsArr = Array.isArray(resumeData.skills) ? resumeData.skills.slice(0, 12) : [];
    const skills = topSkillsArr.join(', ');
    const education = resumeData.education || '';
    const seniority = entryType || resumeData.seniority_level || '';

    const prompt = `You are a recruiting assistant. Suggest realistic job roles for the candidate based on parsed resume fields below. Do not invent unknown data.

Candidate summary (from parsed resume):
- Current/target title: ${title}
- Years of experience: ${years}
- Skills: ${skills}
- Education: ${education}
- Preferred/Detected location: ${safeLocation}
- Desired seniority/entry type: ${seniority}

Instructions:
- Output ONLY valid JSON with this exact schema:
  {
    "query": string, // concise search query to use on common job boards
    "location": string,
    "entry_type": string, // Internship | Entry Level | Mid | Senior | Lead | Manager
    "suggestions": [
      {
        "title": string,
        "example_companies": string[],
        "why_fit": string,  // <= 160 characters
        "keywords": string[], // max 6 items
        "links": [ // 2-3 fully-qualified HTTPS links to real job board search results for this title/location
          { "label": string, "url": string }
        ]
      }
    ]
  }
- Return at most 5 high quality suggestions.
- Tailor roles to the candidate’s background, not generic.
- Use location "Remote" if none provided.
- Keep text concise.
- Links guidance: Provide search result URLs on major boards only (e.g., LinkedIn Jobs, Indeed, Glassdoor) using the suggested title and location. Do NOT fabricate direct posting URLs. Always include https:// and encode spaces.
`;

    const raw = await callOpenAI(prompt, {
      maxTokens: 2000,
      temperature: 0.2,
      top_p: 0.9,
      system: 'You are a job recommendation engine. Always return compact, valid JSON matching the requested schema only.'
    });
    const json = extractJsonFromString(raw) || {};

    // Basic shape validation and defaults
    if (!Array.isArray(json.suggestions)) {
      json.suggestions = [];
    }
    if (!json.location) json.location = safeLocation;
    if (!json.entry_type) json.entry_type = seniority || 'Entry Level';
    if (!json.query) {
      const base = title || (resumeData?.skills?.[0] || 'Software Engineer');
      json.query = `${base} ${json.entry_type}`.trim();
    }

    // Ensure suggestions have working search links; add fallback links when missing
    const encode = (s) => encodeURIComponent(String(s || '').trim());
    const buildSearchLinks = (roleTitle, loc, ent) => {
      const q = encode(roleTitle || json.query || title || 'Software Engineer');
      const l = encode(loc || json.location || safeLocation || 'Remote');
      const e = encode(ent || json.entry_type || seniority || '');
      const links = [
        { label: 'LinkedIn Jobs', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}` },
        { label: 'Indeed', url: `https://www.indeed.com/jobs?q=${q}${l ? `&l=${l}` : ''}${e ? `&sc=0kf%3Aexplvl(${e})%3B` : ''}` },
        { label: 'Glassdoor', url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}&locT=C&locId=&locKeyword=${l}` }
      ];
      return links;
    };

    json.suggestions = (json.suggestions || []).map(s => {
      const suggestion = s || {};
      if (!Array.isArray(suggestion.links) || suggestion.links.length === 0) {
        suggestion.links = buildSearchLinks(suggestion.title, json.location, json.entry_type);
      }
      // Sanitize to label/url only
      suggestion.links = suggestion.links
        .filter(l => l && typeof l.url === 'string' && l.url.startsWith('http'))
        .slice(0, 3)
        .map(l => ({ label: l.label || 'Job Search', url: l.url }));
      // Limit why_fit and keywords for compact UI
      if (typeof suggestion.why_fit === 'string' && suggestion.why_fit.length > 160) {
        suggestion.why_fit = suggestion.why_fit.slice(0, 157) + '...';
      }
      if (Array.isArray(suggestion.keywords)) {
        suggestion.keywords = suggestion.keywords.slice(0, 6);
      }
      return suggestion;
    });

    // Fallback: synthesize minimal suggestions when model output is empty/truncated
    if (!json.suggestions.length) {
      const baseTitles = [];
      if (title) baseTitles.push(title);
      if (seniority && title) baseTitles.push(`${seniority} ${title}`);
      const skillRoles = (topSkillsArr || []).slice(0, 3).flatMap(sk => [
        `${sk} Developer`,
        `${sk} Engineer`
      ]);
      const uniqueTitles = Array.from(new Set([...baseTitles, ...skillRoles])).filter(Boolean).slice(0, 5);
      json.suggestions = uniqueTitles.map(t => ({
        title: t,
        example_companies: [],
        why_fit: `Aligns with your background (${[title, ...topSkillsArr.slice(0,3)].filter(Boolean).join(', ')})`,
        keywords: topSkillsArr.slice(0, 6),
        links: buildSearchLinks(t, json.location, json.entry_type)
      }));
    }

    // Disable caching
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, items: json.suggestions, meta: { query: json.query, location: json.location, entryType: json.entry_type } });
  } catch (err) {
    console.error('Job suggestions error:', err);
    res.status(500).json({ error: 'Failed to generate job suggestions', details: err.message });
  }
});

module.exports = router;


