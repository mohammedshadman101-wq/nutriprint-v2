/**
 * NutriPrint V2 - Bulletproof Exhibition Demo Mode
 * Handles full auto-navigation, typing animations, and mock data injection.
 */

'use strict';

const DEMO_CONFIG = {
  activeKey: 'demo_active',
  stepKey: 'demo_step',
  pausedKey: 'demo_paused',
  steps: [
    { num: 1, page: 'home',         url: '/?demo=true',             title: 'Impact Overview' },
    { num: 2, page: 'bmi',          url: '/bmi?demo=true',          title: 'BMI Assessment' },
    { num: 3, page: 'meal-planner', url: '/meal-planner?demo=true', title: 'AI Meal Planner' },
    { num: 4, page: 'food-catalog', url: '/food-catalog?demo=true', title: 'Karnataka Foods' },
    { num: 5, page: 'dashboard',    url: '/dashboard?demo=true',    title: 'Health Dashboard' },
    { num: 6, page: 'about',        url: '/about?demo=true',        title: 'Project Overview' }
  ]
};

// --- HARDCODED FALLBACK DATA ---

const MOCK_DATA = {
  impact: { meal_plans: 1247, students: 583, foods: 53 },
  bmi: {
    student: { name: "Rahul Kumar", age: 12, gender: "boy", height: 148, weight: 52 },
    result: { bmi: 23.7, category: "normal", color: "green", advice: "Rahul has a healthy BMI. Maintain a balanced diet with local Karnataka foods." }
  },
  mealPlan: `
    <div class="mt-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
      <h3 class="text-lg font-bold text-emerald-900 mb-4">7-Day Karnataka Meal Plan</h3>
      <div class="space-y-3 text-sm">
        <div class="p-3 bg-white rounded-lg shadow-sm"><strong>Monday:</strong> Breakfast: Ragi mudde + Sambar | Lunch: Rice + Dal + Sabzi | Dinner: Chapati + Palya</div>
        <div class="p-3 bg-white rounded-lg shadow-sm"><strong>Tuesday:</strong> Breakfast: Avalakki upma + Chutney | Lunch: Bisibelebath | Dinner: Rice + Rasam</div>
        <div class="p-3 bg-white rounded-lg shadow-sm"><strong>Wednesday:</strong> Breakfast: Idli + Coconut chutney | Lunch: Rice + Rajma | Dinner: Roti + Dal</div>
        <div class="p-3 bg-white rounded-lg shadow-sm"><strong>Thursday:</strong> Breakfast: Dosa + Sambar | Lunch: Pulao + Raita | Dinner: Rice + Sambar</div>
        <div class="p-3 bg-white rounded-lg shadow-sm"><strong>Friday:</strong> Breakfast: Upma + Chutney | Lunch: Rice + Fish curry (non-veg option) | Dinner: Chapati + Sabzi</div>
        <div class="p-3 bg-white rounded-lg shadow-sm"><strong>Saturday:</strong> Breakfast: Poha + Banana | Lunch: Curd rice + Pickle | Dinner: Khichdi</div>
        <div class="p-3 bg-white rounded-lg shadow-sm"><strong>Sunday:</strong> Breakfast: Puri + Potato sabzi | Lunch: Special rice + Papad | Dinner: Light khichdi + Ghee</div>
      </div>
      <div class="mt-4 pt-3 border-t border-emerald-200 text-center font-bold text-emerald-800">
        Estimated Budget: ₹148/day ✅
      </div>
    </div>
  `,
  dashboard: {
    stats: { students: 24, plans: 47, this_month: 12, bmi_assessments: 31 },
    bmiChart: { normal: 10, underweight: 7, overweight: 5, obese: 2 },
    recentPlans: [
      { name: 'Priya Shetty', date: 'Today', status: 'Generated' },
      { name: 'Rahul Kumar', date: 'Today', status: 'Generated' },
      { name: 'Ananya D', date: 'Yesterday', status: 'Generated' },
      { name: 'Karthik S', date: 'Yesterday', status: 'Generated' },
      { name: 'Megha V', date: '2 days ago', status: 'Generated' },
    ],
    students: [
      { name: 'Priya Shetty', age: 10, gender: 'Girl', bmi: '13.8 (Underweight)' },
      { name: 'Rahul Kumar', age: 12, gender: 'Boy', bmi: '23.7 (Normal)' },
      { name: 'Ananya D', age: 11, gender: 'Girl', bmi: '18.2 (Normal)' },
      { name: 'Karthik S', age: 13, gender: 'Boy', bmi: '26.4 (Overweight)' },
      { name: 'Megha V', age: 9, gender: 'Girl', bmi: '14.5 (Normal)' },
      { name: 'Darshan G', age: 14, gender: 'Boy', bmi: '30.1 (Obese)' },
      { name: 'Sneha M', age: 12, gender: 'Girl', bmi: '17.9 (Normal)' },
      { name: 'Varun R', age: 10, gender: 'Boy', bmi: '14.1 (Underweight)' },
    ]
  }
};

