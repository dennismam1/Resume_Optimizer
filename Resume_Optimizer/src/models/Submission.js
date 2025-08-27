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


