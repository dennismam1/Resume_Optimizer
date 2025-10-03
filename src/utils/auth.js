const crypto = require('crypto');

const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

function generateSalt(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashPassword(password, salt) {
  const derivedKey = crypto.pbkdf2Sync(
    String(password),
    String(salt),
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );
  return derivedKey.toString('hex');
}

function verifyPassword(password, salt, passwordHash) {
  const calc = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(String(passwordHash), 'hex'));
}

function generateSessionToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  generateSalt,
  hashPassword,
  verifyPassword,
  generateSessionToken,
};