// --- CORE ENGINE ---

window.startDemo = function() {
  sessionStorage.setItem(DEMO_CONFIG.activeKey, 'true');
  sessionStorage.setItem(DEMO_CONFIG.stepKey, '1');
  sessionStorage.setItem(DEMO_CONFIG.pausedKey, 'false');
  window.location.href = DEMO_CONFIG.steps[0].url;
};

window.stopDemo = function() {
  sessionStorage.removeItem(DEMO_CONFIG.activeKey);
  sessionStorage.removeItem(DEMO_CONFIG.stepKey);
  sessionStorage.removeItem(DEMO_CONFIG.pausedKey);
  window.location.href = '/';
};

window.toggleDemoPause = function() {
  const isPaused = sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true';
  sessionStorage.setItem(DEMO_CONFIG.pausedKey, (!isPaused).toString());
  const btn = document.getElementById('demoPauseBtn');
  if (btn) btn.innerHTML = !isPaused ? '▶️ Resume Demo' : '⏸️ Pause Demo';
};

function isDemoActive() {
  return new URLSearchParams(window.location.search).get('demo') === 'true' || 
         sessionStorage.getItem(DEMO_CONFIG.activeKey) === 'true';
}

function getStep() {
  return parseInt(sessionStorage.getItem(DEMO_CONFIG.stepKey)) || 1;
}

function nextStep() {
  if (sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true') {
    // If paused, check again in 1s
    setTimeout(nextStep, 1000);
    return;
  }
  
  const current = getStep();
  if (current >= DEMO_CONFIG.steps.length) {
    showEndCard();
    return;
  }
  
  sessionStorage.setItem(DEMO_CONFIG.stepKey, (current + 1).toString());
  window.location.href = DEMO_CONFIG.steps[current].url;
}

// --- UTILS ---

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(elementId, text, speed = 50) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.value = '';
  for (let i = 0; i < text.length; i++) {
    if (sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true') {
      while(sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true') {
        await sleep(500);
      }
    }
    el.value += text.charAt(i);
    await sleep(speed);
  }
}

// --- UI INJECTIONS ---

function injectDemoUI(stepNum) {
  const stepObj = DEMO_CONFIG.steps[stepNum - 1] || DEMO_CONFIG.steps[DEMO_CONFIG.steps.length - 1];
  
  // Progress Bar
  const progContainer = document.createElement('div');
  Object.assign(progContainer.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '4px',
    background: 'rgba(0,0,0,0.1)', zIndex: '100000'
  });
  const progBar = document.createElement('div');
  Object.assign(progBar.style, {
    height: '100%', width: `${(stepNum / DEMO_CONFIG.steps.length) * 100}%`,
    background: '#1D9E75', transition: 'width 0.5s ease'
  });
  progContainer.appendChild(progBar);
  document.body.appendChild(progContainer);

  // Caption
  const caption = document.createElement('div');
  Object.assign(caption.style, {
    position: 'fixed', bottom: '2rem', right: '2rem', zIndex: '99999',
    background: '#0F172A', color: 'white', padding: '1rem 1.5rem',
    borderRadius: '1rem', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    display: 'flex', flexDirection: 'column', gap: '0.25rem'
  });
  caption.innerHTML = `
    <span style="font-size: 0.75rem; color: #34D399; text-transform: uppercase; letter-spacing: 0.05em;">Step ${stepNum} of ${DEMO_CONFIG.steps.length}</span>
    <span style="font-size: 1.1rem;">${stepObj.title}</span>
  `;
  document.body.appendChild(caption);

  // Pause/Resume Button
  const isPaused = sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true';
  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'demoPauseBtn';
  Object.assign(pauseBtn.style, {
    position: 'fixed', bottom: '2rem', left: '2rem', zIndex: '99999',
    background: 'white', color: '#0F172A', padding: '0.75rem 1.25rem',
    borderRadius: '99px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    border: '1px solid #E2E8F0', cursor: 'pointer'
  });
  pauseBtn.innerHTML = isPaused ? '▶️ Resume Demo' : '⏸️ Pause Demo';
  pauseBtn.onclick = window.toggleDemoPause;
  document.body.appendChild(pauseBtn);
  
  // Stop Button
  const stopBtn = document.createElement('button');
  Object.assign(stopBtn.style, {
    position: 'fixed', bottom: '2rem', left: '12rem', zIndex: '99999',
    background: '#FEF2F2', color: '#991B1B', padding: '0.75rem 1.25rem',
    borderRadius: '99px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    border: '1px solid #FECACA', cursor: 'pointer'
  });
  stopBtn.innerHTML = '⏹️ Exit';
  stopBtn.onclick = window.stopDemo;
  document.body.appendChild(stopBtn);
}

