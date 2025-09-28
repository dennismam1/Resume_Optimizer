# Data Caching System

This document describes the data caching system implemented to reduce LLM API calls and improve performance.

## Overview

The system caches parsed resume and job posting data in the MongoDB database, eliminating the need to re-parse files with the LLM on subsequent requests.

## Database Schema Updates

### New Fields in Submission Model

```javascript
// Parsed data cache
resumeData: {
  type: mongoose.Schema.Types.Mixed,
  default: null,
  // Stores parsed resume JSON: { full_name, email, phone, skills, etc. }
},
jobPostingData: {
  type: mongoose.Schema.Types.Mixed,
  default: null,
  // Stores parsed job posting JSON: { required_skills, preferred_skills, technologies, etc. }
},

// Metadata for parsed data
resumeDataParsedAt: { type: Date },
jobPostingDataParsedAt: { type: Date },

// Extracted raw text (optional cache)
resumeText: { type: String },
jobPostingText: { type: String },
```

## Caching Logic

### Cache Hit Flow
1. **Request comes in** with `submissionId`
2. **Check database** for existing `resumeData` and `jobPostingData`
3. **If cached data exists**: Return immediately (no LLM call)
4. **Generate response** using cached data

### Cache Miss Flow
1. **Request comes in** with `submissionId`
2. **Check database** - no cached data found
3. **Extract text** from uploaded files
4. **Parse with LLM** (Nebius API call)
5. **Cache results** in database with timestamp
6. **Return response** with parsed data

## Performance Benefits

### Before Caching
- **Every request** → LLM API call
- **High latency** (1-3 seconds per request)
- **API costs** for repeated parsing of same files
- **Rate limiting** concerns with frequent requests

### After Caching
- **First request** → LLM API call + cache
- **Subsequent requests** → Instant response from cache
- **Reduced latency** (~100ms vs 1-3 seconds)
- **Lower API costs** (90%+ reduction for repeated requests)
- **Better user experience** with fast responses

## Cache Usage Examples

### ATS Score Calculation
```javascript
// Before: Always parsed with LLM
const resumeData = await parseResumeWithLLM(text);
const jobData = await parseJobPostingWithLLM(text);

// After: Uses cache when available
const { resumeData, jobPostingData } = await getOrParseBothData(submissionId);
```

### Cover Letter Generation
```javascript
// Before: Re-parsed data every time
const resumeData = await callNebius(resumePrompt);
const jobData = await callNebius(jobPrompt);

// After: Cached data reused
const { resumeData, jobPostingData, resumeText, jobPostingText } = 
  await getOrParseBothData(submissionId);
```

## API Impact

### Affected Endpoints
- `POST /api/analyze` (with `calculateATS=true`)
- `POST /api/generate-cover-letter`
- `POST /api/export-cover-letter/word`
- `POST /api/export-cover-letter/pdf`

### Cache Invalidation
Currently, cached data is **never invalidated** automatically. Future improvements could include:
- Cache expiration (e.g., 30 days)
- Manual cache invalidation endpoint
- Re-parsing when file is re-uploaded

## Monitoring and Logging

The system logs cache hits and misses:
```
Using cached resume data for submission: 64f1234567890abcdef12345
Parsing resume data with LLM for submission: 64f1234567890abcdef12346
Cached resume data for submission: 64f1234567890abcdef12346
```

## Error Handling

If cached data retrieval fails:
1. System logs the error
2. Falls back to LLM parsing
3. Attempts to cache the new result
4. Returns success if parsing succeeds

## Future Enhancements

1. **Cache Statistics Dashboard**
   - Cache hit/miss ratios
   - API call reduction metrics
   - Cost savings tracking

2. **Smart Cache Invalidation**
   - Expire cache after X days
   - Invalidate when files are re-uploaded
   - Admin endpoint to clear cache

3. **Partial Cache Updates**
   - Cache individual fields separately
   - Allow partial re-parsing
   - Field-level cache timestamps

4. **Cache Warming**
   - Pre-parse popular file combinations
   - Background processing queue
   - Predictive caching

## Migration Notes

- **Backward Compatible**: Existing submissions without cached data work normally
- **Gradual Rollout**: Cache builds up over time as users make requests
- **No Data Loss**: Original files remain unchanged
- **Easy Rollback**: Can disable caching without affecting functionality
