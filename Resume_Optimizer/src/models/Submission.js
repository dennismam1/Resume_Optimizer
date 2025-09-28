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
    // Owner
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

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

    // Manual application tracking fields
    applicationStatus: {
      type: String,
      enum: ['Pending', 'Under Review', 'Interview Scheduled', 'Rejected', 'Offer Received'],
      default: 'Pending'
    },
    interviewDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },

    // ATS scoring history (each calculation appended here)
    atsHistory: [
      new mongoose.Schema(
        {
          score: { type: Number, min: 0, max: 100 },
          result: { type: mongoose.Schema.Types.Mixed },
          createdAt: { type: Date, default: Date.now },
        },
        { _id: false }
      )
    ],
  },
  { timestamps: true }
);

SubmissionSchema.index({ createdAt: -1 });
SubmissionSchema.index({ userId: 1, createdAt: -1 });

const Submission = mongoose.model('Submission', SubmissionSchema);

module.exports = { Submission };


