# Resume Optimizer - Modular Structure

This document outlines the refactored modular structure of the Resume Optimizer application.

## Directory Structure

```
src/
├── server.js                    # Main entry point - clean and minimal
├── config/
│   └── index.js                 # Configuration and environment variables
├── middleware/
│   └── index.js                 # Express middleware setup and multer configuration
├── routes/
│   ├── analysis.js              # Resume analysis and ATS scoring routes
│   ├── coverLetter.js           # Cover letter generation and export routes
│   └── submissions.js           # File submission management routes
├── services/
│   └── nebiusService.js         # Nebius API integration and JSON parsing
├── utils/
│   ├── textExtraction.js        # File text extraction (PDF, DOC, images)
│   ├── promptBuilders.js        # AI prompt construction utilities
│   ├── documentGeneration.js    # Word and PDF document generation
│   └── atsScoring.js            # ATS scoring algorithm
└── models/
    └── Submission.js            # MongoDB submission model
```

## Module Responsibilities

### Core Application (`server.js`)
- Express app initialization
- Route mounting
- Database connection
- Server startup

### Configuration (`config/index.js`)
- Environment variables
- API keys and endpoints
- File upload settings
- Default constants

### Middleware (`middleware/index.js`)
- Express middleware setup
- CORS, logging, body parsing
- File upload configuration (multer)
- Static file serving

### Routes
- **`analysis.js`** - Resume analysis, ATS scoring, health checks
- **`coverLetter.js`** - Cover letter generation and export (Word/PDF)
- **`submissions.js`** - File upload and submission management

### Services
- **`nebiusService.js`** - Nebius AI API integration and response parsing

### Utilities
- **`textExtraction.js`** - Extract text from various file formats
- **`promptBuilders.js`** - Build AI prompts for different use cases
- **`documentGeneration.js`** - Generate Word and PDF documents
- **`atsScoring.js`** - Calculate ATS compatibility scores

## Benefits of This Structure

1. **Separation of Concerns** - Each module has a single responsibility
2. **Maintainability** - Easier to locate and modify specific functionality
3. **Testability** - Individual modules can be unit tested in isolation
4. **Reusability** - Utilities can be shared across different routes
5. **Scalability** - Easy to add new features without cluttering existing code
6. **Readability** - Much smaller, focused files that are easier to understand

## Migration Notes

- All functionality has been preserved
- API endpoints remain unchanged
- Configuration is centralized
- Dependencies are properly managed between modules
- Error handling is maintained throughout
