// public/js/api.js
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) {
    const err = new Error(data.error || 'เกิดข้อผิดพลาด');
    err.status = res.status;
    throw err;
  }
  return data;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name) {
  const clean = (name || '').trim();
  return clean ? clean.slice(0, 1).toUpperCase() : '?';
}

function compatRingSvg(percent, size) {
  size = size || 52;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#E7E0CC" stroke-width="${stroke}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#B8862B" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}" />
    </svg>
    <div class="compat-num">${percent}%</div>`;
}

// เรียกใช้ในหน้าที่ต้อง login เท่านั้น — ถ้ายังไม่ login จะเด้งกลับหน้าแรก
async function requireLogin() {
  try {
    const { user } = await api('GET', '/api/me');
    if (!user) {
      window.location.href = '/index.html';
      return null;
    }
    const navUser = document.querySelector('[data-nav-user]');
    if (navUser) navUser.textContent = user.displayName;
    return user;
  } catch (e) {
    window.location.href = '/index.html';
    return null;
  }
}

async function doLogout() {
  await api('POST', '/api/logout');
  window.location.href = '/index.html';
}
