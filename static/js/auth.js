/**
 * NutriPrint — Teacher Authentication
 * Simple localStorage-based auth (no server dependency).
 *
 * Credentials: teacher@school.com / 123456
 * Session key: np_teacher_session
 */
(function () {
  'use strict';

  const SESSION_KEY = 'np_teacher_session';
  const VALID_EMAIL = 'teacher@school.com';
  const VALID_PASS  = '123456';

  // ── Public API ──────────────────────────────────────────────────────────────

  const NutriAuth = {
    /** Returns the stored session object, or null. */
    getSession() {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      } catch (_) {
        return null;
      }
    },

    /** True when a valid session exists. */
    isLoggedIn() {
      return this.getSession() !== null;
    },

    /**
     * Attempt login with email + password.
     * Returns { ok: true } or { ok: false, error: string }.
     */
    login(email, password) {
      if (
        email.trim().toLowerCase() === VALID_EMAIL &&
        password === VALID_PASS
      ) {
        const session = {
          email     : VALID_EMAIL,
          name      : 'Teacher',
          loggedInAt: Date.now(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true };
      }
      return { ok: false, error: 'Invalid email or password.' };
    },

    /** Clear the session. */
    logout() {
      localStorage.removeItem(SESSION_KEY);
    },

    /**
     * Call on any protected page.
     * Redirects to /login if not authenticated, then returns false.
     * Returns true when authenticated.
     */
    requireAuth() {
      if (!this.isLoggedIn()) {
        // Preserve intended destination so we can redirect back after login
        sessionStorage.setItem('np_login_redirect', window.location.pathname);
        window.location.replace('/login');
        return false;
      }
      return true;
    },

    /** Update the navbar button state (Login ↔ Logout + teacher badge + Dashboard visibility). */
    updateNavbar() {
      const session    = this.getSession();
      const loginBtn   = document.getElementById('loginBtn');
      const logoutBtn  = document.getElementById('logoutBtn');
      const badge      = document.getElementById('teacherBadge');

      // Dashboard links (desktop + mobile)
      const dashLinks  = document.querySelectorAll('.nav-dashboard-link');

      if (session) {
        if (loginBtn)  loginBtn.style.display  = 'none';
        if (logoutBtn) logoutBtn.style.display = '';
        if (badge)     badge.style.display     = '';
        dashLinks.forEach(function (el) { el.style.display = ''; });
      } else {
        if (loginBtn)  loginBtn.style.display  = '';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (badge)     badge.style.display     = 'none';
        dashLinks.forEach(function (el) { el.style.display = 'none'; });
      }
    },
  };

  // Expose globally
  window.NutriAuth = NutriAuth;

  // Auto-update navbar as soon as the DOM is ready
  document.addEventListener('DOMContentLoaded', () => NutriAuth.updateNavbar());
})();
