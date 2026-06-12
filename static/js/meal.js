let currentPlan = null;

const FOOD_ICONS = {
  egg: '🥚', chicken: '🍗', fish: '🐟', rice: '🍚', fruits: '🍎',
  vegetables: '🥦', dal: '🫘', paneer: '🧀', milk: '🥛', nuts: '🥜', default: '🥗',
};

const FOOD_SLUGS = [
  ['egg', 'mutte'], ['chicken', 'koli'], ['fish', 'meen'], ['rice', 'anna', 'chapati', 'dosa', 'mudde', 'ragi'],
  ['banana', 'fruit', 'apple'], ['palak', 'vegetable', 'soppu'], ['dal', 'saaru', 'bele'],
  ['paneer'], ['milk', 'curd', 'mosaru'], ['nut', 'groundnut', 'kadlekai'],
];
const SLUG_NAMES = ['egg', 'chicken', 'fish', 'rice', 'fruits', 'vegetables', 'dal', 'paneer', 'milk', 'nuts'];

function foodSlug(name) {
  const lower = (name || '').toLowerCase();
  for (let i = 0; i < FOOD_SLUGS.length; i++) {
    if (FOOD_SLUGS[i].some(k => lower.includes(k))) return SLUG_NAMES[i];
  }
  return 'default';
}

function foodIconHtml(name, size = 'w-8 h-8') {
  const slug = foodSlug(name);
  const url = slug !== 'default' ? `/static/images/foods/${slug}.svg` : null;
  const emoji = FOOD_ICONS[slug] || FOOD_ICONS.default;
  if (url) {
    return `<div class="food-icon-wrap ${size} flex-shrink-0">
      <img src="${url}" alt="" class="w-6 h-6 object-contain"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
      <span class="emoji-fallback text-lg" style="display:none">${emoji}</span>
    </div>`;
  }
  return `<div class="food-icon-wrap ${size} flex-shrink-0"><span class="emoji-fallback text-lg">${emoji}</span></div>`;
}

function estimateMacros(cal, protein) {
  const remaining = Math.max(0, cal - protein * 4);
  return {
    carbs_g: Math.round(remaining * 0.55 / 4 * 10) / 10,
    fat_g: Math.round(remaining * 0.45 / 9 * 10) / 10,
  };
}

function macroChips(meal) {
  const m = estimateMacros(meal.calories, meal.protein_g);
  return `
    <span class="macro-chip macro-cal">🔥${Math.round(meal.calories)}cal</span>
    <span class="macro-chip macro-pro">💪${meal.protein_g}g</span>
    <span class="macro-chip macro-carb">🍚${m.carbs_g}g</span>
    <span class="macro-chip macro-fat">🥑${m.fat_g}g</span>`;
}

function portionBlock(meal, label) {
  const ingredients = (meal.ingredients || []).join(' · ') || meal.name_en;
  return `
    <div class="meal-portion-card">
      <div class="meal-portion-header">${label}</div>
      <div class="portion-item">
        ${foodIconHtml(meal.name_en)}
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-800 text-sm">${meal.name_en}</p>
          <p class="text-xs text-orange-500 kn">${meal.name_kn}</p>
          <p class="text-xs text-gray-500 mt-1">${ingredients}</p>
          <div class="portion-macros mt-1">${macroChips(meal)}</div>
        </div>
      </div>
    </div>`;
}

async function generateMeal() {
  const school   = document.getElementById('mealSchool').value.trim();
  const student  = document.getElementById('mealStudent').value.trim() || 'Student';
  const age      = document.getElementById('mealAge').value;
  const diet     = document.getElementById('mealDiet').value;
  const region   = document.getElementById('mealRegion').value;
  const month    = document.getElementById('mealMonth').value;
  const strategy = document.getElementById('mealStrategy').value;

  if (!school) {
    alert('Please enter school name / ಶಾಲೆಯ ಹೆಸರು ನಮೂದಿಸಿ');
    return;
  }

  document.getElementById('mealLoading').classList.remove('hidden');
  document.getElementById('mealResult').classList.add('hidden');
  document.getElementById('generateBtn').disabled = true;

  try {
    const res = await fetch('/api/meal/generate', {
      method  : 'POST',
      headers : {'Content-Type':'application/json'},
      body    : JSON.stringify({
        school_name  : school,
        student_name : student,
        age_group    : age,
        diet_pref    : diet,
        region,
        month,
        strategy,
        teacher_id   : localStorage.getItem('teacher_id') || null,
        bmi_class    : window.lastBMIResult?.classification || null,
      })
    });

    if (!res.ok) throw new Error('Generation failed');
    const plan = await res.json();
    currentPlan = plan;
    renderMealPlan(plan);

    if (plan.plan_id) {
      loadNutritionGap(plan.plan_id, plan.age_group);
      loadFoodEquivalents(plan.age_group);
    }

    if (window.NutriPrintRouter) {
      NutriPrintRouter.onPlanGenerated(plan);
    }
  } catch(e) {
    alert('Error generating plan. Please try again.');
  } finally {
    document.getElementById('mealLoading').classList.add('hidden');
    document.getElementById('generateBtn').disabled = false;
  }
}

