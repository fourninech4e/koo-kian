// public/js/story.js
const storyPage = document.getElementById('storyPage');
const storyId = new URLSearchParams(window.location.search).get('id');
let pollTimer = null;
let currentUserId = null;

function navHtml() {
  return `
  <div class="topbar-spacer"></div>`;
}

function renderStory(story) {
  const authorAId = story.authors[0] ? story.authors[0].id : null;
  const statusLabel = story.status === 'completed' ? 'จบแล้ว' : 'กำลังเขียน';
  const authorNames = story.authors.map((a) => escapeHtml(a.displayName)).join(' & ');

  const chaptersHtml = story.chapters.map((c) => {
    const cls = c.author.id === authorAId ? 'author-a' : 'author-b';
    return `
      <div class="chapter ${cls}">
        <div class="chapter-author ${cls}">โดย ${escapeHtml(c.author.displayName)}</div>
        <p>${escapeHtml(c.text)}</p>
      </div>`;
  }).join('') || `<div class="empty-state">ยังไม่มีตอนไหนถูกเขียนเลย</div>`;

  let controlsHtml = '';
  if (story.isAuthor && story.status === 'ongoing') {
    if (story.isMyTurn) {
      controlsHtml = `
        <div class="turn-box">
          <div class="turn-label">ตาคุณเขียนต่อ</div>
          <textarea id="chapterText" placeholder="เขียนตอนต่อไปของเรื่องนี้..."></textarea>
          <div class="row">
            <label class="finish-check">
              <input type="checkbox" id="finishCheck" /> จบเรื่องด้วยตอนนี้
            </label>
            <button class="btn btn-primary" id="submitChapter">ส่งตอนนี้</button>
          </div>
        </div>`;
    } else {
      const partner = story.authors.find((a) => a.id !== currentUserId);
      controlsHtml = `<div class="waiting-box">กำลังรอ ${escapeHtml(partner ? partner.displayName : 'คู่เขียน')} เขียนตอนต่อไป...</div>`;
    }
  } else if (story.status === 'completed') {
    controlsHtml = `<div class="waiting-box">เรื่องนี้จบแล้ว ✦</div>`;
  }

  storyPage.innerHTML = `
    <div class="story-head">
      <span class="genre-tag">${escapeHtml(story.genre)}</span>
      <h1>${escapeHtml(story.title)}<span class="status-pill ${story.status}">${statusLabel}</span></h1>
      <div class="byline">โดย ${authorNames}</div>
    </div>
    <div class="manuscript">${chaptersHtml}</div>
    ${controlsHtml}
  `;

  const submitBtn = document.getElementById('submitChapter');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const text = document.getElementById('chapterText').value.trim();
      const finish = document.getElementById('finishCheck').checked;
      if (!text) { alert('กรุณาเขียนเนื้อหาก่อนส่ง'); return; }
      submitBtn.disabled = true;
      try {
        const data = await api('POST', `/api/stories/${storyId}/chapters`, { text, finish });
        renderStory(data.story);
        schedulePoll(data.story);
      } catch (err) {
        alert(err.message);
        submitBtn.disabled = false;
      }
    });
  }

  schedulePoll(story);
}

function schedulePoll(story) {
  if (pollTimer) clearTimeout(pollTimer);
  // poll ต่อเฉพาะตอนที่รอคู่เขียนอยู่ เพื่อไม่ไปรบกวนตอนที่ผู้ใช้กำลังพิมพ์
  if (story.isAuthor && story.status === 'ongoing' && !story.isMyTurn) {
    pollTimer = setTimeout(loadStory, 5000);
  }
}

async function loadStory() {
  try {
    const { story } = await api('GET', `/api/stories/${storyId}`);
    renderStory(story);
  } catch (err) {
    storyPage.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

(async () => {
  const user = await requireLogin();
  if (!user) return;
  currentUserId = user.id;
  document.getElementById('logoutLink')?.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
  if (!storyId) {
    storyPage.innerHTML = `<div class="empty-state">ไม่พบนิยายเรื่องนี้</div>`;
    return;
  }
  loadStory();
})();
