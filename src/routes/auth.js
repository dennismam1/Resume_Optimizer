const express = require('express');
const { User } = require('../models/User');
const { Session } = require('../models/Session');
const config = require('../config');
const { generateSalt, hashPassword, verifyPassword, generateSessionToken } = require('../utils/auth');

const router = express.Router();

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const email = String(username).trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'email must be a valid email address' });
    }

    // Optional: block registrations entirely unless explicitly allowed
    if (!config.ALLOW_REGISTRATION) {
      return res.status(403).json({ error: 'Registration disabled' });
    }

    // Enforce allowlist for registration as an extra safety
    if (!config.ALLOWED_EMAILS.has(email)) {
      return res.status(403).json({ error: 'Registration restricted' });
    }

    const existing = await User.findOne({ username: email }).lean();
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);

    const user =  await User.create({ username: email, passwordHash, passwordSalt: salt });

    return res.status(201).json({ ok: true, user: { id: String(user._id), username: user.username } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const email = String(username).trim().toLowerCase();

    const user = await User.findOne({ username: email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Enforce allowlist at login
    if (!config.ALLOWED_EMAILS.has(email)) {
      return res.status(403).json({ error: 'Access restricted' });
    }

    const ok = verifyPassword(String(password), user.passwordSalt, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateSessionToken();
    await Session.create({ userId: user._id, token, userAgent: req.headers['user-agent'], ipAddress: req.ip });

    return res.json({ ok: true, token, user: { id: String(user._id), username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/auth/logout', async (req, res) => {
  try {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : (req.body?.token || null);

    if (token) {
      await Session.deleteOne({ token });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;


