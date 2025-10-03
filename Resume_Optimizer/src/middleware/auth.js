const { Session } = require('../models/Session');
const { User } = require('../models/User');
const config = require('../config');

async function authRequired(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : (req.cookies?.token || req.query?.token || null);

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await Session.findOne({ token }).lean();
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = await User.findById(session.userId).lean();
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Enforce allowlist: only approved emails can access protected APIs
    const email = String(user.username || '').toLowerCase();
    if (!config.ALLOWED_EMAILS.has(email)) {
      return res.status(403).json({ error: 'Access restricted' });
    }

    req.user = { id: String(user._id), username: user.username };
    req.session = { token };

    // best-effort session touch
    Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { authRequired };