function showEndCard() {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '999999',
    background: 'rgba(15, 23, 42, 0.95)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '2rem',
    backdropFilter: 'blur(8px)'
  });
  
  overlay.innerHTML = `
    <div style="background: white; border-radius: 2rem; padding: 3rem; max-width: 600px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.25);">
      <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
      <h2 style="font-family: Poppins, sans-serif; font-size: 2rem; font-weight: 800; color: #0F172A; margin-bottom: 1rem;">Demo Complete — NutriPrint V2</h2>
      <p style="font-size: 1.1rem; color: #475569; line-height: 1.6; margin-bottom: 2.5rem;">
        In under 60 seconds, NutriPrint assessed 1 student, generated a personalized 7-day Karnataka meal plan within ₹150/day budget, and tracked the health of 24 students.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button onclick="window.startDemo()" style="background: #1D9E75; color: white; padding: 1rem 2rem; border-radius: 99px; font-weight: bold; font-size: 1.1rem; cursor: pointer; border: none; box-shadow: 0 4px 14px rgba(29,158,117,0.3);">
          🔁 Restart Demo
        </button>
        <button onclick="window.stopDemo()" style="background: #F1F5F9; color: #0F172A; padding: 1rem 2rem; border-radius: 99px; font-weight: bold; font-size: 1.1rem; cursor: pointer; border: 1px solid #E2E8F0;">
          🏠 Go to Home
        </button>
      </div>
      <div style="margin-top: 3rem; font-size: 0.85rem; color: #94A3B8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
        Yenepoya Institute of Technology, Moodbidri — Group 7
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// --- STEP RUNNERS ---

async function runHome() {
  await sleep(500);
  // Animate counters
  const counters = document.querySelectorAll('[id^="counter-"]'); // if they exist
  // We'll just wait 2.5 seconds
  await sleep(2500);
  nextStep();
}

async function runBMI() {
  await sleep(1000);
  document.querySelector('#bmiForm')?.scrollIntoView({behavior:'smooth'});
  await sleep(800);
  
  await typeText('bmiName', MOCK_DATA.bmi.student.name);
  await typeText('bmiAge', MOCK_DATA.bmi.student.age.toString());
  
  const genderEl = document.getElementById('bmiGender');
  if(genderEl) genderEl.value = MOCK_DATA.bmi.student.gender;
  
  await typeText('bmiHeight', MOCK_DATA.bmi.student.height.toString());
  await typeText('bmiWeight', MOCK_DATA.bmi.student.weight.toString());
  
  await sleep(500);
  
  const btn = document.querySelector('button[onclick="calculateBMI()"]');
  if (btn) btn.click();
  
  await sleep(1500);
  
  // Inject mock result
  const resEl = document.getElementById('bmiResult');
  if (resEl) {
    resEl.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="heading text-2xl font-bold text-slate-900">${MOCK_DATA.bmi.student.name} — ${MOCK_DATA.bmi.student.age} yrs, ${MOCK_DATA.bmi.student.gender}</h3>
          <p class="mt-1 text-sm text-slate-500">BMI: ${MOCK_DATA.bmi.result.bmi} kg/m²</p>
        </div>
        <span class="rounded-full px-4 py-2 text-sm font-bold bg-emerald-100 text-emerald-800">${MOCK_DATA.bmi.result.category.toUpperCase()}</span>
      </div>
      <div id="resultAdviceEN" class="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700">${MOCK_DATA.bmi.result.advice}</div>
    `;
    resEl.classList.remove('hidden');
    resEl.scrollIntoView({behavior:'smooth', block:'center'});
  }
  
  await sleep(3500);
  nextStep();
}

async function runMealPlanner() {
  await sleep(1000);
  
  await typeText('mealSchool', 'Govt High School Mangalore');
  await typeText('mealStudent', MOCK_DATA.bmi.student.name);
  
  const dietEl = document.getElementById('mealDiet');
  if(dietEl) dietEl.value = 'vegetarian';
  
  const regionEl = document.getElementById('mealRegion');
  if(regionEl) regionEl.value = 'mangalore';
  
  await sleep(500);
  
  const btn = document.getElementById('generateBtn');
  if (btn) btn.click();
  
  await sleep(3000); // Wait for loading anim
  
  const resEl = document.getElementById('mealResult');
  const loadingEl = document.getElementById('mealLoading');
  if (loadingEl) loadingEl.classList.add('hidden');
  
  if (resEl) {
    resEl.innerHTML = MOCK_DATA.mealPlan;
    resEl.classList.remove('hidden');
    resEl.scrollIntoView({behavior:'smooth'});
  }
  
  await sleep(4000);
  nextStep();
}

