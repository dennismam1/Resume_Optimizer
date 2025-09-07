const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Rely on field-level unique+index; avoid duplicate index declarations

const User = mongoose.model('User', UserSchema);

module.exports = { User };


