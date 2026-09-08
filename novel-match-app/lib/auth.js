// lib/auth.js
const crypto = require('crypto');
const store = require('./store');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createSession(userId) {
  const db = store.load();
  const token = crypto.randomUUID();
  db.sessions[token] = { userId, createdAt: Date.now() };
  store.save();
  return token;
}

function destroySession(token) {
  const db = store.load();
  delete db.sessions[token];
  store.save();
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function getCurrentUser(req) {
  const db = store.load();
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (!token) return null;
  const session = db.sessions[token];
  if (!session) return null;
  const user = db.users[session.userId];
  return user || null;
}

function publicUser(user) {
  if (!user) return null;
  const { id, username, displayName, bio, genres, sample, createdAt } = user;
  return { id, username, displayName, bio, genres, sample, createdAt };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  parseCookies,
  getCurrentUser,
  publicUser,
};
