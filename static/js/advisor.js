/* ─── NutriPrint AI Advisor ───────────────────────────────────────────────── */

'use strict';

(function () {

  // ── State ────────────────────────────────────────────────────────────────────

  const state = {
    history        : [],   // [{role, content}]
    recommendations: [],   // AIRecommendation objects
    loading        : false,
    initialized    : false,
    lastContainer  : null,
  };

  // ── Utility ──────────────────────────────────────────────────────────────────

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function el(id) { return document.getElementById(id); }

  function num(id) {
    const v = Number(el(id)?.value);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  // ── Profile building ─────────────────────────────────────────────────────────

  function loadStoredBMI() {
    try {
      const s = localStorage.getItem('nutriprint_last_bmi');
      if (!s) return null;
      const p = JSON.parse(s);
      if (p && typeof p === 'object') window.lastBMIResult = p;
      return p;
    } catch (_) { return null; }
  }

  function syncProfileFromBMI() {
    const bmi = window.lastBMIResult || loadStoredBMI();
    if (!bmi) return;
    const setIfBlank = (id, val) => { const e = el(id); if (e && !e.value && val) e.value = val; };
    setIfBlank('mealStudent', bmi.student_name);
    setIfBlank('mealGender',  bmi.gender);
    if (bmi.height_cm) setIfBlank('mealHeight', bmi.height_cm);
    if (bmi.weight_kg) setIfBlank('mealWeight', bmi.weight_kg);
    if (bmi.age && el('mealAge')) {
      el('mealAge').value = bmi.age <= 8 ? '5-8' : bmi.age <= 12 ? '9-12' : '13-15';
    }
  }

  function buildProfile() {
    const bmi = window.lastBMIResult || loadStoredBMI() || {};
    return {
      student_name  : el('mealStudent')?.value?.trim() || bmi.student_name || 'Student',
      age           : bmi.age ? String(bmi.age) : null,
      age_group     : el('mealAge')?.value || null,
      gender        : el('mealGender')?.value || bmi.gender || null,
      height_cm     : num('mealHeight') ?? bmi.height_cm ?? null,
      weight_kg     : num('mealWeight') ?? bmi.weight_kg ?? null,
      bmi_value     : bmi.bmi_value ?? null,
      bmi_class     : bmi.classification || null,
      activity_level: el('mealActivity')?.value || 'moderate',
      health_notes  : el('mealHealthNotes')?.value?.trim() || null,
      diet_pref     : el('mealDiet')?.value || 'vegetarian',
      region        : el('mealRegion')?.value || null,
      month         : el('mealMonth')?.value || null,
      strategy      : el('mealStrategy')?.value || null,
      allergies     : [],
    };
  }

  function profileSummary(p) {
    return [
      p.student_name,
      p.age ? `${p.age} yrs` : p.age_group ? `Age ${p.age_group}` : null,
      p.gender,
      p.height_cm ? `${p.height_cm} cm` : null,
      p.weight_kg ? `${p.weight_kg} kg` : null,
      p.bmi_value ? `BMI ${p.bmi_value}` : null,
      p.bmi_class  ? p.bmi_class.toUpperCase() : null,
      p.diet_pref  ? `🥗 ${p.diet_pref}` : null,
    ].filter(Boolean).join(' · ');
  }

  // ── Destination icons ─────────────────────────────────────────────────────────

  const DEST_META = {
    report : { icon: '📄', label: 'Printed Report' },
    parent : { icon: '👨‍👩‍👧', label: 'Parent Guidance' },
    poster : { icon: '🖨️', label: 'Poster' },
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  function renderMessages() {
    const list = el('advisorMessages');
    if (!list) return;

    const msgs = state.history.map(msg => {
      const isUser = msg.role === 'user';
      // Convert line breaks to <br> for assistant messages
      const content = isUser
        ? esc(msg.content)
        : esc(msg.content).replace(/\n/g, '<br>');
      return `<div class="advisor-message ${isUser ? 'user' : 'assistant'}" role="${isUser ? 'log' : 'status'}">
        ${isUser ? '' : '<span class="advisor-msg-icon">🤖</span>'}
        <div class="advisor-msg-content">${content}</div>
      </div>`;
    }).join('');

    const loader = state.loading
      ? `<div class="advisor-message assistant">
           <span class="advisor-msg-icon">🤖</span>
           <div class="advisor-msg-content" style="padding:0;background:transparent;border:none;">
             <div class="ld-advisor-typing">
               <div class="ld-dot-row" aria-hidden="true">
                 <span class="ld-dot"></span>
                 <span class="ld-dot"></span>
                 <span class="ld-dot"></span>
               </div>
               <span class="ld-advisor-typing-label">Preparing nutrition guidance…</span>
             </div>
           </div>
         </div>`
      : '';

    list.innerHTML = msgs + loader;
    list.scrollTop = list.scrollHeight;
  }

  function renderRecommendations() {
    const box = el('advisorRecommendations');
    if (!box) return;

    if (!state.recommendations.length) {
      box.innerHTML = `<div class="advisor-empty">
        <p class="font-semibold text-gray-600 text-sm mb-1">No recommendations yet</p>
        <p class="text-xs text-gray-400">Ask a question above to get AI nutrition recommendations. Choose which ones to include in the poster, report, and parent guidance.</p>
      </div>`;
      return;
    }

    box.innerHTML = state.recommendations.map(rec => recCardHtml(rec)).join('');
  }

  function recCardHtml(rec) {
    const dests   = new Set(rec.destinations || ['report', 'parent', 'poster']);
    const checks  = Object.entries(DEST_META).map(([key, meta]) => `
      <label class="advisor-check" title="Include in ${meta.label}">
        <input type="checkbox" data-rec-id="${esc(rec.id)}" data-dest="${key}" ${dests.has(key) ? 'checked' : ''}
          onchange="window._advisorOnDestChange && window._advisorOnDestChange('${esc(rec.id)}')">
        <span>${meta.icon} ${meta.label}</span>
      </label>`).join('');

    const langBadge = rec.language === 'kn'
      ? '<span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 font-bold">ಕನ್ನಡ</span>'
      : '<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-bold">English</span>';

    return `<article class="advisor-rec-card" data-rec-card="${esc(rec.id)}">
      <div class="flex items-start justify-between gap-2 mb-1">
        <p class="advisor-rec-title flex-1">${esc(rec.title)}</p>
        ${langBadge}
      </div>
      <p class="advisor-rec-action">✓ ${esc(rec.short_action)}</p>
      <p class="advisor-rec-body">${esc(rec.detailed_explanation || rec.parent_guidance || '')}</p>
      <div class="advisor-check-grid mt-3">${checks}</div>
      <div class="advisor-rec-confirm hidden mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs text-green-700 font-semibold"
        id="confirm-${esc(rec.id)}">✅ Included in selected outputs</div>
    </article>`;
  }

  // Show confirmation flash when checkbox toggled
  window._advisorOnDestChange = function(recId) {
    const confirm = el(`confirm-${recId}`);
    if (!confirm) return;
    const anyChecked = document.querySelectorAll(`[data-rec-id="${CSS.escape(recId)}"]:checked`).length > 0;
    if (anyChecked) {
      confirm.classList.remove('hidden');
      clearTimeout(confirm._timer);
      confirm._timer = setTimeout(() => confirm.classList.add('hidden'), 2500);
    } else {
      confirm.classList.add('hidden');
    }
  };

  // ── Ask AI ────────────────────────────────────────────────────────────────────

  async function ask(question) {
    const text = (question || el('advisorQuestion')?.value || '').trim();
    if (!text || state.loading) return;

    const language = el('advisorLanguage')?.value || 'auto';
    if (el('advisorQuestion')) el('advisorQuestion').value = '';

    state.history.push({ role: 'user', content: text });
    state.loading = true;
    renderMessages();

    // Disable send during request
    const sendBtn = el('advisorSend');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    try {
      const res = await fetch('/api/ai-advisor/chat', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          question,
          language,
          profile: buildProfile(),
          history: state.history.slice(0, -1).slice(-10), // last 5 turns
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.answer) throw new Error('Empty response');

      state.history.push({ role: 'assistant', content: data.answer });

      // Stamp each recommendation with a unique id + default destinations
      const stamped = (data.recommendations || []).map((rec, i) => ({
        id                  : `rec-${Date.now()}-${i}`,
        title               : rec.title               || 'Nutrition recommendation',
        short_action        : rec.short_action         || rec.title || 'Follow healthy food habits',
        detailed_explanation: rec.detailed_explanation || data.answer,
        parent_guidance     : rec.parent_guidance      || rec.detailed_explanation || data.answer,
        language            : rec.language             || (language === 'kn' ? 'kn' : 'en'),
        destinations        : ['report', 'parent', 'poster'],
      }));

      state.recommendations.push(...stamped);

    } catch (e) {
      console.warn('AI advisor error:', e);
      state.history.push({
        role   : 'assistant',
        content: 'AI Assistant is temporarily unavailable. You can still generate the meal plan — any locally-saved recommendations will be included.',
      });
    } finally {
      state.loading = false;
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Ask'; }
      renderMessages();
      renderRecommendations();
    }
  }

  // ── Get selected recommendations (called by meal.js) ─────────────────────────

  function selectedRecommendations() {
    return state.recommendations
      .map(rec => {
        const checked = Array.from(
          document.querySelectorAll(`[data-rec-id="${CSS.escape(rec.id)}"]:checked`)
        ).map(inp => inp.dataset.dest);
        return { ...rec, destinations: checked };
      })
      .filter(rec => rec.destinations.length > 0);
  }

  // ── Render advisor UI ─────────────────────────────────────────────────────────

  function render(container) {
    if (!container) return;
    syncProfileFromBMI();
    const profile = buildProfile();

    container.classList.remove('hidden');
    container.innerHTML = `
<section class="advisor-shell" role="region" aria-label="AI Nutrition Advisor">

  <!-- Header -->
  <div class="advisor-header">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <p class="advisor-kicker">AI Nutrition Co-pilot</p>
        <h2 class="advisor-title text-xl mt-1">Nutrition AI Assistant</h2>
        <p class="advisor-subtitle mt-1 text-sm">Ask about portions, Karnataka foods, child health, or parent guidance before generating.</p>
      </div>
      <button onclick="window._advisorToggle && window._advisorToggle()" id="advisorToggleBtn"
        class="flex-shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition mt-1"
        aria-expanded="true" aria-controls="advisorBody">
        Collapse ▲
      </button>
    </div>
    <div class="advisor-profile mt-2" aria-label="Student profile">
      ${esc(profileSummary(profile) || 'Student profile will be used automatically')}
    </div>
  </div>

  <!-- Body -->
  <div id="advisorBody" class="advisor-body">

    <!-- Quick chips -->
    <div class="flex flex-wrap gap-2 mb-3">
      <select id="advisorLanguage" class="advisor-select" aria-label="Response language">
        <option value="auto">🌐 Auto</option>
        <option value="en">English</option>
        <option value="kn">ಕನ್ನಡ</option>
      </select>
      <button type="button" class="advisor-chip"
        data-question="Give 3 personalised nutrition recommendations for this student before generating the meal plan.">
        💡 Pre-plan tips
      </button>
      <button type="button" class="advisor-chip"
        data-question="What specific portions and hydration tips should parents follow for this student?">
        👨‍👩‍👧 Parent guidance
      </button>
      <button type="button" class="advisor-chip"
        data-question="Which Karnataka foods are best for improving iron and calcium for this student?">
        🌿 Local foods
      </button>
    </div>

    <!-- Chat + recommendations grid -->
    <div class="advisor-chat-grid">

      <!-- Chat side -->
      <div class="advisor-chat-card flex flex-col">
        <div id="advisorMessages" class="advisor-messages flex-1" role="log" aria-live="polite" aria-label="Conversation"></div>
        <form id="advisorForm" class="advisor-input-row mt-3" novalidate>
          <input id="advisorQuestion" class="advisor-input" type="text"
            placeholder="Ask nutrition question… / ಪ್ರಶ್ನೆ ಕೇಳಿ"
            autocomplete="off" aria-label="Nutrition question" maxlength="800"/>
          <button id="advisorSend" type="submit" class="advisor-send" aria-label="Send question">Ask</button>
        </form>
      </div>

      <!-- Recommendations side -->
      <div class="advisor-selected-card flex flex-col">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div>
            <p class="advisor-section-title text-sm">AI Recommendations</p>
            <p class="advisor-section-note text-xs">Choose where each tip should appear.</p>
          </div>
          ${state.recommendations.length
            ? `<span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">${state.recommendations.length}</span>`
            : ''}
        </div>
        <div id="advisorRecommendations" class="advisor-rec-list flex-1 overflow-y-auto" style="max-height:22rem"></div>
      </div>

    </div>
  </div>

</section>`;

    // Wire events
    el('advisorForm')?.addEventListener('submit', e => { e.preventDefault(); ask(); });
    container.querySelectorAll('[data-question]').forEach(btn => {
      btn.addEventListener('click', () => ask(btn.dataset.question));
    });

    // Collapse/expand toggle
    window._advisorToggle = function () {
      const body = el('advisorBody');
      const btn  = el('advisorToggleBtn');
      if (!body || !btn) return;
      const collapsed = body.classList.toggle('hidden');
      btn.textContent = collapsed ? 'Expand ▼' : 'Collapse ▲';
      btn.setAttribute('aria-expanded', String(!collapsed));
    };

    renderMessages();
    renderRecommendations();
    state.initialized = true;
    state.lastContainer = container;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  window.NutriPrintAdvisor = {
    render,
    renderBMI   : render,
    renderMeal  : () => {},
    loadStoredBMI,
    buildProfile,
    getSelectedRecommendations: selectedRecommendations,
  };

  // Auto-init on DOMContentLoaded
  window.addEventListener('DOMContentLoaded', () => {
    loadStoredBMI();
    const container = el('advisorPanel');
    if (container) render(container);
  });

})();
