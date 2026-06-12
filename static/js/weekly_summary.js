/**
 * NutriPrint — Weekly Nutrition Summary
 *
 * Computes and renders a dashboard-style summary panel directly
 * from the meal plan object that already exists in memory.
 * No additional API calls. No hardcoded values.
 *
 * Depends on: nutrition_score.js (must be loaded first)
 *   — reuses _IRON_KEYWORDS, _CALCIUM_KEYWORDS, _FRUIT_KEYWORDS,
 *     _VEGGIE_KEYWORDS, _countMealsMatching, _lc, _SCORE_TARGETS
 */

'use strict';

/* ─── Weekly computation ───────────────────────────────────────────────────── */

/**
 * Derives all weekly totals from the plan object.
 * Every value comes from plan data — nothing is hardcoded.
 *
 * @param {object} plan  Full meal plan from API / currentPlan
 * @returns {object}     wData — all metrics used by the renderer
 */
function computeWeeklySummary(plan) {
  const week     = plan.week || [];
  const days     = week.length || 7;
  const ageGroup = plan.age_group || '9-12';

  /* ── Nutrient totals (from API averages × days) ── */
  const weeklyCalories = Math.round((plan.avg_daily_cal  || 0) * days);
  const weeklyProtein  = +((plan.avg_protein_g           || 0) * days).toFixed(1);
  const weeklyCalcium  = Math.round((plan.avg_calcium_mg || 0) * days);
  const weeklyIronMg   = +((plan.avg_iron_mg             || 0) * days).toFixed(1);

  /* ── Meal counts from keyword scanning ── */
  const ironMeals    = _countMealsMatching(week, _IRON_KEYWORDS);
  const calciumMeals = _countMealsMatching(week, _CALCIUM_KEYWORDS);
  const fruitMeals   = _countMealsMatching(week, _FRUIT_KEYWORDS);
  const veggieMeals  = _countMealsMatching(week, _VEGGIE_KEYWORDS);

  /* ── Cost ── */
  const weeklyCost = plan.total_cost_inr
    ? parseFloat(plan.total_cost_inr)
    : week.reduce((sum, d) => {
        return sum +
          (d.breakfast?.cost_inr || 0) +
          (d.lunch?.cost_inr     || 0) +
          (d.dinner?.cost_inr    || 0);
      }, 0);

  /* ── Daily targets for age group ── */
  const protTarget = _SCORE_TARGETS.protein[ageGroup] || 32;
  const ironTarget = _SCORE_TARGETS.iron[ageGroup]    || 13;
  const calTarget  = _SCORE_TARGETS.calcium[ageGroup] || 800;

  /* ── Per-metric status thresholds ── */
  function status(actual, target, highIs = true) {
    const ratio = actual / target;
    if (highIs) {
      if (ratio >= 0.9)  return 'good';
      if (ratio >= 0.65) return 'fair';
      return 'low';
    } else {
      // Lower is better (e.g. cost)
      if (ratio <= 1.0)  return 'good';
      if (ratio <= 1.2)  return 'fair';
      return 'low';
    }
  }

  /* ── Quick insights ── */
  const insights = [];

  // Protein
  const avgProt = plan.avg_protein_g || 0;
  if (avgProt >= protTarget * 0.9)
    insights.push({ type: 'good', icon: '💪', text: 'Protein intake is adequate for the age group.' });
  else if (avgProt >= protTarget * 0.65)
    insights.push({ type: 'fair', icon: '💪', text: `Protein is slightly below target (${avgProt}g vs ${protTarget}g/day). Consider adding more dal or legumes.` });
  else
    insights.push({ type: 'low',  icon: '💪', text: `Protein intake needs improvement — ${avgProt}g/day vs ${protTarget}g/day target. Add egg, chicken, or horsegram.` });

  // Iron
  const avgIron = plan.avg_iron_mg || 0;
  if (ironMeals >= 7)
    insights.push({ type: 'good', icon: '🩸', text: 'Iron-rich meals are sufficient across the week.' });
  else if (ironMeals >= 4)
    insights.push({ type: 'fair', icon: '🩸', text: 'Iron-rich meals are moderate. Include ragi, palak, or dill leaves more often.' });
  else
    insights.push({ type: 'low',  icon: '🩸', text: 'Very few iron-rich meals detected. Add ragi mudde, horsegram saaru, or egg dishes.' });

  // Calcium
  const avgCal = plan.avg_calcium_mg || 0;
  if (avgCal >= calTarget * 0.9 || calciumMeals >= 7)
    insights.push({ type: 'good', icon: '🦴', text: 'Calcium intake is well covered.' });
  else if (avgCal >= calTarget * 0.65 || calciumMeals >= 4)
    insights.push({ type: 'fair', icon: '🦴', text: 'Calcium intake is moderate. Include more ragi, curd, or milk daily.' });
  else
    insights.push({ type: 'low',  icon: '🦴', text: 'Calcium intake needs improvement. Ragi mudde, curd, and dill leaves are excellent sources.' });

  // Fruits
  if (fruitMeals >= 4)
    insights.push({ type: 'good', icon: '🍌', text: 'Good variety of fruit servings across the week.' });
  else
    insights.push({ type: 'fair', icon: '🍌', text: `Only ${fruitMeals} fruit-based meals found. Add banana sheera or seasonal fruits to breakfast.` });

  // Vegetables
  if (veggieMeals >= 10)
    insights.push({ type: 'good', icon: '🥦', text: 'Vegetable diversity is excellent.' });
  else if (veggieMeals >= 6)
    insights.push({ type: 'fair', icon: '🥦', text: 'Vegetable servings are adequate but could be more varied.' });
  else
    insights.push({ type: 'low',  icon: '🥦', text: `Vegetable servings are low (${veggieMeals} meals). Include drumstick leaves, palak, and mixed veg dishes.` });

  // Cost
  const dailyCostAvg = weeklyCost / days;
  if (dailyCostAvg <= 150)
    insights.push({ type: 'good', icon: '₹', text: `Meal plan is within the ₹150/day school budget (avg ₹${dailyCostAvg.toFixed(0)}/day).` });
  else
    insights.push({ type: 'fair', icon: '₹', text: `Average cost is ₹${dailyCostAvg.toFixed(0)}/day, slightly above the ₹150 target.` });

  return {
    days,
    weeklyCalories,
    weeklyProtein,
    weeklyCalcium,
    weeklyIronMg,
    ironMeals,
    calciumMeals,
    fruitMeals,
    veggieMeals,
    weeklyCost: +weeklyCost.toFixed(1),
    dailyCostAvg: +dailyCostAvg.toFixed(0),
    insights,
    targets: { protTarget, ironTarget, calTarget },
    statuses: {
      protein : status(plan.avg_protein_g  || 0, protTarget),
      iron    : status(ironMeals, 7),
      calcium : status(plan.avg_calcium_mg || 0, calTarget),
      fruits  : status(fruitMeals, 4),
      veggies : status(veggieMeals, 10),
      cost    : status(dailyCostAvg, 150, false),
    },
  };
}

