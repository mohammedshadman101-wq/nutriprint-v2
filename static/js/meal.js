/* ─── NutriPrint Meal Planner ─────────────────────────────────────────────── */

'use strict';

let currentPlan = null;

// ── Food icon helpers ──────────────────────────────────────────────────────────

const FOOD_ICONS = {
  egg: '🥚', chicken: '🍗', fish: '🐟', rice: '🍚', fruits: '🍎',
  vegetables: '🥦', dal: '🫘', paneer: '🧀', milk: '🥛', nuts: '🥜', default: '🥗',
};

const FOOD_SLUG_MAP = [
  [['egg','mutte','omelette'],          'egg'],
  [['chicken','koli'],                  'chicken'],
  [['fish','meen','prawn'],             'fish'],
  [['rice','anna','chapati','dosa','mudde','ragi','idli','upma','pongal','poha','shavige','akki','jowar','rotti','paratha','sheera','khichdi'], 'rice'],
  [['banana','fruit','apple','mango'],  'fruits'],
  [['palak','spinach','vegetable','soppu','drumstick','methi','dill','colocasia','jackfruit','beans','brinjal','tomato','sweet potato'], 'vegetables'],
  [['dal','saaru','bele','horsegram','moong','rajma','sambar','ambat','bisibele','avarekalu'], 'dal'],
  [['paneer'],                          'paneer'],
  [['milk','curd','mosaru','payasam'],  'milk'],
  [['nut','groundnut','kadlekai','coconut'],'nuts'],
];

function foodSlug(name) {
  const lower = (name || '').toLowerCase();
  for (const [keywords, slug] of FOOD_SLUG_MAP) {
    if (keywords.some(k => lower.includes(k))) return slug;
  }
  return 'default';
}

function foodIconHtml(name, sizeClass = 'w-9 h-9') {
  const slug  = foodSlug(name);
  const emoji = FOOD_ICONS[slug] || FOOD_ICONS.default;
  const url   = slug !== 'default' ? `/static/images/foods/${slug}.svg` : null;

  if (url) {
    return `<div class="food-icon-wrap ${sizeClass} flex-shrink-0" aria-hidden="true">
      <img src="${url}" alt="${escStr(name)}" class="w-full h-full object-contain p-1"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
      <span class="emoji-fallback text-xl hidden items-center justify-center w-full h-full">${emoji}</span>
    </div>`;
  }
  return `<div class="food-icon-wrap ${sizeClass} flex-shrink-0 items-center justify-center" aria-hidden="true">
    <span class="emoji-fallback text-xl">${emoji}</span>
  </div>`;
}

// ── Macro helpers ──────────────────────────────────────────────────────────────

function estimateMacros(cal, protein) {
  const remaining = Math.max(0, cal - protein * 4);
  return {
    carbs_g: +(remaining * 0.55 / 4).toFixed(1),
    fat_g:   +(remaining * 0.45 / 9).toFixed(1),
  };
}

function macroChips(meal) {
  const m = estimateMacros(meal.calories, meal.protein_g);
  return `<span class="macro-chip macro-cal">🔥${Math.round(meal.calories)} cal</span>
    <span class="macro-chip macro-pro">💪${meal.protein_g}g protein</span>
    <span class="macro-chip macro-carb">🍚${m.carbs_g}g carbs</span>
    <span class="macro-chip macro-fat">🥑${m.fat_g}g fat</span>`;
}

// ── Utility ────────────────────────────────────────────────────────────────────

