const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Rely on field-level unique+index; avoid duplicate index declarations

const Session = mongoose.model('Session', SessionSchema);

module.exports = { Session };


