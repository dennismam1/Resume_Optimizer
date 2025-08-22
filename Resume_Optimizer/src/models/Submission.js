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
    fileOriginalName: { type: String },
    fileStoredName: { type: String },
    fileMimeType: { type: String },
    filePath: { type: String },
    fileSize: { type: Number, min: 0 },

    linkUrl: {
      type: String,
      trim: true,
    },

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


