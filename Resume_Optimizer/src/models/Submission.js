const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema(
  {
    fileOriginalName: { type: String },
    fileStoredName: { type: String },
    fileMimeType: { type: String },
    filePath: { type: String },
    fileSize: { type: Number },
  },
  { _id: false }
);

const SubmissionSchema = new mongoose.Schema(
  {
    // Resume file
    fileOriginalName: { type: String },
    fileStoredName: { type: String },
    fileMimeType: { type: String },
    filePath: { type: String },
    fileSize: { type: Number, min: 0 },

    // Job posting file
    jobPostOriginalName: { type: String },
    jobPostStoredName: { type: String },
    jobPostMimeType: { type: String },
    jobPostFilePath: { type: String },
    jobPostFileSize: { type: Number, min: 0 },

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

    message: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
  },
  { timestamps: true }
);

SubmissionSchema.index({ createdAt: -1 });

const Submission = mongoose.model('Submission', SubmissionSchema);

module.exports = { Submission };


