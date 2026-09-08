// server.js
// เซิร์ฟเวอร์ทั้งหมดใช้เฉพาะโมดูลมาตรฐานของ Node.js ไม่ต้อง npm install ใด ๆ
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const store = require('./lib/store');
const auth = require('./lib/auth');
const { analyzeSample, compatibility } = require('./lib/match');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const GENRES = [
  'โรแมนซ์', 'แฟนตาซี', 'สยองขวัญ', 'ดราม่า',
  'ตลก', 'ไซไฟ', 'ลึกลับ-สืบสวน', 'วัยรุ่น', 'กำลังภายใน',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------- helpers ----------

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function requireAuth(req, res) {
  const user = auth.getCurrentUser(req);
  if (!user) {
    sendError(res, 401, 'กรุณาเข้าสู่ระบบก่อน');
    return null;
  }
  return user;
}

function otherAuthor(story, userId) {
  return story.authors.find((id) => id !== userId);
}

function publicStorySummary(story) {
  const db = store.load();
  const authorsInfo = story.authors.map((id) => {
    const u = db.users[id];
    return u ? { id: u.id, displayName: u.displayName } : { id, displayName: 'ไม่ทราบชื่อ' };
  });
  return {
    id: story.id,
    title: story.title,
    genre: story.genre,
    status: story.status,
    authors: authorsInfo,
    chapterCount: story.chapters.length,
    createdAt: story.createdAt,
    excerpt: story.chapters[0] ? story.chapters[0].text.slice(0, 140) : '',
  };
}

// ---------- static file serving ----------

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, 'forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // ให้เส้นทางแบบไม่มีนามสกุล fallback ไปที่ index.html (เผื่อรีเฟรชหน้า SPA)
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          sendError(res, 404, 'ไม่พบหน้านี้');
        } else {
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(data2);
        }
      });
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- API handlers ----------

async function handleRegister(req, res) {
  const body = await readBody(req);
  const username = (body.username || '').trim().toLowerCase();
  const displayName = (body.displayName || '').trim() || username;
  const password = body.password || '';

  if (!username || username.length < 3) return sendError(res, 400, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
  if (!password || password.length < 4) return sendError(res, 400, 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');

  const db = store.load();
  const exists = Object.values(db.users).some((u) => u.username === username);
  if (exists) return sendError(res, 400, 'ชื่อผู้ใช้นี้ถูกใช้แล้ว');

  const { salt, hash } = auth.hashPassword(password);
  const id = crypto.randomUUID();
  const user = {
    id,
    username,
    displayName,
    passwordHash: hash,
    salt,
    bio: '',
    genres: [],
    sample: '',
    createdAt: Date.now(),
  };
  db.users[id] = user;
  store.save();

  const token = auth.createSession(id);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; SameSite=Lax`);
  sendJson(res, 200, { user: auth.publicUser(user) });
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';

  const db = store.load();
  const user = Object.values(db.users).find((u) => u.username === username);
  if (!user || !auth.verifyPassword(password, user.salt, user.passwordHash)) {
    return sendError(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  const token = auth.createSession(user.id);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; SameSite=Lax`);
  sendJson(res, 200, { user: auth.publicUser(user) });
}

async function handleLogout(req, res) {
  const cookies = auth.parseCookies(req);
  if (cookies.session) auth.destroySession(cookies.session);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  sendJson(res, 200, { ok: true });
}

function handleMe(req, res) {
  const user = auth.getCurrentUser(req);
  sendJson(res, 200, { user: auth.publicUser(user), genres: GENRES });
}

async function handleUpdateProfile(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  const db = store.load();
  const target = db.users[user.id];

  if (typeof body.displayName === 'string' && body.displayName.trim()) {
    target.displayName = body.displayName.trim().slice(0, 40);
  }
  if (typeof body.bio === 'string') target.bio = body.bio.slice(0, 300);
  if (Array.isArray(body.genres)) {
    target.genres = body.genres.filter((g) => GENRES.includes(g)).slice(0, 6);
  }
  if (typeof body.sample === 'string') target.sample = body.sample.slice(0, 3000);

  store.save();
  sendJson(res, 200, { user: auth.publicUser(target) });
}

function handleDiscover(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = store.load();

  const alreadySwiped = new Set(
    Object.values(db.swipes)
      .filter((s) => s.fromUserId === user.id)
      .map((s) => s.toUserId)
  );

  const candidates = Object.values(db.users)
    .filter((u) => u.id !== user.id && !alreadySwiped.has(u.id))
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      bio: u.bio,
      genres: u.genres,
      sample: u.sample,
      compatibility: compatibility(user, u),
    }))
    .sort((a, b) => b.compatibility - a.compatibility);

  sendJson(res, 200, { candidates });
}

