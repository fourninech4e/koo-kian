// public/js/index.js
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const formError = document.getElementById('formError');

function showError(msg) {
  formError.textContent = msg;
  formError.classList.add('show');
}
function clearError() {
  formError.classList.remove('show');
  formError.textContent = '';
}

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  clearError();
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.style.display = 'block';
  loginForm.style.display = 'none';
  clearError();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    await api('POST', '/api/login', { username, password });
    window.location.href = '/discover.html';
  } catch (err) {
    showError(err.message);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const displayName = document.getElementById('regDisplayName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  try {
    await api('POST', '/api/register', { displayName, username, password });
    window.location.href = '/profile.html';
  } catch (err) {
    showError(err.message);
  }
});

// ถ้า login อยู่แล้ว ให้เด้งไปหน้าค้นหาคู่เขียนเลย
(async () => {
  try {
    const { user } = await api('GET', '/api/me');
    if (user) window.location.href = '/discover.html';
  } catch (e) { /* ยังไม่ได้ login ก็ปกติ */ }
})();
