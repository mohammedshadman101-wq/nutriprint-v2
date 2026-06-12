(function () {
  const state = {
    history: [],
    recommendations: [],
    loading: false,
    initialized: false,
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function el(id) {
    return document.getElementById(id);
  }

  function numberValue(id) {
    const value = Number(el(id)?.value);
    return Number.isFinite(value) ? value : null;
  }

  function loadStoredBMI() {
    try {
      const stored = localStorage.getItem('nutriprint_last_bmi');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        window.lastBMIResult = parsed;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function syncProfileFromBMI() {
    const bmi = window.lastBMIResult || loadStoredBMI();
    if (!bmi) return;
    if (el('mealStudent') && !el('mealStudent').value) el('mealStudent').value = bmi.student_name || '';
    if (el('mealGender') && !el('mealGender').value) el('mealGender').value = bmi.gender || '';
    if (el('mealHeight') && !el('mealHeight').value && bmi.height_cm) el('mealHeight').value = bmi.height_cm;
    if (el('mealWeight') && !el('mealWeight').value && bmi.weight_kg) el('mealWeight').value = bmi.weight_kg;
    if (el('mealAge') && bmi.age) {
      el('mealAge').value = bmi.age <= 8 ? '5-8' : bmi.age <= 12 ? '9-12' : '13-15';
    }
  }

  function buildProfile() {
    const bmi = window.lastBMIResult || loadStoredBMI() || {};
    return {
      student_name: el('mealStudent')?.value?.trim() || bmi.student_name || 'Student',
      age: bmi.age ? String(bmi.age) : null,
      age_group: el('mealAge')?.value || null,
      gender: el('mealGender')?.value || bmi.gender || null,
      height_cm: numberValue('mealHeight') ?? bmi.height_cm ?? null,
      weight_kg: numberValue('mealWeight') ?? bmi.weight_kg ?? null,
      bmi_value: bmi.bmi_value ?? null,
      bmi_class: bmi.classification || null,
      activity_level: el('mealActivity')?.value || 'moderate',
      health_notes: el('mealHealthNotes')?.value?.trim() || null,
      diet_pref: el('mealDiet')?.value || null,
      region: el('mealRegion')?.value || null,
      month: el('mealMonth')?.value || null,
      strategy: el('mealStrategy')?.value || null,
      allergies: [],
    };
  }

  function profileLine(profile) {
    const bits = [
      profile.student_name,
      profile.age ? `${profile.age} yrs` : profile.age_group,
      profile.gender,
      profile.height_cm ? `${profile.height_cm} cm` : null,
      profile.weight_kg ? `${profile.weight_kg} kg` : null,
      profile.bmi_value ? `BMI ${profile.bmi_value}` : null,
      profile.bmi_class,
      profile.activity_level,
    ].filter(Boolean);
    return bits.join(' · ');
  }

  function recommendationHtml(rec) {
    const destinations = new Set(rec.destinations || ['report', 'parent', 'poster']);
    const checkbox = (dest, label) => `
      <label class="advisor-check">
        <input type="checkbox" data-rec-id="${escapeHtml(rec.id)}" data-dest="${dest}" ${destinations.has(dest) ? 'checked' : ''}>
        <span>${label}</span>
      </label>`;

    return `
      <article class="advisor-rec-card" data-rec-card="${escapeHtml(rec.id)}">
        <div>
          <p class="advisor-rec-title">${escapeHtml(rec.title)}</p>
          <p class="advisor-rec-action">${escapeHtml(rec.short_action)}</p>
          <p class="advisor-rec-body">${escapeHtml(rec.detailed_explanation || rec.parent_guidance)}</p>
        </div>
        <div class="advisor-check-grid">
          ${checkbox('report', 'Add to Printed Report')}
          ${checkbox('parent', 'Add to Parent Guidance')}
          ${checkbox('poster', 'Add to Poster')}
        </div>
      </article>`;
  }

  function renderMessages() {
    const list = el('advisorMessages');
    if (!list) return;
    const messages = state.history.map((msg) => `
      <div class="advisor-message ${msg.role === 'assistant' ? 'assistant' : 'user'}">
        <div>${escapeHtml(msg.content)}</div>
      </div>`).join('');
    const loading = state.loading
      ? '<div class="advisor-message assistant"><span class="advisor-dot"></span><span class="advisor-dot"></span><span class="advisor-dot"></span></div>'
      : '';
    list.innerHTML = messages + loading;
    list.scrollTop = list.scrollHeight;
  }

  function renderRecommendations() {
    const box = el('advisorRecommendations');
    if (!box) return;
    if (!state.recommendations.length) {
      box.innerHTML = '<p class="advisor-empty">AI recommendations you choose will be included when the meal plan is generated.</p>';
      return;
    }
    box.innerHTML = state.recommendations.map(recommendationHtml).join('');
  }

  function selectedRecommendations() {
    return state.recommendations
      .map((rec) => ({
        ...rec,
        destinations: Array.from(document.querySelectorAll(`[data-rec-id="${CSS.escape(rec.id)}"]:checked`))
          .map((input) => input.dataset.dest),
      }))
      .filter((rec) => rec.destinations.length > 0);
  }

  async function ask(question) {
    const text = (question || el('advisorQuestion')?.value || '').trim();
    if (!text || state.loading) return;

    const language = el('advisorLanguage')?.value || 'auto';
    if (el('advisorQuestion')) el('advisorQuestion').value = '';
    state.history.push({ role: 'user', content: text });
    state.loading = true;
    renderMessages();

    try {
      const res = await fetch('/api/ai-advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          language,
          profile: buildProfile(),
          history: state.history.slice(0, -1),
        }),
      });
      if (!res.ok) throw new Error('AI advisor failed');
      const data = await res.json();
      state.history.push({ role: 'assistant', content: data.answer });
      const stamped = (data.recommendations || []).map((rec, index) => ({
        id: `${Date.now()}-${index}`,
        title: rec.title || 'Nutrition recommendation',
        short_action: rec.short_action || rec.title || 'Follow healthy food habits',
        detailed_explanation: rec.detailed_explanation || data.answer,
        parent_guidance: rec.parent_guidance || rec.detailed_explanation || data.answer,
        language: rec.language || (language === 'kn' ? 'kn' : 'en'),
        destinations: ['report', 'parent', 'poster'],
      }));
      state.recommendations.push(...stamped);
    } catch (_) {
      state.history.push({
        role: 'assistant',
        content: 'AI Assistant is temporarily unavailable. You can still generate the meal plan; selected local guidance will be added when available.',
      });
    } finally {
      state.loading = false;
      renderMessages();
      renderRecommendations();
    }
  }

  function render(container) {
    if (!container) return;
    syncProfileFromBMI();
    const profile = buildProfile();
    container.classList.remove('hidden');
    container.innerHTML = `
      <section class="advisor-shell">
        <div class="advisor-header">
          <div class="advisor-kicker">Pre-planning AI Consultation</div>
          <h2 class="advisor-title text-2xl mt-2">Nutrition AI Assistant</h2>
          <p class="advisor-subtitle mt-2">Ask about portions, hydration, Karnataka foods, child health habits, or parent guidance before generating the meal plan.</p>
          <div class="advisor-profile">${escapeHtml(profileLine(profile) || 'Student profile will be used automatically')}</div>
        </div>
        <div class="advisor-body">
          <div class="advisor-chat-grid">
            <div class="advisor-chat-card">
              <div class="advisor-chat-toolbar">
                <select id="advisorLanguage" class="advisor-select">
                  <option value="auto">Auto language</option>
                  <option value="en">English</option>
                  <option value="kn">Kannada</option>
                </select>
                <button type="button" class="advisor-chip" data-question="Give 3 pre-plan recommendations for this student.">Pre-plan tips</button>
                <button type="button" class="advisor-chip" data-question="What portions and hydration should parents follow?">Parent guidance</button>
              </div>
              <div id="advisorMessages" class="advisor-messages"></div>
              <form id="advisorForm" class="advisor-input-row">
                <input id="advisorQuestion" class="advisor-input" placeholder="Ask nutrition question... / ಪೌಷ್ಟಿಕಾಂಶ ಪ್ರಶ್ನೆ ಕೇಳಿ" autocomplete="off">
                <button id="advisorSend" type="submit" class="advisor-send">Ask</button>
              </form>
            </div>
            <div class="advisor-selected-card">
              <div class="advisor-section-title">AI Recommendations</div>
              <p class="advisor-section-note">Choose where each AI recommendation should appear.</p>
              <div id="advisorRecommendations" class="advisor-rec-list"></div>
            </div>
          </div>
        </div>
      </section>`;

    el('advisorForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      ask();
    });
    container.querySelectorAll('[data-question]').forEach((button) => {
      button.addEventListener('click', () => ask(button.dataset.question));
    });
    renderMessages();
    renderRecommendations();
    state.initialized = true;
  }

  window.NutriPrintAdvisor = {
    render,
    renderBMI(container) {
      render(container);
    },
    renderMeal() {},
    loadStoredBMI,
    buildProfile,
    getSelectedRecommendations: selectedRecommendations,
  };

  window.addEventListener('DOMContentLoaded', () => {
    loadStoredBMI();
    const container = el('advisorPanel');
    if (container) render(container);
  });
})();
