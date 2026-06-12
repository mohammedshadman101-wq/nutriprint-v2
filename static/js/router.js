/**
 * NutriPrint page state — keeps users on the same view after refresh.
 */
(function () {
  const STORAGE_KEY = 'nutriprint_page_state';

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function getPlanTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('plan') || params.get('token');
  }

  function updateUrlWithPlan(token) {
    if (!token || window.location.pathname !== '/') return;
    const url = new URL(window.location.href);
    url.searchParams.set('plan', token);
    history.replaceState({ plan: token }, '', url.toString());
  }

  function scrollToHash() {
    const hash = window.location.hash;
    if (!hash) return;
    setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }

  function restoreHomepagePlan() {
    const token = getPlanTokenFromUrl();
    if (!token || typeof loadPlanByToken !== 'function') return;
    loadPlanByToken(token);
  }

  window.NutriPrintRouter = {
    saveState,
    loadState,
    updateUrlWithPlan,
    scrollToHash,
    restoreHomepagePlan,
    onPlanGenerated(plan) {
      if (!plan?.share_token) return;
      saveState({ page: 'meal', planToken: plan.share_token });
      updateUrlWithPlan(plan.share_token);
    },
  };

  window.addEventListener('DOMContentLoaded', () => {
    scrollToHash();
    if (window.location.pathname === '/') {
      restoreHomepagePlan();
    }
  });

  window.addEventListener('hashchange', scrollToHash);
})();
