// ================================================
// Auth Module
// ================================================

let currentUser = null;

function loadUser() {
  const raw = localStorage.getItem('spa_user');
  if (raw) {
    try { currentUser = JSON.parse(raw); } catch { currentUser = null; }
  }
}

function saveUser(user, token) {
  currentUser = user;
  localStorage.setItem('spa_user', JSON.stringify(user));
  localStorage.setItem('spa_token', token);
}

function logout() {
  currentUser = null;
  localStorage.removeItem('spa_user');
  localStorage.removeItem('spa_token');
  renderApp();
}

function renderAuthPage() {
  return `
    <div class="auth-page">
      <div class="auth-bg"></div>
      <div class="auth-card">
        <div class="auth-logo">
          <div class="brand">Some Lucky Resort</div>
          <div class="sub">Spa &amp; Wellness</div>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Giriş</button>
          <button class="auth-tab" data-tab="register">Kayıt</button>
        </div>
        <div id="auth-form-wrap">
          ${renderLoginForm()}
        </div>
      </div>
    </div>
  `;
}

function renderLoginForm() {
  return `
    <div id="login-form">
      <div class="form-group">
        <label class="form-label">E-posta</label>
        <input type="email" class="form-input" id="login-email" placeholder="ornek@email.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">Şifre</label>
        <input type="password" class="form-input" id="login-password" placeholder="••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-gold btn-full" id="login-btn" style="margin-top:8px">Giriş Yap</button>
      <p style="text-align:center;margin-top:16px;font-size:0.75rem;color:var(--text-muted)">
        Demo: <code style="color:var(--gold-400)">admin@voyagesorgun.com</code> / <code style="color:var(--gold-400)">admin123</code>
      </p>
    </div>
  `;
}

function renderRegisterForm() {
  return `
    <div id="register-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Ad Soyad</label>
          <input type="text" class="form-input" id="reg-name" placeholder="Ad Soyad">
        </div>
        <div class="form-group">
          <label class="form-label">Oda No</label>
          <input type="text" class="form-input" id="reg-room" placeholder="412">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">E-posta</label>
        <input type="email" class="form-input" id="reg-email" placeholder="ornek@email.com">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Şifre</label>
          <input type="password" class="form-input" id="reg-pass" placeholder="••••••">
        </div>
        <div class="form-group">
          <label class="form-label">Telefon</label>
          <input type="tel" class="form-input" id="reg-phone" placeholder="+90 ...">
        </div>
      </div>
      <button class="btn btn-gold btn-full" id="register-btn" style="margin-top:8px">Kayıt Ol</button>
    </div>
  `;
}

function bindAuthEvents() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const wrap = document.getElementById('auth-form-wrap');
      if (tab.dataset.tab === 'login') {
        wrap.innerHTML = renderLoginForm();
        bindLoginEvent();
      } else {
        wrap.innerHTML = renderRegisterForm();
        bindRegisterEvent();
      }
    });
  });
  bindLoginEvent();
}

function bindLoginEvent() {
  const btn = document.getElementById('login-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showToast('E-posta ve şifre gerekli', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Giriş yapılıyor...';
    try {
      const data = await API.login(email, password);
      saveUser(data.user, data.token);
      renderApp();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Giriş Yap';
    }
  });

  // Enter key
  ['login-email', 'login-password'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-btn')?.click(); });
  });
}

function bindRegisterEvent() {
  const btn = document.getElementById('register-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const room = document.getElementById('reg-room').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();

    if (!name || !email || !pass) { showToast('Ad, e-posta ve şifre gerekli', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
      const data = await API.register({ name, email, password: pass, room_number: room, phone });
      saveUser(data.user, data.token);
      renderApp();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Kayıt Ol';
    }
  });
}
