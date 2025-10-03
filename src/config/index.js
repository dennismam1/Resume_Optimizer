require('dotenv').config();
const path = require('path');

const config = {
  // Server configuration
  PORT: process.env.PORT,
  
  // Database configuration
  // Defaults to MongoDB Atlas if MONGODB_URI is not provided via environment
  MONGODB_URI: process.env.MONGODB_URI,
  
  // Nebius API configuration
  NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
  NEBIUS_MODEL_ID: process.env.NEBIUS_MODEL_ID,
  NEBIUS_API_URL: process.env.NEBIUS_API_URL,
  
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
  ],

  // Access control
  ALLOWED_EMAILS: new Set(
    String(process.env.ALLOWED_EMAILS || 'mamachandennis@gmail.com')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  ),
  ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION === 'true'
};

module.exports = config;
