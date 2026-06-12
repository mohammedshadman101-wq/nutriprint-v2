/**
 * NutriPrint — Nutrition Score Engine
 *
 * Calculates a 0-100 score for a generated meal plan based on seven factors:
 *   1. BMI suitability        (15 pts)
 *   2. Protein adequacy       (20 pts)
 *   3. Iron-rich foods        (15 pts)
 *   4. Calcium-rich foods     (15 pts)
 *   5. Dietary diversity      (15 pts)
 *   6. Fruit servings         (10 pts)
 *   7. Vegetable servings     (10 pts)
 *
 * Renders a card directly into a target DOM element.
 */

'use strict';

/* ─── Reference daily targets (ICMR / NIN 2020 school-age guidelines) ─────── */
const _SCORE_TARGETS = {
  /* protein g/day by age-group */
  protein: { '5-8': 16, '9-12': 32, '13-15': 45 },
  /* iron mg/day */
  iron:    { '5-8': 9,  '9-12': 13, '13-15': 21 },
  /* calcium mg/day */
  calcium: { '5-8': 600, '9-12': 800, '13-15': 1000 },
  /* minimum distinct food items across a week for "diverse" plan */
  diversity: 12,
};

/* ─── Food classification keyword sets ─────────────────────────────────────── */
const _IRON_KEYWORDS = [
  'ragi','horsegram','avarekalu','palak','dill','drumstick','bengal gram',
  'methi','egg','fish','chicken','prawn','liver','spinach','green gram',
  'beans','lentil','dal','jowar','bajra','amaranth',
];
const _CALCIUM_KEYWORDS = [
  'ragi','milk','curd','paneer','sesame','til','amaranth','roti','drumstick',
  'dill','calcium','fish','prawn','coconut','idli','dosa','upma',
];
const _FRUIT_KEYWORDS = [
  'banana','mango','papaya','guava','orange','apple','chiku','jackfruit',
  'pineapple','pomegranate','grape','amla','dates','fig','berry','sheera',
  'halwa',  /* banana/carrot halwa counts */
];
const _VEGGIE_KEYWORDS = [
  'palak','spinach','drumstick','dill','methi','colocasia','sweet potato',
  'jackfruit','pathrode','banana flower','tomato','vegetable','veg',
  'brinjal','vangi','beans','carrot','pumpkin','yam','plantain','saaru',
  'sambar','rasam','gojju','curry','usli','fry',
];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function _lc(str) { return String(str || '').toLowerCase(); }

/**
 * Count how many unique meal names across the week match at least one keyword.
 * Returns { matched: Set<string>, total: number }
 */
function _countMealsMatching(week, keywords) {
  const matched = new Set();
  for (const day of week) {
    for (const slot of [day.breakfast, day.lunch, day.dinner]) {
      if (!slot) continue;
      const name = _lc(slot.name_en);
      if (keywords.some(k => name.includes(k))) matched.add(slot.name_en);
    }
  }
  return matched.size;
}

/** All distinct meal names in the week */
function _distinctMeals(week) {
  const names = new Set();
  for (const day of week) {
    for (const slot of [day.breakfast, day.lunch, day.dinner]) {
      if (slot?.name_en) names.add(slot.name_en);
    }
  }
  return names.size;
}

/* ─── Core scoring function ─────────────────────────────────────────────────── */

/**
 * @param {object} plan  - the full meal plan returned from the API
 * @returns {object}     - { total, grade, factors, suggestions }
 */