async function handleSwipe(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  const targetUserId = body.targetUserId;
  const action = body.action === 'like' ? 'like' : 'pass';

  const db = store.load();
  if (!db.users[targetUserId]) return sendError(res, 404, 'ไม่พบผู้ใช้นี้');
  if (targetUserId === user.id) return sendError(res, 400, 'ทำรายการไม่ได้');

  const swipeId = crypto.randomUUID();
  db.swipes[swipeId] = {
    id: swipeId,
    fromUserId: user.id,
    toUserId: targetUserId,
    action,
    createdAt: Date.now(),
  };

  let match = null;
  if (action === 'like') {
    const reciprocal = Object.values(db.swipes).find(
      (s) => s.fromUserId === targetUserId && s.toUserId === user.id && s.action === 'like'
    );
    if (reciprocal) {
      const already = Object.values(db.matches).find(
        (m) => (m.userA === user.id && m.userB === targetUserId) ||
               (m.userA === targetUserId && m.userB === user.id)
      );
      if (!already) {
        const matchId = crypto.randomUUID();
        match = {
          id: matchId,
          userA: user.id,
          userB: targetUserId,
          compatibility: compatibility(user, db.users[targetUserId]),
          createdAt: Date.now(),
          storyId: null,
        };
        db.matches[matchId] = match;
      } else {
        match = already;
      }
    }
  }

  store.save();
  sendJson(res, 200, { matched: !!match, match });
}

