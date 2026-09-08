// lib/store.js
// เก็บข้อมูลทั้งหมดในไฟล์ JSON เดียว (ไม่ต้องพึ่งฐานข้อมูลภายนอก)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY_DB = {
  users: {},      // id -> user
  sessions: {},   // token -> { userId, createdAt }
  swipes: {},     // id -> { fromUserId, toUserId, action, createdAt }
  matches: {},    // id -> { id, userA, userB, compatibility, createdAt, storyId }
  stories: {},    // id -> story
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
  }
}

let cache = null;

function load() {
  ensureDb();
  if (!cache) {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    try {
      cache = JSON.parse(raw);
    } catch (e) {
      cache = JSON.parse(JSON.stringify(EMPTY_DB));
    }
    for (const key of Object.keys(EMPTY_DB)) {
      if (!cache[key]) cache[key] = {};
    }
  }
  return cache;
}

let saveTimer = null;
function save() {
  // debounce เขียนไฟล์เล็กน้อยเวลามีการเรียกหลายครั้งติดกัน
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), 'utf8');
  }, 50);
}

function saveNow() {
  fs.writeFileSync(DB_FILE, JSON.stringify(load(), null, 2), 'utf8');
}

module.exports = { load, save, saveNow };