async function loadPlanByToken(token) {
  try {
    const res = await fetch(`/api/meal/by-token/${token}`);
    if (!res.ok) return;
    const plan = await res.json();
    currentPlan = plan;
    renderMealPlan(plan);
    if (plan.plan_id) {
      loadNutritionGap(plan.plan_id, plan.age_group);
      loadFoodEquivalents(plan.age_group);
    }
    const mealSection = document.getElementById('meal');
    if (mealSection) mealSection.scrollIntoView({ behavior: 'smooth' });
  } catch (_) {}
}

function renderMealPlan(plan) {
  const container = document.getElementById('mealResult');

  const dayCards = plan.week.map(day => `
    <div class="bg-white rounded-2xl border overflow-hidden mb-4">
      <div class="bg-primary/10 px-4 py-2 border-b flex justify-between items-center">
        <div>
          <span class="heading font-bold text-primary">${day.day}</span>
          <span class="text-orange-400 text-xs kn ml-2">${day.day_kn}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">₹${(day.breakfast.cost_inr + day.lunch.cost_inr + day.dinner.cost_inr).toFixed(1)}/day</span>
          <button onclick="regenerateDay('${day.day}')"
            class="text-xs text-primary border border-primary px-2 py-0.5 rounded-lg hover:bg-primary hover:text-white transition">🔄</button>
        </div>
      </div>
      <div class="grid md:grid-cols-3 gap-0 p-3 md:p-0">
        ${portionBlock(day.breakfast, '🌅 Breakfast')}
        ${portionBlock(day.lunch, '☀️ Lunch')}
        ${portionBlock(day.dinner, '🌙 Dinner')}
      </div>
    </div>`).join('');

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      ${[
        ['🔥','Avg Cal',plan.avg_daily_cal,'kcal/day'],
        ['💪','Protein',plan.avg_protein_g,'g/day'],
        ['🦴','Calcium',plan.avg_calcium_mg,'mg/day'],
        ['🩸','Iron',plan.avg_iron_mg,'mg/day'],
      ].map(([icon,label,val,unit]) => `
        <div class="nutrient-ring">
          <div class="icon">${icon}</div>
          <div class="value">${val}</div>
          <div class="label">${label}<br/>${unit}</div>
        </div>`).join('')}
    </div>

    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
      <span class="bg-green-100 text-green-700 text-xs font-bold px-4 py-1.5 rounded-full">
        ✅ Under ₹150/day · ದಿನಕ್ಕೆ ₹150 ಒಳಗೆ
      </span>
      <span class="text-xs text-gray-400">
        Generated by: ${plan.generated_by === 'groq' ? '🤖 Groq AI' : '📋 Local Engine'}
      </span>
    </div>

    <div id="equivContainer"></div>
    <div id="gapContainer"></div>

    <h3 class="heading font-bold text-gray-800 mb-3 text-sm">
      📅 7-Day Meal Plan with Portions
      <span class="kn text-orange-400 text-xs ml-1">7 ದಿನದ ಊಟದ ಯೋಜನೆ</span>
    </h3>
    ${dayCards}

    <div class="flex flex-col sm:flex-row flex-wrap gap-3 mt-6">
      <button onclick="downloadPDF()"
        class="flex-1 min-w-[140px] bg-primary text-white font-bold py-3 rounded-xl hover:bg-green-700 transition heading text-sm">
        📥 Download PDF
      </button>
      <button onclick="openPlanPage()"
        class="flex-1 min-w-[140px] border-2 border-primary text-primary font-bold py-3 rounded-xl hover:bg-green-50 transition heading text-sm">
        🖨️ Print Poster
      </button>
      <button onclick="shareWhatsApp()"
        class="flex-1 min-w-[140px] bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition heading text-sm">
        📲 WhatsApp
      </button>
      <button onclick="downloadReportCard()"
        class="flex-1 min-w-[140px] bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition heading text-sm">
        🏥 Health Report
      </button>
    </div>`;

  container.classList.remove('hidden');
  container.scrollIntoView({behavior:'smooth'});
}

async function regenerateDay(dayName) {
  if (!currentPlan?.plan_id) return;
  const res = await fetch(`/api/meal/${currentPlan.plan_id}/day`, {
    method  : 'PATCH',
    headers : {'Content-Type':'application/json'},
    body    : JSON.stringify({plan_id: currentPlan.plan_id, day_name: dayName})
  });
  if (res.ok) {
    const data = await res.json();
    const idx = currentPlan.week.findIndex(d => d.day === dayName);
    if (idx !== -1) currentPlan.week[idx] = data.day;
    renderMealPlan(currentPlan);
    if (currentPlan.plan_id) {
      loadNutritionGap(currentPlan.plan_id, currentPlan.age_group);
    }
  }
}

function downloadPDF() {
  if (!currentPlan?.share_token) return;
  window.open(`/poster/${currentPlan.share_token}/pdf`, '_blank', 'noopener,noreferrer');
}

function openPlanPage() {
  if (!currentPlan?.share_token) {
    alert('Please generate a plan first');
    return;
  }
  window.open(`/plan/${currentPlan.share_token}`, '_blank', 'noopener,noreferrer');
}

function downloadReportCard() {
  if (!currentPlan?.share_token) {
    alert('Please generate a plan first');
    return;
  }
  window.open(`/report/${currentPlan.share_token}`, '_blank', 'noopener,noreferrer');
}

function shareWhatsApp() {
  if (!currentPlan?.share_token) {
    alert('Please generate a plan first');
    return;
  }
  const planURL = `${window.location.origin}/plan/${currentPlan.share_token}`;
  const msg = encodeURIComponent(
    `NutriPrint meal plan for ${currentPlan.student_name}:\n${planURL}\n\nGenerated by NutriPrint — Free school nutrition app 🥗`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
}

async function loadNutritionGap(planId, ageGroup) {
  const container = document.getElementById('gapContainer');
  if (!container) return;

  const res = await fetch(`/api/bmi/nutrition-gap?plan_id=${planId}&age_group=${ageGroup}`);
  const data = await res.json();

  let rows = '';
  data.gaps.forEach(g => {
    const barW = Math.min(g.percent, 100);
    const barC = g.percent < 60 ? '#EF4444' : g.percent < 85 ? '#F97316' : '#10B981';
    rows += `
      <div class="mb-3">
        <div class="flex justify-between text-sm mb-1">
          <span class="font-semibold text-gray-700">${g.nutrient} ${g.status_label || ''}</span>
          <span class="text-gray-500 text-xs">${g.getting}/${g.needed}${g.unit}</span>
        </div>
        <div class="gap-bar-track">
          <div class="gap-bar-fill" style="width:${barW}%;background:${barC}"></div>
        </div>
        ${g.fix_en ? `<p class="mt-1 text-xs text-gray-500">💡 Add: ${g.fix_en} <span class="text-orange-400 kn">${g.fix_kn || ''}</span></p>` : ''}
      </div>`;
  });

  container.innerHTML = `
    <div class="bg-white rounded-2xl border p-4 sm:p-6 mb-6">
      <h3 class="heading font-bold text-gray-800 mb-4 text-sm">
        📊 Nutrition Gap Analysis
        <span class="kn text-orange-400 text-xs ml-1">ಪೋಷಕಾಂಶ ಕೊರತೆ ವಿಶ್ಲೇಷಣೆ</span>
      </h3>
      ${rows}
    </div>`;
}

async function loadFoodEquivalents(ageGroup) {
  const container = document.getElementById('equivContainer');
  if (!container) return;

  const res = await fetch(`/api/bmi/food-equivalents?age_group=${ageGroup}`);
  const data = await res.json();

  const cards = (data.equivalents || []).map(eq => {
    const examples = eq.examples.map(ex => `
      <div class="food-equiv-row">
        ${foodIconHtml(ex.name, 'w-7 h-7')}
        <span class="text-xs text-gray-700">${ex.display}</span>
      </div>`).join('');

    const combo = (eq.suggested_combo || []).map(item =>
      `<span class="combo-badge">${item.count > 1 ? item.count + '× ' : ''}${item.serving}</span>`
    ).join('');

    return `
      <div class="food-equiv-card">
        <p class="font-bold text-gray-800 text-sm mb-2">${eq.icon} ${eq.nutrient} Goal: ${eq.target}${eq.unit}</p>
        ${examples}
        ${combo ? `<div class="mt-2 pt-2 border-t border-gray-200">
          <p class="text-xs font-bold text-primary mb-1">Suggested combination:</p>
          <div class="flex flex-wrap gap-1">${combo}</div>
        </div>` : ''}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="mb-6">
      <h3 class="heading font-bold text-gray-800 mb-3 text-sm">
        🍽️ Food Quantity Guide
        <span class="kn text-orange-400 text-xs ml-1">ಆಹಾರ ಪ್ರಮಾಣ ಮಾರ್ಗದರ್ಶಿ</span>
      </h3>
      <div class="grid md:grid-cols-2 gap-3">${cards}</div>
    </div>`;
}