function calculateNutritionScore(plan) {
  const week      = plan.week || [];
  const ageGroup  = plan.age_group || '9-12';
  const bmiClass  = _lc(plan.bmi_class || plan.bmi_classification || 'normal');
  const scores    = {};
  const maxScores = {};
  const suggestions = [];

  /* ── 1. BMI suitability (15 pts) ─────────────────────────────────────────── */
  maxScores.bmi = 15;
  const strategy = _lc(plan.strategy || '');
  const bmiScore = (() => {
    // Full marks when strategy aligns with BMI class, partial if neutral
    if (bmiClass === 'normal')       return 15;
    if (bmiClass === 'underweight')  return strategy.includes('protein') || strategy.includes('high') ? 15 : 9;
    if (bmiClass === 'overweight')   return strategy.includes('calorie') || strategy.includes('control') ? 15 : 9;
    if (bmiClass === 'obese')        return strategy.includes('calorie') || strategy.includes('control') ? 13 : 7;
    return 12; // unknown classification
  })();
  scores.bmi = bmiScore;
  if (bmiScore < 12) {
    if (bmiClass === 'underweight')
      suggestions.push({ icon: '⚖️', text: 'Switch strategy to "High Protein" to better match the student\'s BMI.' });
    else
      suggestions.push({ icon: '⚖️', text: 'Switch strategy to "Calorie Control" to better suit the student\'s BMI.' });
  }

  /* ── 2. Protein adequacy (20 pts) ────────────────────────────────────────── */
  maxScores.protein = 20;
  const protTarget = _SCORE_TARGETS.protein[ageGroup] || 32;
  const protActual = plan.avg_protein_g || 0;
  const protRatio  = Math.min(protActual / protTarget, 1.3); // cap at 130%
  const protScore  = Math.round(20 * Math.min(protRatio, 1));
  scores.protein   = protScore;
  if (protScore < 14) {
    suggestions.push({
      icon: '💪',
      text: `Increase protein intake — current avg ${protActual}g/day vs target ${protTarget}g/day. Add dal, egg, or legumes.`,
    });
  } else if (protScore < 18) {
    suggestions.push({
      icon: '💪',
      text: 'Protein is near target. Consider adding one extra legume serving per day.',
    });
  }

  /* ── 3. Iron-rich foods (15 pts) ─────────────────────────────────────────── */
  maxScores.iron = 15;
  const ironTarget = _SCORE_TARGETS.iron[ageGroup] || 13;
  const ironActual = plan.avg_iron_mg || 0;
  // Also reward iron-keyword meals even if API iron value is low (fallback)
  const ironKeywordCount = _countMealsMatching(week, _IRON_KEYWORDS);
  const ironByValue  = Math.min(ironActual / ironTarget, 1);
  const ironByFood   = Math.min(ironKeywordCount / 5, 1); // 5+ iron meals = full
  const ironRatio    = Math.max(ironByValue, ironByFood * 0.8);
  const ironScore    = Math.round(15 * ironRatio);
  scores.iron = ironScore;
  if (ironScore < 10) {
    suggestions.push({
      icon: '🩸',
      text: 'Add more iron-rich foods — ragi, horsegram, palak, dill leaves, or egg/chicken for non-veg plans.',
    });
  }

  /* ── 4. Calcium-rich foods (15 pts) ──────────────────────────────────────── */
  maxScores.calcium = 15;
  const calTarget = _SCORE_TARGETS.calcium[ageGroup] || 800;
  const calActual = plan.avg_calcium_mg || 0;
  const calKeywordCount = _countMealsMatching(week, _CALCIUM_KEYWORDS);
  const calByValue = Math.min(calActual / calTarget, 1);
  const calByFood  = Math.min(calKeywordCount / 5, 1);
  const calRatio   = Math.max(calByValue, calByFood * 0.8);
  const calScore   = Math.round(15 * calRatio);
  scores.calcium = calScore;
  if (calScore < 10) {
    suggestions.push({
      icon: '🦴',
      text: 'Boost calcium — include ragi mudde, curd, milk, or sesame-based dishes daily.',
    });
  }

  /* ── 5. Dietary diversity (15 pts) ───────────────────────────────────────── */
  maxScores.diversity = 15;
  const distinctCount  = _distinctMeals(week);
  const divTarget      = _SCORE_TARGETS.diversity;
  const divScore       = Math.round(15 * Math.min(distinctCount / divTarget, 1));
  scores.diversity = divScore;
  if (divScore < 10) {
    suggestions.push({
      icon: '🌈',
      text: `Improve meal variety — only ${distinctCount} distinct dishes found. Aim for at least ${divTarget} different meals across the week.`,
    });
  }

  /* ── 6. Fruit servings (10 pts) ──────────────────────────────────────────── */
  maxScores.fruits = 10;
  const fruitMeals = _countMealsMatching(week, _FRUIT_KEYWORDS);
  const fruitScore = Math.round(10 * Math.min(fruitMeals / 4, 1)); // 4+ fruit meals = full marks
  scores.fruits = fruitScore;
  if (fruitScore < 5) {
    suggestions.push({
      icon: '🍌',
      text: 'Add more fruit servings — banana sheera, seasonal fruits (mango, papaya, guava) make great breakfast additions.',
    });
  }

  /* ── 7. Vegetable servings (10 pts) ──────────────────────────────────────── */
  maxScores.vegetables = 10;
  const veggieMeals = _countMealsMatching(week, _VEGGIE_KEYWORDS);
  const veggieScore = Math.round(10 * Math.min(veggieMeals / 10, 1)); // 10+ veggie meals = full
  scores.vegetables = veggieScore;
  if (veggieScore < 6) {
    suggestions.push({
      icon: '🥦',
      text: 'Improve vegetable diversity — drumstick leaves, palak, dill, sweet potato add both nutrients and variety.',
    });
  }

  /* ── Total ────────────────────────────────────────────────────────────────── */
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  const grade = (() => {
    if (total >= 90) return { label: 'Excellent', color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7', emoji: '🏆' };
    if (total >= 75) return { label: 'Good',      color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD', emoji: '👍' };
    if (total >= 60) return { label: 'Fair',      color: '#F97316', bg: '#FEF3C7', border: '#FCD34D', emoji: '📈' };
    return              { label: 'Needs Improvement', color: '#EF4444', bg: '#FEE2E2', border: '#FCA5A5', emoji: '⚠️' };
  })();

  const factors = [
    { key: 'bmi',        label: 'BMI Suitability',    icon: '⚖️', score: scores.bmi,       max: 15 },
    { key: 'protein',    label: 'Protein Adequacy',   icon: '💪', score: scores.protein,   max: 20 },
    { key: 'iron',       label: 'Iron-Rich Foods',    icon: '🩸', score: scores.iron,      max: 15 },
    { key: 'calcium',    label: 'Calcium-Rich Foods', icon: '🦴', score: scores.calcium,   max: 15 },
    { key: 'diversity',  label: 'Dietary Diversity',  icon: '🌈', score: scores.diversity, max: 15 },
    { key: 'fruits',     label: 'Fruit Servings',     icon: '🍌', score: scores.fruits,    max: 10 },
    { key: 'vegetables', label: 'Vegetable Servings', icon: '🥦', score: scores.vegetables,max: 10 },
  ];

  return { total, grade, factors, suggestions };
}

/* ─── Renderer ─────────────────────────────────────────────────────────────── */

/**
 * Renders the Nutrition Score card into `container`.
 * @param {HTMLElement} container
 * @param {object}      plan
 */
function renderNutritionScore(container, plan) {
  if (!container || !plan) return;

  const result = calculateNutritionScore(plan);
  const { total, grade, factors, suggestions } = result;
  const pct = total; // already 0–100

  /* Progress bar color stops */
  const barColor = grade.color;

  /* Factor breakdown rows */
  const factorRows = factors.map(f => {
    const fpct   = Math.round((f.score / f.max) * 100);
    const fcolor = fpct >= 80 ? '#10B981' : fpct >= 60 ? '#F97316' : '#EF4444';
    return `
      <div class="ns-factor-row">
        <span class="ns-factor-icon">${f.icon}</span>
        <div class="ns-factor-label">
          <span class="ns-factor-name">${f.label}</span>
          <div class="ns-factor-bar-track">
            <div class="ns-factor-bar-fill"
                 style="width:${fpct}%;background:${fcolor};"
                 role="progressbar" aria-valuenow="${f.score}"
                 aria-valuemin="0" aria-valuemax="${f.max}">
            </div>
          </div>
        </div>
        <span class="ns-factor-pts" style="color:${fcolor}">
          ${f.score}<span class="ns-factor-max">/${f.max}</span>
        </span>
      </div>`;
  }).join('');

  /* Suggestion chips */
  const suggestionList = suggestions.length
    ? suggestions.map(s => `
        <li class="ns-suggestion-item">
          <span class="ns-suggestion-icon">${s.icon}</span>
          <span class="ns-suggestion-text">${s.text}</span>
        </li>`).join('')
    : `<li class="ns-suggestion-item">
         <span class="ns-suggestion-icon">✅</span>
         <span class="ns-suggestion-text">Great nutrition plan! All factors are well balanced.</span>
       </li>`;

  container.innerHTML = `
    <div class="ns-card" role="region" aria-label="Nutrition Score">

      <!-- Header row -->
      <div class="ns-header">
        <div>
          <p class="ns-sublabel">Nutrition Quality</p>
          <h3 class="ns-title">Nutrition Score</h3>
        </div>
        <!-- Big score badge -->
        <div class="ns-score-badge" style="background:${grade.bg};border-color:${grade.border};">
          <span class="ns-score-number" style="color:${grade.color};">${total}</span>
          <span class="ns-score-denom" style="color:${grade.color};">/100</span>
        </div>
      </div>

      <!-- Grade pill + main progress bar -->
      <div class="ns-grade-row">
        <span class="ns-grade-pill" style="background:${grade.bg};color:${grade.color};border-color:${grade.border};">
          ${grade.emoji} ${grade.label}
        </span>
        <span class="ns-grade-hint" style="color:${grade.color};">
          ${total >= 90 ? 'Outstanding nutritional balance' :
            total >= 75 ? 'Well-balanced plan with minor gaps' :
            total >= 60 ? 'Acceptable, a few areas to improve' :
                          'Several nutritional gaps detected'}
        </span>
      </div>

      <!-- Main progress bar -->
      <div class="ns-main-bar-track" role="progressbar"
           aria-valuenow="${total}" aria-valuemin="0" aria-valuemax="100"
           aria-label="Nutrition score ${total} out of 100">
        <div class="ns-main-bar-fill" style="width:${pct}%;background:${barColor};"></div>
        <!-- Scale markers -->
        <div class="ns-bar-markers" aria-hidden="true">
          <span style="left:60%"  title="60 — Fair">60</span>
          <span style="left:75%"  title="75 — Good">75</span>
          <span style="left:90%"  title="90 — Excellent">90</span>
        </div>
      </div>

      <!-- Toggle button for details -->
      <button class="ns-toggle-btn" onclick="NutriScore.toggleDetails(this)"
              aria-expanded="false" aria-controls="nsDetails">
        <span class="ns-toggle-label">View score breakdown</span>
        <svg class="ns-toggle-chevron" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd"
            d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0
               111.06 1.06l-4.25 4.25a.75.75 0 01-1.06
               0L5.22 9.28a.75.75 0 010-1.06z"
            clip-rule="evenodd"/>
        </svg>
      </button>

      <!-- Collapsible details -->
      <div id="nsDetails" class="ns-details hidden">

        <!-- Factor breakdown -->
        <div class="ns-factors-section">
          <p class="ns-section-heading">Score Breakdown</p>
          <div class="ns-factors-grid">${factorRows}</div>
        </div>

        <!-- Suggestions -->
        ${suggestions.length ? `
        <div class="ns-suggestions-section">
          <p class="ns-section-heading">💡 Improvement Suggestions</p>
          <ul class="ns-suggestion-list">${suggestionList}</ul>
        </div>` : `
        <div class="ns-suggestions-section">
          <p class="ns-section-heading">💡 Suggestions</p>
          <ul class="ns-suggestion-list">${suggestionList}</ul>
        </div>`}

      </div><!-- /nsDetails -->

    </div><!-- /ns-card -->`;
}

/* ─── Toggle helper ─────────────────────────────────────────────────────────── */

const NutriScore = {
  toggleDetails(btn) {
    const details  = document.getElementById('nsDetails');
    const label    = btn.querySelector('.ns-toggle-label');
    const chevron  = btn.querySelector('.ns-toggle-chevron');
    const isHidden = details.classList.contains('hidden');

    details.classList.toggle('hidden', !isHidden);
    btn.setAttribute('aria-expanded', String(isHidden));
    label.textContent = isHidden ? 'Hide score breakdown' : 'View score breakdown';
    chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
  },
};
