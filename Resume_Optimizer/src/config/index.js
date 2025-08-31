require('dotenv').config();
const path = require('path');

const config = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  
  // Database configuration
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/resume_optimizer',
  
  // Nebius API configuration
  NEBIUS_API_KEY: process.env.NEBIUS_API_KEY || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IlV6SXJWd1h0dnprLVRvdzlLZWstc0M1akptWXBvX1VaVkxUZlpnMDRlOFUiLCJ0eXAiOiJKV1QifQ.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDExNDQzMDU5NjYxOTQ1OTY5MTE1MyIsInNjb3BlIjoib3BlbmlkIG9mZmxpbmVfYWNjZXNzIiwiaXNzIjoiYXBpX2tleV9pc3N1ZXIiLCJhdWQiOlsiaHR0cHM6Ly9uZWJpdXMtaW5mZXJlbmNlLmV1LmF1dGgwLmNvbS9hcGkvdjIvIl0sImV4cCI6MTkxMzcyMjgwOSwidXVpZCI6IjdkNWFmOTZmLTBiODQtNDA5NS1iZWU4LThhMGNiN2Q5M2M4YiIsIm5hbWUiOiJEZW5uaXMiLCJleHBpcmVzX2F0IjoiMjAzMC0wOC0yM1QxMzo0MDowOSswMDAwIn0.pC5PTOOdZYMhEDV5KeCqGurz2X2bcbIg1p23S-zkQXo',
  NEBIUS_MODEL_ID: process.env.NEBIUS_MODEL_ID || 'meta-llama/Llama-3.3-70B-Instruct',
  NEBIUS_API_URL: 'https://api.studio.nebius.com/v1/chat/completions',
  
  // File upload configuration
  UPLOAD_DIR: process.env.UPLOAD_DIR 
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', '..', 'uploads'),
  
  // File type configuration
  ALLOWED_MIME_TYPES: new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  
  // File size limits
  MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB
  
  // Default fields for resume extraction
  DEFAULT_RESUME_FIELDS: [
    'full_name',
    'email',
    'phone',
    'years_of_experience',
    'current_title',
    'skills',
    'education',
    'certifications',
    'notable_projects'
  ]
};

module.exports = config;
