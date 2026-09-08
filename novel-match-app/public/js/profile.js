// public/js/profile.js
const genreChips = document.getElementById('genreChips');
const saveMsg = document.getElementById('saveMsg');
let selectedGenres = new Set();

document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); doLogout(); });

function renderChips(allGenres) {
  genreChips.innerHTML = allGenres.map((g) => `<button type="button" class="chip" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join('');
  genreChips.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const g = chip.getAttribute('data-genre');
      if (selectedGenres.has(g)) { selectedGenres.delete(g); chip.classList.remove('selected'); }
      else { selectedGenres.add(g); chip.classList.add('selected'); }
    });
  });
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('POST', '/api/profile', {
      displayName: document.getElementById('displayName').value,
      bio: document.getElementById('bio').value,
      genres: Array.from(selectedGenres),
      sample: document.getElementById('sample').value,
    });
    saveMsg.textContent = 'บันทึกโปรไฟล์เรียบร้อย';
    saveMsg.classList.add('show');
    setTimeout(() => saveMsg.classList.remove('show'), 2500);
  } catch (err) {
    saveMsg.style.background = '#FBE7E7';
    saveMsg.style.borderColor = '#E9BEBE';
    saveMsg.style.color = '#8C2E2E';
    saveMsg.textContent = err.message;
    saveMsg.classList.add('show');
  }
});

(async () => {
  const user = await requireLogin();
  if (!user) return;
  const me = await api('GET', '/api/me');
  renderChips(me.genres);
  document.getElementById('displayName').value = user.displayName || '';
  document.getElementById('bio').value = user.bio || '';
  document.getElementById('sample').value = user.sample || '';
  (user.genres || []).forEach((g) => {
    selectedGenres.add(g);
    const chip = genreChips.querySelector(`[data-genre="${g}"]`);
    if (chip) chip.classList.add('selected');
  });
})();
