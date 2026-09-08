// public/js/matches.js
const matchList = document.getElementById('matchList');
const createModal = document.getElementById('createModal');
const storyGenre = document.getElementById('storyGenre');
let pendingMatchId = null;

document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
document.getElementById('cancelCreate').addEventListener('click', () => createModal.classList.remove('show'));

function renderMatches(matches) {
  if (matches.length === 0) {
    matchList.innerHTML = `<div class="empty-state">
      <div style="font-family:'Noto Serif Thai',serif;font-size:19px;margin-bottom:6px;">ยังไม่มีคู่ที่แมตช์</div>
      <div style="margin-bottom:18px;">ไปปัดหาคู่เขียนที่ถูกใจกันก่อน</div>
      <a href="/discover.html" class="btn btn-primary">ไปค้นหาคู่เขียน</a>
    </div>`;
    return;
  }
  matchList.innerHTML = matches.map((m) => {
    const name = m.partner ? m.partner.displayName : 'ผู้ใช้ที่ถูกลบไปแล้ว';
    const genres = m.partner && m.partner.genres && m.partner.genres.length
      ? m.partner.genres.join(' · ') : 'ยังไม่ระบุแนวที่ชอบ';
    const action = m.storyId
      ? `<a class="btn btn-primary" href="/story.html?id=${m.storyId}">ไปที่ห้องเขียน</a>`
      : `<button class="btn btn-primary" data-match="${m.id}">เริ่มเขียนนิยาย</button>`;
    return `
      <div class="match-row">
        <div class="who">
          <div class="avatar">${initials(name)}</div>
          <div>
            <div class="name">${escapeHtml(name)}</div>
            <div class="tags">${escapeHtml(genres)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="compat">${m.compatibility}% เข้ากันได้</div>
          <div style="margin-top:8px;">${action}</div>
        </div>
      </div>`;
  }).join('');

  matchList.querySelectorAll('button[data-match]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingMatchId = btn.getAttribute('data-match');
      createModal.classList.add('show');
    });
  });
}

document.getElementById('confirmCreate').addEventListener('click', async () => {
  const title = document.getElementById('storyTitle').value.trim() || 'เรื่องไม่มีชื่อ';
  const genre = storyGenre.value;
  try {
    const { story } = await api('POST', '/api/stories', { matchId: pendingMatchId, title, genre, isPublic: true });
    window.location.href = `/story.html?id=${story.id}`;
  } catch (err) {
    alert(err.message);
  }
});

(async () => {
  const user = await requireLogin();
  if (!user) return;
  try {
    const me = await api('GET', '/api/me');
    storyGenre.innerHTML = me.genres.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
    const { matches } = await api('GET', '/api/matches');
    renderMatches(matches);
  } catch (err) {
    matchList.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
})();