/* ─── Renderer helpers ─────────────────────────────────────────────────────── */

const _STATUS_META = {
  good: { color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7', dot: '#10B981', label: 'Good'  },
  fair: { color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316', label: 'Fair'  },
  low:  { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444', label: 'Needs attention' },
};

function _sm(key) { return _STATUS_META[key] || _STATUS_META.fair; }

/**
 * Single summary card.
 * @param {object} opts
 */
function _card({ icon, label, value, unit, subtext, statusKey }) {
  const s = _sm(statusKey);
  return `
    <div class="wns-card" style="border-color:${s.border};">
      <div class="wns-card-icon-wrap" style="background:${s.bg};">
        <span class="wns-card-icon" aria-hidden="true">${icon}</span>
      </div>
      <div class="wns-card-body">
        <p class="wns-card-label">${label}</p>
        <p class="wns-card-value" style="color:${s.color};">
          ${value}<span class="wns-card-unit">${unit}</span>
        </p>
        ${subtext ? `<p class="wns-card-sub">${subtext}</p>` : ''}
      </div>
      <span class="wns-status-dot" style="background:${s.dot};" title="${s.label}"></span>
    </div>`;
}

/** Insight row */
function _insight({ type, icon, text }) {
  const s = _sm(type);
  return `
    <li class="wns-insight-item" style="border-color:${s.border};background:${s.bg}30;">
      <span class="wns-insight-icon" style="color:${s.color};">${icon}</span>
      <span class="wns-insight-text">${text}</span>
      <span class="wns-insight-badge" style="background:${s.bg};color:${s.color};border-color:${s.border};">
        ${s.label}
      </span>
    </li>`;
}

/* ─── Main renderer ─────────────────────────────────────────────────────────── */

/**
 * Renders the Weekly Nutrition Summary into `container`.
 * @param {HTMLElement} container
 * @param {object}      plan
 */
function renderWeeklySummary(container, plan) {
  if (!container || !plan) return;

  const d = computeWeeklySummary(plan);

  const cards = [
    _card({
      icon: '🔥', label: 'Weekly Calories', statusKey: 'good',
      value: d.weeklyCalories.toLocaleString(), unit: ' kcal',
      subtext: `~${Math.round(d.weeklyCalories / d.days)} kcal/day`,
    }),
    _card({
      icon: '💪', label: 'Weekly Protein', statusKey: d.statuses.protein,
      value: d.weeklyProtein, unit: 'g',
      subtext: `Target: ${d.targets.protTarget * d.days}g (${d.targets.protTarget}g/day)`,
    }),
    _card({
      icon: '🩸', label: 'Iron-Rich Meals', statusKey: d.statuses.iron,
      value: d.ironMeals, unit: ' meals',
      subtext: d.ironMeals >= 7 ? 'Sufficient coverage' : 'Below recommended 7',
    }),
    _card({
      icon: '🦴', label: 'Calcium-Rich Meals', statusKey: d.statuses.calcium,
      value: d.calciumMeals, unit: ' meals',
      subtext: `Avg ${Math.round(d.weeklyCalcium / d.days)} mg/day`,
    }),
    _card({
      icon: '🍌', label: 'Fruit Servings', statusKey: d.statuses.fruits,
      value: d.fruitMeals, unit: ' meals',
      subtext: d.fruitMeals >= 4 ? 'Good variety' : 'Add more fruits',
    }),
    _card({
      icon: '🥦', label: 'Vegetable Servings', statusKey: d.statuses.veggies,
      value: d.veggieMeals, unit: ' meals',
      subtext: d.veggieMeals >= 10 ? 'Excellent diversity' : `Target: 10+ meals/week`,
    }),
    _card({
      icon: '₹', label: 'Estimated Weekly Cost', statusKey: d.statuses.cost,
      value: `₹${d.weeklyCost}`, unit: '',
      subtext: `~₹${d.dailyCostAvg}/day · Budget: ₹150/day`,
    }),
  ];

  const insightRows = d.insights.map(_insight).join('');

  /* Legend pills */
  const legend = ['good','fair','low'].map(k => {
    const s = _sm(k);
    return `<span class="wns-legend-pill" style="background:${s.bg};color:${s.color};border-color:${s.border};">
      <span class="wns-legend-dot" style="background:${s.dot};"></span>${s.label}
    </span>`;
  }).join('');

  container.innerHTML = `
    <div class="wns-panel" role="region" aria-label="Weekly Nutrition Summary">

      <!-- Header -->
      <div class="wns-header">
        <div class="wns-header-left">
          <p class="wns-sublabel">7-Day Overview</p>
          <h3 class="wns-title">Weekly Nutrition Summary</h3>
          <p class="wns-subtitle">Based on ${d.days}-day plan · ${plan.student_name || 'Student'} · ${plan.age_group || ''} yrs</p>
        </div>
        <div class="wns-legend">${legend}</div>
      </div>

      <!-- Summary cards grid -->
      <div class="wns-cards-grid" role="list">
        ${cards.join('')}
      </div>

      <!-- Quick insights -->
      <div class="wns-insights-section">
        <p class="wns-insights-heading">
          <span class="wns-insights-heading-icon">💡</span>
          Quick Insights
        </p>
        <ul class="wns-insights-list" role="list">
          ${insightRows}
        </ul>
      </div>

    </div><!-- /wns-panel -->`;
}
