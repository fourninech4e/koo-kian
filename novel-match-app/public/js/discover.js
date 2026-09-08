// public/js/discover.js
let candidates = [];
let currentUser = null;
const deckWrap = document.getElementById('deckWrap');
const actionButtons = document.getElementById('actionButtons');
const matchModal = document.getElementById('matchModal');
const matchText = document.getElementById('matchText');

document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
document.getElementById('closeModal').addEventListener('click', () => matchModal.classList.remove('show'));

function cardHtml(candidate) {
  const genres = (candidate.genres || [])
    .map((g) => `<span class="chip" style="cursor:default;">${escapeHtml(g)}</span>`)
    .join('');
  const excerpt = candidate.sample
    ? `<div class="excerpt">${escapeHtml(candidate.sample).slice(0, 320)}${candidate.sample.length > 320 ? '…' : ''}</div>`
    : `<div class="excerpt empty">ยังไม่มีตัวอย่างงานเขียน</div>`;

  return `
    <div class="card-top">
      <h3>${escapeHtml(candidate.displayName)}</h3>
      <div class="compat-ring">${compatRingSvg(candidate.compatibility)}</div>
    </div>
    ${candidate.bio ? `<div class="bio">${escapeHtml(candidate.bio)}</div>` : ''}
    <div class="chip-group" style="margin-bottom:14px;">${genres || '<span class="bio">ยังไม่ระบุแนวที่ชอบ</span>'}</div>
    ${excerpt}
  `;
}

function renderDeck() {
  deckWrap.innerHTML = '';
  if (candidates.length === 0) {
    actionButtons.style.display = 'none';
    deckWrap.innerHTML = `
      <div class="deck-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M20 4c-4 0-9 2-12 5-2 2-3 5-3 8 0 1 0 2 1 3 3-1 6-2 8-4 3-3 5-8 5-12 0-.3 0-.1 1 0z"/></svg>
        <div style="font-family:'Noto Serif Thai',serif;font-size:19px;">หมดคนให้ปัดแล้วตอนนี้</div>
        <div style="font-size:13.5px;">ลองแวะมาดูใหม่ทีหลัง หรือปรับโปรไฟล์ของคุณให้ครบก่อน</div>
      </div>`;
    return;
  }
  actionButtons.style.display = 'flex';

  // แสดงไพ่ 2 ใบซ้อนกัน ใบบนสุดลากได้
  const visible = candidates.slice(0, 2).reverse();
  visible.forEach((candidate, idx) => {
    const isTop = idx === visible.length - 1;
    const el = document.createElement('div');
    el.className = 'swipe-card';
    el.innerHTML = cardHtml(candidate);
    if (!isTop) {
      el.style.transform = 'scale(0.96) translateY(10px)';
      el.style.opacity = '0.7';
    } else {
      attachDrag(el, candidate);
    }
    deckWrap.appendChild(el);
  });
}

function attachDrag(el, candidate) {
  let startX = 0, startY = 0, dx = 0, dragging = false;

  function onDown(x, y) {
    dragging = true;
    startX = x; startY = y;
    el.style.transition = 'none';
  }
  function onMove(x, y) {
    if (!dragging) return;
    dx = x - startX;
    const rotate = dx / 14;
    el.style.transform = `translate(${dx}px, ${(y - startY) * 0.2}px) rotate(${rotate}deg)`;
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    el.style.transition = 'transform 0.3s ease';
    if (dx > 110) {
      flyOut(el, 1, () => swipe(candidate, 'like'));
    } else if (dx < -110) {
      flyOut(el, -1, () => swipe(candidate, 'pass'));
    } else {
      el.style.transform = '';
    }
    dx = 0;
  }

  el.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);

  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    onDown(t.clientX, t.clientY);
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    onMove(t.clientX, t.clientY);
  }, { passive: true });
  el.addEventListener('touchend', onUp);

  el._candidate = candidate;
}

function flyOut(el, direction, callback) {
  el.style.transform = `translate(${direction * 600}px, -40px) rotate(${direction * 30}deg)`;
  el.style.opacity = '0';
  setTimeout(callback, 220);
}

async function swipe(candidate, action) {
  try {
    const result = await api('POST', '/api/swipe', { targetUserId: candidate.id, action });
    candidates = candidates.filter((c) => c.id !== candidate.id);
    renderDeck();
    if (result.matched) {
      matchText.textContent = `คุณกับ ${candidate.displayName} ถูกใจกันทั้งคู่ ลองเริ่มเขียนนิยายด้วยกันดูสิ`;
      matchModal.classList.add('show');
    }
  } catch (err) {
    renderDeck();
  }
}

document.getElementById('btnPass').addEventListener('click', () => {
  const top = deckWrap.querySelector('.swipe-card:last-child');
  if (top && top._candidate) flyOut(top, -1, () => swipe(top._candidate, 'pass'));
});
document.getElementById('btnLike').addEventListener('click', () => {
  const top = deckWrap.querySelector('.swipe-card:last-child');
  if (top && top._candidate) flyOut(top, 1, () => swipe(top._candidate, 'like'));
});

(async () => {
  currentUser = await requireLogin();
  if (!currentUser) return;
  try {
    const data = await api('GET', '/api/discover');
    candidates = data.candidates;
    renderDeck();
  } catch (err) {
    deckWrap.innerHTML = `<div class="deck-empty">${escapeHtml(err.message)}</div>`;
  }
})();
