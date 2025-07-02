import { supabase } from './supabaseClient.js';

// Helper: redirect if already logged in
async function redirectIfLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = 'map.html';
}

// Helper: show error
function showError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || '';
}

// Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
  redirectIfLoggedIn();
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('login-error', '');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showError('login-error', error.message);
    } else {
      window.location.href = 'map.html';
    }
  });
}

// Register
const registerForm = document.getElementById('register-form');
if (registerForm) {
  redirectIfLoggedIn();
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('register-error', '');
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      showError('register-error', error.message);
    } else {
      window.location.href = 'index.html';
    }
  });
}

// Session check for protected pages
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = 'login.html';
  return session;
}

// Logout function
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}