function handleMatches(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = store.load();

  const list = Object.values(db.matches)
    .filter((m) => m.userA === user.id || m.userB === user.id)
    .map((m) => {
      const partnerId = m.userA === user.id ? m.userB : m.userA;
      const partner = db.users[partnerId];
      return {
        id: m.id,
        compatibility: m.compatibility,
        createdAt: m.createdAt,
        storyId: m.storyId,
        partner: partner ? { id: partner.id, displayName: partner.displayName, genres: partner.genres } : null,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  sendJson(res, 200, { matches: list });
}

async function handleCreateStory(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  const db = store.load();
  const match = db.matches[body.matchId];

  if (!match) return sendError(res, 404, 'ไม่พบการจับคู่นี้');
  if (match.userA !== user.id && match.userB !== user.id) return sendError(res, 403, 'ไม่มีสิทธิ์');
  if (match.storyId) return sendError(res, 400, 'คู่นี้มีนิยายอยู่แล้ว');

  const title = (body.title || 'เรื่องไม่มีชื่อ').trim().slice(0, 80);
  const genre = GENRES.includes(body.genre) ? body.genre : GENRES[0];

  const storyId = crypto.randomUUID();
  const story = {
    id: storyId,
    matchId: match.id,
    title,
    genre,
    authors: [match.userA, match.userB],
    turnUserId: user.id,
    chapters: [],
    status: 'ongoing',
    isPublic: body.isPublic !== false,
    createdAt: Date.now(),
  };
  db.stories[storyId] = story;
  match.storyId = storyId;

  store.save();
  sendJson(res, 200, { story });
}

function handleFeed(req, res) {
  const user = auth.getCurrentUser(req);
  if (!user) return sendError(res, 401, 'กรุณาเข้าสู่ระบบก่อน');

  const db = store.load();
  const list = Object.values(db.stories)
    .filter((s) => s.isPublic && s.chapters.length > 0)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicStorySummary);

  sendJson(res, 200, { stories: list });
}

function handleGetStory(req, res, storyId) {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = store.load();
  const story = db.stories[storyId];
  if (!story) return sendError(res, 404, 'ไม่พบนิยายเรื่องนี้');

  const isAuthor = story.authors.includes(user.id);
  if (!story.isPublic && !isAuthor) return sendError(res, 403, 'นิยายเรื่องนี้เป็นส่วนตัว');

  const chapters = story.chapters.map((c) => ({
    id: c.id,
    text: c.text,
    createdAt: c.createdAt,
    author: db.users[c.authorId]
      ? { id: c.authorId, displayName: db.users[c.authorId].displayName }
      : { id: c.authorId, displayName: 'ไม่ทราบชื่อ' },
  }));

  sendJson(res, 200, {
    story: {
      id: story.id,
      title: story.title,
      genre: story.genre,
      status: story.status,
      isPublic: story.isPublic,
      authors: story.authors.map((id) => db.users[id]
        ? { id, displayName: db.users[id].displayName }
        : { id, displayName: 'ไม่ทราบชื่อ' }),
      turnUserId: story.turnUserId,
      isMyTurn: isAuthor && story.status === 'ongoing' && story.turnUserId === user.id,
      isAuthor,
      chapters,
    },
  });
}

async function handleAddChapter(req, res, storyId) {
  const user = requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  const db = store.load();
  const story = db.stories[storyId];

  if (!story) return sendError(res, 404, 'ไม่พบนิยายเรื่องนี้');
  if (!story.authors.includes(user.id)) return sendError(res, 403, 'คุณไม่ใช่ผู้แต่งเรื่องนี้');
  if (story.status !== 'ongoing') return sendError(res, 400, 'เรื่องนี้จบแล้ว');
  if (story.turnUserId !== user.id) return sendError(res, 400, 'ยังไม่ถึงตาคุณเขียน');

  const text = (body.text || '').trim();
  if (!text) return sendError(res, 400, 'กรุณาเขียนเนื้อหาก่อนส่ง');
  if (text.length > 4000) return sendError(res, 400, 'ตอนนี้ยาวเกินไป (สูงสุด 4000 ตัวอักษร)');

  const chapterId = crypto.randomUUID();
  story.chapters.push({ id: chapterId, authorId: user.id, text, createdAt: Date.now() });
  story.turnUserId = otherAuthor(story, user.id);

  if (body.finish === true) {
    story.status = 'completed';
  }

  store.save();
  handleGetStory(req, res, storyId);
}

// ---------- router ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    if (pathname === '/api/register' && method === 'POST') return await handleRegister(req, res);
    if (pathname === '/api/login' && method === 'POST') return await handleLogin(req, res);
    if (pathname === '/api/logout' && method === 'POST') return await handleLogout(req, res);
    if (pathname === '/api/me' && method === 'GET') return handleMe(req, res);
    if (pathname === '/api/profile' && method === 'POST') return await handleUpdateProfile(req, res);
    if (pathname === '/api/discover' && method === 'GET') return handleDiscover(req, res);
    if (pathname === '/api/swipe' && method === 'POST') return await handleSwipe(req, res);
    if (pathname === '/api/matches' && method === 'GET') return handleMatches(req, res);
    if (pathname === '/api/stories' && method === 'POST') return await handleCreateStory(req, res);
    if (pathname === '/api/feed' && method === 'GET') return handleFeed(req, res);

    const storyMatch = pathname.match(/^\/api\/stories\/([a-f0-9-]+)$/);
    if (storyMatch && method === 'GET') return handleGetStory(req, res, storyMatch[1]);

    const chapterMatch = pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/chapters$/);
    if (chapterMatch && method === 'POST') return await handleAddChapter(req, res, chapterMatch[1]);

    if (pathname.startsWith('/api/')) return sendError(res, 404, 'ไม่พบ API นี้');

    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์');
  }
});

server.listen(PORT, () => {
  console.log(`Novel Match กำลังทำงานที่ http://localhost:${PORT}`);
});
