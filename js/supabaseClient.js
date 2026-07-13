// ─────────────────────────────────────────────────────────────────────
// THE PARLOUR · Supabase + автентифікація власника
// Публічний (anon) ключ безпечно тримати в клієнтському коді —
// реальний захист забезпечує Row Level Security на боці Supabase.
//
// Принцип UI: авторизація максимально непомітна для гостей.
// Гість бачить лише напівпрозорий ключик у шапці та дрібний напис
// «для власника» у футері. Email ніде не показується.
// ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://gigmaayxbuxfzfmuqxfl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZ21hYXl4YnV4ZnpmbXVxeGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2OTE5MzIsImV4cCI6MjA5OTI2NzkzMn0.QTHbDaq9LRLFg_HtZpOXSp3zyk_YyKah6SNEI9KhB8E';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Поточна сесія (null для гостя). */
async function getSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('Помилка отримання сесії:', error);
    return null;
  }
  return data.session;
}

function signIn(email, password) {
  return supabaseClient.auth.signInWithPassword({ email, password });
}

function signOut() {
  return supabaseClient.auth.signOut();
}

function onAuthChange(callback) {
  supabaseClient.auth.onAuthStateChange(callback);
}

/**
 * Малює стан входу в шапці.
 * Гість:    ледь помітний ключик (відкриває модалку входу).
 * Власник:  посилання «Інвентар» + іконка виходу. Без email.
 */
async function renderAuthArea() {
  const area = document.getElementById('auth-area');
  if (!area) return;

  const session = await getSession();
  const invLink = document.getElementById('nav-inventory');

  if (session) {
    if (invLink) invLink.hidden = false;
    area.innerHTML = `
      <button class="icon-btn key-btn" id="signout-btn" type="button"
              title="Вийти" aria-label="Вийти з облікового запису власника">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4H7.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H13"/><path d="M16.5 8.5 20 12l-3.5 3.5M20 12H9.5"/></svg>
      </button>`;
    document.getElementById('signout-btn').addEventListener('click', async () => {
      await signOut();
      window.location.reload();
    });
  } else {
    if (invLink) invLink.hidden = true;
    area.innerHTML = `
      <button class="icon-btn key-btn" id="signin-open-btn" type="button"
              title="Вхід для власника" aria-label="Вхід для власника">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15.8" r="3.6"/><path d="M10.8 13 19.3 4.5M15.7 8.1l2.9 2.9M13 10.8l2 2"/></svg>
      </button>`;
    document.getElementById('signin-open-btn').addEventListener('click', openSignInModal);
  }
}

/* ── Модалка входу (спільна для обох сторінок) ──────────────────── */

function openSignInModal() {
  const modal = document.getElementById('signin-modal');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  const errorEl = document.getElementById('signin-error');
  if (errorEl) errorEl.textContent = '';
  const email = document.getElementById('signin-email');
  if (email) setTimeout(() => email.focus(), 60);
}

function closeSignInModal() {
  const modal = document.getElementById('signin-modal');
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function setupSignInModal() {
  const modal = document.getElementById('signin-modal');
  const form = document.getElementById('signin-form');
  const closeBtn = document.getElementById('signin-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeSignInModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSignInModal();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      const errorEl = document.getElementById('signin-error');
      const submitBtn = form.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      errorEl.textContent = '';

      const { error } = await signIn(email, password);
      submitBtn.disabled = false;

      if (error) {
        errorEl.textContent = 'Не вдалося увійти: перевірте email і пароль.';
        return;
      }
      window.location.reload();
    });
  }
}

/** Ескейпізація тексту перед вставкою в innerHTML. */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
