// public/js/feed.js
const feedGrid = document.getElementById('feedGrid');
document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); doLogout(); });

function renderFeed(stories) {
  if (stories.length === 0) {
    feedGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      ยังไม่มีนิยายเรื่องไหนเริ่มเขียนเลย — ลองไปแมตช์แล้วเริ่มเรื่องแรกกันดูสิ
    </div>`;
    return;
  }
  feedGrid.innerHTML = stories.map((s) => {
    const authors = s.authors.map((a) => escapeHtml(a.displayName)).join(' & ');
    const statusLabel = s.status === 'completed' ? 'จบแล้ว' : 'กำลังเขียน';
    return `
      <a class="feed-card" href="/story.html?id=${s.id}">
        <span class="genre-tag">${escapeHtml(s.genre)}</span>
        <h3>${escapeHtml(s.title)}</h3>
        <div class="excerpt2">${escapeHtml(s.excerpt)}${s.excerpt.length >= 140 ? '…' : ''}</div>
        <div class="meta">${authors} · ${s.chapterCount} ตอน · ${statusLabel}</div>
      </a>`;
  }).join('');
}

(async () => {
  const user = await requireLogin();
  if (!user) return;
  try {
    const { stories } = await api('GET', '/api/feed');
    renderFeed(stories);
  } catch (err) {
    feedGrid.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
})();