async function runFoodCatalog() {
  await sleep(1000);
  // Auto-scroll down slowly
  const scrollHeight = document.body.scrollHeight - window.innerHeight;
  const duration = 4000;
  const steps = 60;
  const stepTime = duration / steps;
  
  for(let i=0; i<=steps; i++) {
    if (sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true') {
      while(sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true') await sleep(500);
    }
    window.scrollTo(0, (scrollHeight / steps) * i);
    await sleep(stepTime);
  }
  
  await sleep(1000);
  nextStep();
}

async function runDashboard() {
  await sleep(1000);
  
  // Inject Dashboard Mock Data
  const statStudents = document.getElementById('statStudents');
  if (statStudents) statStudents.innerText = MOCK_DATA.dashboard.stats.students;
  
  const statPlans = document.getElementById('statPlans');
  if (statPlans) statPlans.innerText = MOCK_DATA.dashboard.stats.plans;
  
  const chartCanvas = document.getElementById('bmiChart');
  if (chartCanvas && window.Chart) {
    new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels: ['Normal', 'Underweight', 'Overweight', 'Obese'],
        datasets: [{
          data: [
            MOCK_DATA.dashboard.bmiChart.normal,
            MOCK_DATA.dashboard.bmiChart.underweight,
            MOCK_DATA.dashboard.bmiChart.overweight,
            MOCK_DATA.dashboard.bmiChart.obese
          ],
          backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
        }]
      }
    });
  }
  
  const studentTable = document.getElementById('studentTableBody');
  if (studentTable) {
    studentTable.innerHTML = MOCK_DATA.dashboard.students.map(s => `
      <tr class="border-b border-slate-100">
        <td class="p-3 text-sm font-semibold text-slate-800">${s.name}</td>
        <td class="p-3 text-sm text-slate-600">${s.age}</td>
        <td class="p-3 text-sm text-slate-600">${s.gender}</td>
        <td class="p-3 text-sm text-slate-600">${s.bmi}</td>
      </tr>
    `).join('');
  }
  
  const recentPlans = document.getElementById('recentPlansList');
  if (recentPlans) {
    recentPlans.innerHTML = MOCK_DATA.dashboard.recentPlans.map(p => `
      <div class="flex items-center justify-between p-3 border-b border-slate-100">
        <div class="text-sm font-medium text-slate-800">${p.name}</div>
        <div class="text-xs text-slate-500">${p.date} &bull; <span class="text-emerald-600">${p.status}</span></div>
      </div>
    `).join('');
  }
  
  await sleep(3500);
  nextStep();
}

async function runAbout() {
  await sleep(1000);
  const scrollHeight = document.body.scrollHeight - window.innerHeight;
  const duration = 5000;
  const steps = 80;
  const stepTime = duration / steps;
  
  for(let i=0; i<=steps; i++) {
    if (sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true') {
      while(sessionStorage.getItem(DEMO_CONFIG.pausedKey) === 'true') await sleep(500);
    }
    window.scrollTo(0, (scrollHeight / steps) * i);
    await sleep(stepTime);
  }
  
  await sleep(1500);
  nextStep();
}

// --- BOOTSTRAP ---

window.addEventListener('DOMContentLoaded', () => {
  if (!isDemoActive()) return;
  
  // We ensure sessionStorage knows we are active (in case we came from ?demo=true directly)
  sessionStorage.setItem(DEMO_CONFIG.activeKey, 'true');
  
  const page = document.body.getAttribute('data-page');
  const stepNum = getStep();
  
  // If the page doesn't match the step, force redirect
  const expectedPage = DEMO_CONFIG.steps[stepNum - 1]?.page;
  if (expectedPage && page !== expectedPage) {
    window.location.href = DEMO_CONFIG.steps[stepNum - 1].url;
    return;
  }
  
  injectDemoUI(stepNum);
  
  // Route to specific runner
  switch(page) {
    case 'home': runHome(); break;
    case 'bmi': runBMI(); break;
    case 'meal-planner': runMealPlanner(); break;
    case 'food-catalog': runFoodCatalog(); break;
    case 'dashboard': runDashboard(); break;
    case 'about': runAbout(); break;
    default:
      console.error('Demo: Unknown page', page);
      nextStep();
  }
});