function escStr(v) {
  return String(v ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showError(msg) {
  const el = document.getElementById('formError');
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearErrors() {
  ['mealSchoolErr','mealHeightErr','mealWeightErr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const fe = document.getElementById('formError');
  if (fe) fe.classList.add('hidden');
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateForm() {
  clearErrors();
  let ok = true;

  const school = document.getElementById('mealSchool')?.value.trim();
  if (!school) {
    document.getElementById('mealSchoolErr')?.classList.remove('hidden');
    document.getElementById('mealSchool')?.focus();
    ok = false;
  }

  const height = parseFloat(document.getElementById('mealHeight')?.value);
  if (document.getElementById('mealHeight')?.value && (height < 50 || height > 250)) {
    document.getElementById('mealHeightErr')?.classList.remove('hidden');
    ok = false;
  }

  const weight = parseFloat(document.getElementById('mealWeight')?.value);
  if (document.getElementById('mealWeight')?.value && (weight < 5 || weight > 150)) {
    document.getElementById('mealWeightErr')?.classList.remove('hidden');
    ok = false;
  }

  if (!ok) showError('Please fix the errors above / ಮೇಲಿನ ದೋಷಗಳನ್ನು ಸರಿಪಡಿಸಿ');
  return ok;
}

// ── Meal portion card ──────────────────────────────────────────────────────────

function portionBlock(meal, label) {
  const ingredients = Array.isArray(meal.ingredients) && meal.ingredients.length
    ? meal.ingredients.join(' · ')
    : meal.name_en;
  const nameKn = meal.name_kn ? `<p class="text-xs font-medium text-orange-500 kn mt-0.5">${escStr(meal.name_kn)}</p>` : '';

  return `<div class="meal-portion-card">
    <div class="meal-portion-header">${label}</div>
    <div class="portion-item">
      ${foodIconHtml(meal.name_en, 'w-10 h-10')}
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-gray-800 text-sm leading-tight">${escStr(meal.name_en)}</p>
        ${nameKn}
        <p class="text-xs text-gray-400 mt-1 leading-relaxed truncate">${escStr(ingredients)}</p>
        <div class="portion-macros mt-1.5">${macroChips(meal)}</div>
      </div>
    </div>
  </div>`;
}

// ── Nutrient summary ring ──────────────────────────────────────────────────────

function nutrientRing(icon, label, value, unit) {
  return `<div class="nutrient-ring">
    <div class="icon">${icon}</div>
    <div class="value">${value}</div>
    <div class="label">${label}<br/><span class="text-gray-400">${unit}</span></div>
  </div>`;
}

// ── Generate ───────────────────────────────────────────────────────────────────

async function generateMeal() {
  if (!validateForm()) return;

  const school   = document.getElementById('mealSchool').value.trim();
  const student  = document.getElementById('mealStudent').value.trim() || 'Student';
  const age      = document.getElementById('mealAge').value;
  const gender   = document.getElementById('mealGender').value;
  const height   = parseFloat(document.getElementById('mealHeight')?.value) || null;
  const weight   = parseFloat(document.getElementById('mealWeight')?.value) || null;
  const diet     = document.getElementById('mealDiet').value;
  const region   = document.getElementById('mealRegion').value;
  const month    = document.getElementById('mealMonth').value;
  const strategy = document.getElementById('mealStrategy').value;
  const notes    = document.getElementById('mealHealthNotes')?.value.trim() || '';
  const aiRecs   = window.NutriPrintAdvisor?.getSelectedRecommendations?.() || [];

  document.getElementById('mealLoading')?.classList.remove('hidden');
  document.getElementById('mealResult')?.classList.add('hidden');
  document.getElementById('mealPlaceholder')?.classList.add('hidden');
  document.getElementById('generateBtn').disabled = true;

  try {
    const res = await fetch('/api/meal/generate', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        school_name       : school,
        student_name      : student,
        age_group         : age,
        gender,
        height_cm         : height,
        weight_kg         : weight,
        diet_pref         : diet,
        region,
        month,
        strategy,
        health_notes      : notes || null,
        teacher_id        : localStorage.getItem('teacher_id') || null,
        bmi_class         : window.lastBMIResult?.classification || null,
        ai_recommendations: aiRecs,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Generation failed');
    }

    const plan = await res.json();
    currentPlan = plan;
    renderMealPlan(plan);

    if (plan.plan_id) {
      loadNutritionGap(plan.plan_id, plan.age_group, diet);
      loadFoodEquivalents(plan.age_group, diet);
    }

    // Update URL for refresh persistence
    if (plan.share_token) {
      const url = new URL(window.location.href);
      url.searchParams.set('plan', plan.share_token);
      history.replaceState({ plan: plan.share_token }, '', url.toString());
    }

  } catch (e) {
    console.error('generateMeal error:', e);
    showError(`Could not generate plan: ${e.message}. Please try again.`);
    document.getElementById('mealPlaceholder')?.classList.remove('hidden');
  } finally {
    document.getElementById('mealLoading')?.classList.add('hidden');
    document.getElementById('generateBtn').disabled = false;
  }
}

// ── Load plan by share token (refresh / URL restore) ──────────────────────────

async function loadPlanByToken(token) {
  if (!token) return;
  document.getElementById('mealLoading')?.classList.remove('hidden');
  document.getElementById('mealPlaceholder')?.classList.add('hidden');

  try {
    const res = await fetch(`/api/meal/by-token/${encodeURIComponent(token)}`);
    if (!res.ok) return;
    const plan = await res.json();
    currentPlan = plan;

    // Pre-fill form fields from restored plan
    _fillFormFromPlan(plan);
    renderMealPlan(plan);

    if (plan.plan_id) {
      loadNutritionGap(plan.plan_id, plan.age_group, plan.diet_pref);
      loadFoodEquivalents(plan.age_group, plan.diet_pref);
    }
  } catch (_) {
    document.getElementById('mealPlaceholder')?.classList.remove('hidden');
  } finally {
    document.getElementById('mealLoading')?.classList.add('hidden');
  }
}

function _fillFormFromPlan(plan) {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('mealSchool',   plan.school_name);
  set('mealStudent',  plan.student_name);
  set('mealAge',      plan.age_group);
  set('mealDiet',     plan.diet_pref);
  set('mealRegion',   plan.region);
  set('mealMonth',    plan.month);
  set('mealStrategy', plan.strategy);
  if (plan.bmi_class && window.lastBMIResult) window.lastBMIResult.classification = plan.bmi_class;
}

// ── Render full meal plan ──────────────────────────────────────────────────────

function renderMealPlan(plan) {
  const container = document.getElementById('mealResult');
  if (!container) return;

  const dayCards = (plan.week || []).map(day => {
    const dailyCost = (day.breakfast.cost_inr + day.lunch.cost_inr + day.dinner.cost_inr).toFixed(1);
    return `<div class="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4 shadow-sm">
      <div class="flex items-center justify-between gap-2 bg-primary/8 px-4 py-2.5 border-b border-primary/10">
        <div class="flex items-center gap-2">
          <span class="heading font-bold text-primary text-base">${escStr(day.day)}</span>
          <span class="text-orange-400 text-xs kn">${escStr(day.day_kn)}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 font-medium">₹${dailyCost}/day</span>
          <button onclick="regenerateDay('${escStr(day.day)}')" title="Regenerate this day"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 text-primary text-xs hover:bg-primary hover:text-white transition">🔄</button>
        </div>
      </div>
      <div class="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        ${portionBlock(day.breakfast,'🌅 Breakfast')}
        ${portionBlock(day.lunch,'☀️ Lunch')}
        ${portionBlock(day.dinner,'🌙 Dinner')}
      </div>
    </div>`;
  }).join('');

  const genBadge = plan.generated_by === 'groq'
    ? '<span class="text-xs text-slate-400">🤖 Groq AI</span>'
    : '<span class="text-xs text-slate-400">📋 Local engine</span>';

  container.innerHTML = `
    <!-- Nutrient summary -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      ${nutrientRing('🔥','Avg Cal',   Math.round(plan.avg_daily_cal),'kcal/day')}
      ${nutrientRing('💪','Protein',   plan.avg_protein_g,'g/day')}
      ${nutrientRing('🦴','Calcium',   Math.round(plan.avg_calcium_mg),'mg/day')}
      ${nutrientRing('🩸','Iron',      plan.avg_iron_mg,'mg/day')}
    </div>

    <!-- Budget + source row -->
    <div class="flex flex-wrap items-center justify-between gap-2 mb-5">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold text-green-700">
        ✅ Under ₹150/day · <span class="kn">ದಿನಕ್ಕೆ ₹150 ಒಳಗೆ</span>
      </span>
      <div class="flex items-center gap-3">
        ${genBadge}
        <span class="text-xs text-gray-400">Week total: ₹${plan.total_cost_inr}</span>
      </div>
    </div>

    <!-- Food guide & gap — loaded async -->
    <div id="equivContainer"></div>
    <div id="gapContainer"></div>

    <!-- AI recommendations summary -->
    ${renderAISelectionSummary(plan.ai_recommendations || [])}

    <!-- 7-day cards -->
    <div class="flex items-center justify-between gap-2 mb-3">
      <h3 class="heading font-bold text-gray-800 text-sm">
        📅 7-Day Meal Plan
        <span class="kn text-orange-400 text-xs ml-1">7 ದಿನದ ಊಟದ ಯೋಜನೆ</span>
      </h3>
      <span class="text-xs text-gray-400">${(plan.week || []).length} days</span>
    </div>
    ${dayCards}

    <!-- Action buttons -->
    <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button onclick="downloadPDF()"
        class="flex flex-col items-center gap-1 rounded-2xl bg-primary py-3 px-2 text-white font-bold text-xs hover:bg-green-700 transition shadow-sm">
        <span class="text-lg">📥</span>Download PDF
      </button>
      <button onclick="openPlanPage()"
        class="flex flex-col items-center gap-1 rounded-2xl border-2 border-primary py-3 px-2 text-primary font-bold text-xs hover:bg-green-50 transition">
        <span class="text-lg">🖨️</span>Print Poster
      </button>
      <button onclick="shareWhatsApp()"
        class="flex flex-col items-center gap-1 rounded-2xl bg-[#25D366] py-3 px-2 text-white font-bold text-xs hover:bg-[#1ebe5d] transition shadow-sm">
        <span class="text-lg">📲</span>WhatsApp
      </button>
      <button onclick="downloadReportCard()"
        class="flex flex-col items-center gap-1 rounded-2xl bg-blue-500 py-3 px-2 text-white font-bold text-xs hover:bg-blue-600 transition shadow-sm">
        <span class="text-lg">🏥</span>Health Report
      </button>
    </div>`;

  container.classList.remove('hidden');
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Show advisor if not yet rendered
  if (window.NutriPrintAdvisor) {
    const ap = document.getElementById('advisorPanel');
    if (ap && !ap.innerHTML.trim()) window.NutriPrintAdvisor.render(ap);
  }
}

// ── AI recommendations summary (after generation) ─────────────────────────────

function renderAISelectionSummary(recs) {
  if (!recs.length) return '';
  const cards = recs.map(rec => `
    <div class="flex items-start gap-3 rounded-xl border border-green-100 bg-green-50/70 p-3">
      <span class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-200 text-green-800 text-sm">✓</span>
      <div class="min-w-0">
        <p class="text-sm font-bold text-green-800 leading-tight">${escStr(rec.title)}</p>
        <p class="mt-0.5 text-xs text-green-700">${escStr(rec.short_action)}</p>
        <div class="mt-1.5 flex flex-wrap gap-1">
          ${(rec.destinations || []).map(d => `<span class="rounded-full bg-green-100 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">${d === 'report' ? '📄 Report' : d === 'parent' ? '👨‍👩‍👧 Parent' : '🖨️ Poster'}</span>`).join('')}
        </div>
      </div>
    </div>`).join('');

  return `<div class="rounded-2xl border bg-white p-4 mb-5">
    <h3 class="heading font-bold text-gray-800 mb-3 text-sm">
      🤖 AI Recommendations included in this plan
      <span class="kn text-orange-400 text-xs ml-1">AI ಶಿಫಾರಸ್ಸುಗಳು</span>
    </h3>
    <div class="grid sm:grid-cols-2 gap-2">${cards}</div>
  </div>`;
}

// ── Regenerate single day ──────────────────────────────────────────────────────

async function regenerateDay(dayName) {
  if (!currentPlan?.plan_id) { showError('No active plan — please generate first.'); return; }

  const btn = document.querySelector(`[onclick="regenerateDay('${dayName}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    const res = await fetch(`/api/meal/${currentPlan.plan_id}/day`, {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ plan_id: currentPlan.plan_id, day_name: dayName }),
    });
    if (!res.ok) throw new Error('Regenerate failed');

    const data = await res.json();
    const idx  = currentPlan.week.findIndex(d => d.day === dayName);
    if (idx !== -1) currentPlan.week[idx] = data.day;

    renderMealPlan(currentPlan);
    if (currentPlan.plan_id) {
      loadNutritionGap(currentPlan.plan_id, currentPlan.age_group, currentPlan.diet_pref);
      loadFoodEquivalents(currentPlan.age_group, currentPlan.diet_pref);
    }
  } catch (e) {
    showError('Could not regenerate this day. Please try again.');
  }
}

// ── Share/export actions ───────────────────────────────────────────────────────

function downloadPDF() {
  if (!currentPlan?.share_token) { showError('Please generate a plan first.'); return; }
  window.open(`/poster/${currentPlan.share_token}/pdf`, '_blank', 'noopener,noreferrer');
}

function openPlanPage() {
  if (!currentPlan?.share_token) { showError('Please generate a plan first.'); return; }
  window.open(`/plan/${currentPlan.share_token}`, '_blank', 'noopener,noreferrer');
}

function downloadReportCard() {
  if (!currentPlan?.share_token) { showError('Please generate a plan first.'); return; }
  window.open(`/report/${currentPlan.share_token}`, '_blank', 'noopener,noreferrer');
}

function shareWhatsApp() {
  if (!currentPlan?.share_token) { showError('Please generate a plan first.'); return; }
  const url = `${window.location.origin}/plan/${currentPlan.share_token}`;
  const msg = encodeURIComponent(
    `NutriPrint meal plan for ${currentPlan.student_name}:\n${url}\n\nGenerated by NutriPrint — Free school nutrition app 🥗`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
}

// ── Nutrition Gap Analysis ─────────────────────────────────────────────────────

async function loadNutritionGap(planId, ageGroup, dietPref) {
  const container = document.getElementById('gapContainer');
  if (!container) return;

  container.innerHTML = `<div class="rounded-2xl border bg-white p-4 mb-5 animate-pulse">
    <div class="h-4 w-48 bg-slate-100 rounded mb-4"></div>
    <div class="space-y-3">${'<div class="h-8 bg-slate-100 rounded"></div>'.repeat(4)}</div>
  </div>`;

  const diet = dietPref || document.getElementById('mealDiet')?.value || 'vegetarian';
  try {
    const res = await fetch(
      `/api/bmi/nutrition-gap?plan_id=${encodeURIComponent(planId)}&age_group=${encodeURIComponent(ageGroup)}&diet_pref=${encodeURIComponent(diet)}`
    );
    if (!res.ok) { container.innerHTML = ''; return; }
    const data = await res.json();
    renderNutritionGap(container, data.gaps || []);
  } catch (_) { container.innerHTML = ''; }
}

function renderNutritionGap(container, gaps) {
  if (!gaps.length) { container.innerHTML = ''; return; }

  const rows = gaps.map(g => {
    const pct   = Math.min(g.percent, 100);
    const color = g.percent < 60 ? '#EF4444' : g.percent < 85 ? '#F97316' : '#10B981';
    const badge = g.percent < 60
      ? '<span class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">🔴 Critical</span>'
      : g.percent < 85
        ? '<span class="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">⚠️ Low</span>'
        : '<span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">✅ Good</span>';

    const icon = g.key === 'calories' ? '🔥' : g.key === 'protein_g' ? '💪' : g.key === 'calcium_mg' ? '🦴' : '🩸';

    return `<div class="p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-1.5">
          <span>${icon}</span>
          <span class="font-semibold text-gray-800 text-sm">${escStr(g.nutrient)}</span>
          ${badge}
        </div>
        <span class="text-gray-500 text-xs font-mono">${g.getting}/${g.needed}${g.unit}</span>
      </div>
      <div class="gap-bar-track">
        <div class="gap-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      ${g.fix_en ? `<p class="mt-1.5 text-xs text-gray-500 leading-relaxed">💡 Add: <span class="text-gray-700 font-medium">${escStr(g.fix_en)}</span></p>
      <p class="mt-0.5 text-xs text-orange-400 kn">${escStr(g.fix_kn || '')}</p>` : ''}
    </div>`;
  }).join('');

  container.innerHTML = `<div class="rounded-2xl border bg-white p-4 sm:p-5 mb-5">
    <h3 class="heading font-bold text-gray-800 mb-3 text-sm">
      📊 Nutrition Gap Analysis
      <span class="kn text-orange-400 text-xs ml-1">ಪೋಷಕಾಂಶ ಕೊರತೆ ವಿಶ್ಲೇಷಣೆ</span>
    </h3>
    <div class="grid sm:grid-cols-2 gap-2">${rows}</div>
  </div>`;
}

// ── Food Quantity Guide ────────────────────────────────────────────────────────

async function loadFoodEquivalents(ageGroup, dietPref) {
  const container = document.getElementById('equivContainer');
  if (!container) return;

  container.innerHTML = `<div class="rounded-2xl border bg-white p-4 mb-5 animate-pulse">
    <div class="h-4 w-48 bg-slate-100 rounded mb-4"></div>
    <div class="grid md:grid-cols-2 gap-3">${'<div class="h-24 bg-slate-100 rounded-xl"></div>'.repeat(4)}</div>
  </div>`;

  const diet = dietPref || currentPlan?.diet_pref || document.getElementById('mealDiet')?.value || 'vegetarian';
  try {
    const res = await fetch(
      `/api/bmi/food-equivalents?age_group=${encodeURIComponent(ageGroup)}&diet_pref=${encodeURIComponent(diet)}`
    );
    if (!res.ok) { container.innerHTML = ''; return; }
    const data = await res.json();
    renderFoodEquivalents(container, data.equivalents || []);
  } catch (_) { container.innerHTML = ''; }
}

function renderFoodEquivalents(container, equivalents) {
  if (!equivalents.length) { container.innerHTML = ''; return; }

  const cards = equivalents.map(eq => {
    const examples = (eq.examples || []).map(ex => `
      <div class="flex items-center gap-2.5 py-1.5 border-b border-slate-100 last:border-0">
        ${foodIconHtml(ex.name, 'w-8 h-8')}
        <div class="min-w-0">
          <p class="text-xs font-semibold text-gray-700 leading-tight">${escStr(ex.serving)}</p>
          <p class="text-xs text-gray-400">${escStr(ex.amount)}${escStr(eq.unit)} ${escStr(eq.nutrient)}</p>
        </div>
      </div>`).join('');

    const combo = (eq.suggested_combo || []).map(item =>
      `<span class="combo-badge">${item.count > 1 ? item.count + '× ' : ''}${escStr(item.serving)}</span>`
    ).join('');

    return `<div class="food-equiv-card">
      <p class="font-bold text-gray-800 text-sm mb-2">${escStr(eq.icon)} ${escStr(eq.nutrient)} Goal: ${escStr(String(eq.target))}${escStr(eq.unit)}</p>
      ${examples}
      ${combo ? `<div class="mt-2 pt-2 border-t border-gray-100">
        <p class="text-xs font-bold text-primary mb-1.5">Suggested combination:</p>
        <div class="flex flex-wrap gap-1">${combo}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  container.innerHTML = `<div class="rounded-2xl border bg-white p-4 sm:p-5 mb-5">
    <h3 class="heading font-bold text-gray-800 mb-3 text-sm">
      🍽️ Food Quantity Guide
      <span class="kn text-orange-400 text-xs ml-1">ಆಹಾರ ಪ್ರಮಾಣ ಮಾರ್ಗದರ್ಶಿ</span>
    </h3>
    <div class="grid md:grid-cols-2 gap-3">${cards}</div>
  </div>`;
}

// ── Init ───────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  // Restore last BMI from localStorage
  try {
    const stored = localStorage.getItem('nutriprint_last_bmi');
    if (stored && !window.lastBMIResult) {
      window.lastBMIResult = JSON.parse(stored);
    }
  } catch (_) {}

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    const token = e.state?.plan || new URLSearchParams(window.location.search).get('plan');
    if (token && (!currentPlan || currentPlan.share_token !== token)) {
      loadPlanByToken(token);
    }
  });
});
