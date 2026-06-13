/**
 * NutriPrint — Demo Mode
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets judges explore the full platform instantly with zero data entry.
 *
 * Activating demo mode:
 *   - Creates a fake NutriAuth session as "Demo Teacher"
 *   - Seeds localStorage with realistic student BMI history,
 *     meal plan traces, and dashboard statistics
 *   - Redirects to /dashboard
 *   - Shows a persistent "Demo Mode Active" yellow badge in the navbar
 *
 * Nothing touches the database or production sessions.
 * Exiting removes all demo keys and returns to /login.
 */

'use strict';

(function () {

  /* ── Keys ──────────────────────────────────────────────────────────────── */
  const SESSION_KEY  = 'np_teacher_session';
  const DEMO_FLAG    = 'np_demo_mode';          // "1" when demo is active

  /* ── Demo session object ────────────────────────────────────────────────── */
  const DEMO_SESSION = {
    email      : 'demo@nutriprint.app',
    name       : 'Demo Teacher',
    school     : 'Government Higher Primary School, Bengaluru',
    loggedInAt : Date.now(),
    isDemo     : true,
  };

  /* ── Sample students ────────────────────────────────────────────────────── */
  const DEMO_STUDENTS = [
    {
      name           : 'Rohan Kumar',
      age            : 12,
      gender         : 'boy',
      height_cm      : 140,
      weight_kg      : 32,
      bmi            : 16.3,
      classification : 'underweight',
      percentile     : 8,
    },
    {
      name           : 'Ananya Shetty',
      age            : 13,
      gender         : 'girl',
      height_cm      : 150,
      weight_kg      : 58,
      bmi            : 25.8,
      classification : 'overweight',
      percentile     : 88,
    },
    {
      name           : 'Kiran Gowda',
      age            : 11,
      gender         : 'boy',
      height_cm      : 145,
      weight_kg      : 40,
      bmi            : 19.0,
      classification : 'normal',
      percentile     : 52,
    },
    {
      name           : 'Priya Shetty',
      age            : 10,
      gender         : 'girl',
      height_cm      : 135,
      weight_kg      : 28,
      bmi            : 15.4,
      classification : 'underweight',
      percentile     : 6,
    },
    {
      name           : 'Aditya Rao',
      age            : 12,
      gender         : 'boy',
      height_cm      : 148,
      weight_kg      : 44,
      bmi            : 20.1,
      classification : 'normal',
      percentile     : 58,
    },
    {
      name           : 'Sneha Nair',
      age            : 11,
      gender         : 'girl',
      height_cm      : 138,
      weight_kg      : 35,
      bmi            : 18.4,
      classification : 'normal',
      percentile     : 45,
    },
  ];

  /* ── Progress history per student (3 assessments each) ─────────────────── */
  const DEMO_HISTORY = {
    'Rohan Kumar' : [
      { date: '01/01/2026', bmi: 14.2, classification: 'underweight', label: 'Week 1'  },
      { date: '01/02/2026', bmi: 15.1, classification: 'underweight', label: 'Week 4'  },
      { date: '01/03/2026', bmi: 16.3, classification: 'underweight', label: 'Week 8'  },
    ],
    'Ananya Shetty' : [
      { date: '01/01/2026', bmi: 27.2, classification: 'overweight', label: 'Week 1'  },
      { date: '01/02/2026', bmi: 26.5, classification: 'overweight', label: 'Week 4'  },
      { date: '01/03/2026', bmi: 25.8, classification: 'overweight', label: 'Week 8'  },
    ],
    'Kiran Gowda' : [
      { date: '01/01/2026', bmi: 18.1, classification: 'normal', label: 'Week 1' },
      { date: '01/02/2026', bmi: 18.6, classification: 'normal', label: 'Week 4' },
      { date: '01/03/2026', bmi: 19.0, classification: 'normal', label: 'Week 8' },
    ],
    'Priya Shetty' : [
      { date: '15/01/2026', bmi: 14.8, classification: 'underweight', label: 'Jan' },
      { date: '15/02/2026', bmi: 15.1, classification: 'underweight', label: 'Feb' },
      { date: '15/03/2026', bmi: 15.4, classification: 'underweight', label: 'Mar' },
    ],
    'Aditya Rao' : [
      { date: '10/01/2026', bmi: 19.5, classification: 'normal', label: 'Jan' },
      { date: '10/02/2026', bmi: 19.8, classification: 'normal', label: 'Feb' },
      { date: '10/03/2026', bmi: 20.1, classification: 'normal', label: 'Mar' },
    ],
    'Sneha Nair' : [
      { date: '05/01/2026', bmi: 17.9, classification: 'normal', label: 'Jan' },
      { date: '05/02/2026', bmi: 18.2, classification: 'normal', label: 'Feb' },
      { date: '05/03/2026', bmi: 18.4, classification: 'normal', label: 'Mar' },
    ],
  };

  /* ── Meal plan token stubs (for plan count display) ─────────────────────── */
  const DEMO_PLAN_TOKENS = Array.from({ length: 8 }, (_, i) => `demo_plan_${i}`);

  /* ── Dashboard override stats ────────────────────────────────────────────── */
  const DEMO_STATS = {
    total_students    : 50,
    total_plans       : 120,
    total_assessments : 50,
    total_foods       : 72,
    plans_this_month  : 18,
    teacher_name      : 'Demo Teacher',
    school_name       : 'Government Higher Primary School, Bengaluru',
  };

  /* ═════════════════════════════════════════════════════════════════════════
     SEED  — write all demo data into localStorage
     ═════════════════════════════════════════════════════════════════════════ */
  function _seed() {
    // BMI history for progress tracker
    Object.entries(DEMO_HISTORY).forEach(([name, records]) => {
      localStorage.setItem('bmi_history_' + name, JSON.stringify(records));
    });

    // Meal plan stubs (so plan count shows up)
    DEMO_PLAN_TOKENS.forEach(token => {
      localStorage.setItem('meal_plan_' + token, '1');
    });

    // Last BMI result (for BMI page pre-fill)
    const first = DEMO_STUDENTS[0];
    localStorage.setItem('nutriprint_last_bmi', JSON.stringify({
      student_name   : first.name,
      age            : first.age,
      gender         : first.gender,
      height_cm      : first.height_cm,
      weight_kg      : first.weight_kg,
      bmi_value      : first.bmi,
      classification : first.classification,
      percentile     : first.percentile,
      z_score        : -2.1,
      advice_en      : 'This student is underweight. Increase calorie and protein intake with Ragi Mudde, Horsegram Saaru, and Groundnut Laddu.',
      advice_kn      : 'ಈ ವಿದ್ಯಾರ್ಥಿ ತೂಕ ಕಡಿಮೆ ಇದ್ದಾರೆ. ರಾಗಿ ಮುದ್ದೆ ಮತ್ತು ಹುರಳಿ ಸಾರು ನೀಡಿ.',
    }));

    // Override dashboard stats that the analytics JS reads
    localStorage.setItem('np_demo_stats', JSON.stringify(DEMO_STATS));

    // Demo flag
    localStorage.setItem(DEMO_FLAG, '1');
  }

  /* ═════════════════════════════════════════════════════════════════════════
     CLEAN  — remove all demo keys
     ═════════════════════════════════════════════════════════════════════════ */
  function _clean() {
    // BMI history
    Object.keys(DEMO_HISTORY).forEach(name => {
      localStorage.removeItem('bmi_history_' + name);
    });
    // Meal plan stubs
    DEMO_PLAN_TOKENS.forEach(token => {
      localStorage.removeItem('meal_plan_' + token);
    });
    localStorage.removeItem('nutriprint_last_bmi');
    localStorage.removeItem('np_demo_stats');
    localStorage.removeItem(DEMO_FLAG);
  }

  /* ═════════════════════════════════════════════════════════════════════════
     PUBLIC API
     ═════════════════════════════════════════════════════════════════════════ */

  /** Returns true if demo mode is active. */
  function isDemo() {
    return localStorage.getItem(DEMO_FLAG) === '1';
  }

  /**
   * Activate demo mode.
   * 1. Writes demo session (NutriAuth compatible)
   * 2. Seeds all mock localStorage data
   * 3. Redirects to /dashboard
   */
  function activate() {
    // Write a NutriAuth-compatible session
    localStorage.setItem(SESSION_KEY, JSON.stringify(DEMO_SESSION));
    _seed();
    window.location.replace('/dashboard');
  }

  /**
   * Exit demo mode.
   * Removes all demo data and the session, returns to /login.
   */
  function exit() {
    if (typeof NutriAuth !== 'undefined') NutriAuth.logout();
    _clean();
    window.location.replace('/login');
  }

  /**
   * Return demo students array (used by dashboard JS to render activity table).
   */
  function getStudents() {
    return DEMO_STUDENTS.map(s => ({
      name           : s.name,
      age            : s.age,
      gender         : s.gender,
      last_bmi       : s.bmi,
      classification : s.classification,
      last_assessed  : Object.values(DEMO_HISTORY[s.name] || [{}]).pop()?.date || '—',
    }));
  }

  /**
   * Return demo stats (used by analytics dashboard JS).
   */
  function getStats() {
    return DEMO_STATS;
  }

  /* ═════════════════════════════════════════════════════════════════════════
     BADGE  — render the Demo Mode Active bar
     ═════════════════════════════════════════════════════════════════════════ */
  function _renderBadge() {
    if (!isDemo()) return;

    // Already rendered?
    if (document.getElementById('demoBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'demoBanner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:.4rem;">
        <span style="width:.55rem;height:.55rem;background:#F97316;border-radius:50%;
                     animation:demoPulse 1.8s ease-in-out infinite;flex-shrink:0;"
              aria-hidden="true"></span>
        🎓 Demo Mode Active
      </span>
      <span style="font-size:.7rem;font-weight:600;opacity:.75;margin-left:.25rem;">
        — Pre-loaded with sample school data
      </span>
      <button onclick="NutriDemo.exit()"
              style="margin-left:auto;background:rgba(0,0,0,.12);border:1px solid rgba(0,0,0,.2);
                     color:inherit;font-size:.72rem;font-weight:800;padding:.25rem .7rem;
                     border-radius:9999px;cursor:pointer;transition:background 150ms;"
              onmouseover="this.style.background='rgba(0,0,0,.22)'"
              onmouseout="this.style.background='rgba(0,0,0,.12)'"
              aria-label="Exit demo mode">
        ✕ Exit Demo
      </button>`;

    Object.assign(banner.style, {
      position       : 'fixed',
      bottom         : '1rem',
      left           : '50%',
      transform      : 'translateX(-50%)',
      zIndex         : '9990',
      display        : 'flex',
      alignItems     : 'center',
      gap            : '.65rem',
      padding        : '.55rem 1rem .55rem 1rem',
      background     : '#FEF3C7',
      border         : '1.5px solid #FDE68A',
      borderRadius   : '9999px',
      boxShadow      : '0 8px 28px rgba(15,23,42,.14)',
      fontSize       : '.8rem',
      fontWeight     : '700',
      color          : '#78350F',
      whiteSpace     : 'nowrap',
      maxWidth        : 'calc(100vw - 2rem)',
      backdropFilter : 'blur(8px)',
      animation      : 'demoBannerIn 350ms cubic-bezier(.22,1,.36,1) both',
    });

    // Keyframes
    if (!document.getElementById('demoKeyframes')) {
      const style = document.createElement('style');
      style.id = 'demoKeyframes';
      style.textContent = `
        @keyframes demoPulse {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:.5;transform:scale(1.3)}
        }
        @keyframes demoBannerIn {
          from{opacity:0;transform:translateX(-50%) translateY(12px)}
          to{opacity:1;transform:translateX(-50%) translateY(0)}
        }
        @media (prefers-reduced-motion:reduce){
          #demoBanner{animation:none!important;}
          #demoBanner span[aria-hidden]{animation:none!important;}
        }`;
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);
  }

  /* ═════════════════════════════════════════════════════════════════════════
     NAVBAR BADGE  — yellow pill shown in the header
     ═════════════════════════════════════════════════════════════════════════ */
  function _updateNavbarDemoBadge() {
    const el = document.getElementById('demoBadge');
    if (!el) return;
    el.style.display = isDemo() ? '' : 'none';
  }

  /* ═════════════════════════════════════════════════════════════════════════
     INIT  — run on every page load
     ═════════════════════════════════════════════════════════════════════════ */
  function _init() {
    if (!isDemo()) return;
    _renderBadge();
    _updateNavbarDemoBadge();

    // Patch NutriAuth.updateNavbar to also update demo badge
    if (typeof NutriAuth !== 'undefined') {
      const _orig = NutriAuth.updateNavbar.bind(NutriAuth);
      NutriAuth.updateNavbar = function () {
        _orig();
        _updateNavbarDemoBadge();
      };
    }
  }

  document.addEventListener('DOMContentLoaded', _init);

  /* ─── Export ─────────────────────────────────────────────────────────── */
  window.NutriDemo = { isDemo, activate, exit, getStudents, getStats };

  /* ═════════════════════════════════════════════════════════════════════════
     FULL AUTO-DEMO NAVIGATION LOGIC
     ═════════════════════════════════════════════════════════════════════════ */
  const DEMO_STEPS = [
    { path: '/', title: 'Home', text: 'Step 1 of 6 — Home: Viewing impact counters...', delay: 4000 },
    { path: '/bmi', title: 'BMI Assessment', text: 'Step 2 of 6 — BMI Assessment: Calculating BMI for student Rahul Kumar...', delay: 4000, action: 'fillBmi' },
    { path: '/meal-planner', title: 'Meal Planner', text: 'Step 3 of 6 — Meal Planner: Generating 7-day Karnataka meal plan...', delay: 4000, action: 'fillMeal' },
    { path: '/food-catalog', title: 'Food Catalog', text: 'Step 4 of 6 — Food Catalog: Browsing Karnataka foods...', delay: 4000, action: 'scrollCatalog' },
    { path: '/dashboard', title: 'Dashboard', text: 'Step 5 of 6 — Dashboard: Tracking class health...', delay: 4000 },
    { path: '/about', title: 'About', text: 'Step 6 of 6 — About: Project information...', delay: 2000, action: 'skipSplash' }
  ];

  function getDemoState() {
    try {
      return JSON.parse(sessionStorage.getItem('autoDemoState')) || null;
    } catch { return null; }
  }
  function setDemoState(state) {
    sessionStorage.setItem('autoDemoState', JSON.stringify(state));
  }
  
  function updateDemoUI(state) {
    if (!state) return;
    const banner = document.getElementById('demoModeBanner');
    const text = document.getElementById('demoProgressText');
    const resumeBtn = document.getElementById('resumeDemoBtn');
    const pauseBtn = document.getElementById('pauseDemoBtn');
    if (banner) banner.classList.remove('hidden');
    if (text && state.step < DEMO_STEPS.length) {
      text.innerText = '- ' + DEMO_STEPS[state.step].title;
    }
    if (resumeBtn && pauseBtn) {
      if (state.paused) {
        resumeBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
      } else {
        resumeBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
      }
    }
    
    // Show tooltip
    if (state.step < DEMO_STEPS.length) {
      let tooltip = document.getElementById('autoDemoTooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'autoDemoTooltip';
        Object.assign(tooltip.style, {
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: '9999',
          background: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '1rem',
          borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: '600',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'all 0.3s ease'
        });
        document.body.appendChild(tooltip);
      }
      tooltip.innerText = DEMO_STEPS[state.step].text;
    }
  }

  function runStepAction(stepData) {
    if (stepData.action === 'fillBmi') {
      setTimeout(() => {
        if(document.getElementById('bmiName')) document.getElementById('bmiName').value = 'Rahul Kumar';
        if(document.getElementById('bmiAge')) document.getElementById('bmiAge').value = '12';
        if(document.getElementById('bmiGender')) document.getElementById('bmiGender').value = 'boy';
        if(document.getElementById('bmiHeight')) document.getElementById('bmiHeight').value = '148';
        if(document.getElementById('bmiWeight')) document.getElementById('bmiWeight').value = '52';
      }, 500);
      setTimeout(() => {
        const btn = document.querySelector('button[onclick="calculateBMI()"]');
        if (btn) btn.click();
      }, 1500);
    } else if (stepData.action === 'fillMeal') {
      setTimeout(() => {
        if(document.getElementById('studentName')) document.getElementById('studentName').value = 'Rahul Kumar';
        if(document.getElementById('budget')) document.getElementById('budget').value = '150';
        if(document.getElementById('region')) document.getElementById('region').value = 'coastal_karnataka';
        if(document.getElementById('dietPref')) document.getElementById('dietPref').value = 'vegetarian';
      }, 500);
      setTimeout(() => {
        const btn = document.querySelector('button[onclick="generateMeal()"]');
        if (btn) btn.click();
      }, 1500);
    } else if (stepData.action === 'scrollCatalog') {
      setTimeout(() => {
        window.scrollBy({ top: 800, behavior: 'smooth' });
      }, 1500);
    }
  }

  function showSummary() {
    const summary = document.createElement('div');
    Object.assign(summary.style, {
      position: 'fixed', inset: '0', zIndex: '10000', background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    summary.innerHTML = `
      <div style="background: white; padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 500px;">
        <h2 style="font-size: 1.5rem; font-weight: 800; color: #1D9E75; margin-bottom: 1rem;">Demo Complete ✅</h2>
        <p style="color: #475569; margin-bottom: 1.5rem; line-height: 1.6;">NutriPrint V2 assessed 1 student, generated a 7-day meal plan, and tracked class health in under 60 seconds.</p>
        <button onclick="window.stopAutoDemo()" style="background: #1D9E75; color: white; padding: 0.75rem 1.5rem; border-radius: 9999px; font-weight: 700;">Finish</button>
      </div>
    `;
    document.body.appendChild(summary);
  }

  function checkDemoFlow() {
    let state = getDemoState();
    if (!state || !state.active || state.paused) return;
    
    const stepData = DEMO_STEPS[state.step];
    if (window.location.pathname !== stepData.path) {
      window.location.href = stepData.path;
      return;
    }
    
    updateDemoUI(state);
    runStepAction(stepData);
    
    setTimeout(() => {
      state = getDemoState(); // refresh in case user paused
      if (!state || !state.active || state.paused) return;
      
      state.step++;
      setDemoState(state);
      
      if (state.step >= DEMO_STEPS.length) {
        showSummary();
      } else {
        window.location.href = DEMO_STEPS[state.step].path;
      }
    }, stepData.delay);
  }

  window.startAutoDemo = function() {
    // Also activate local mock data just to ensure it's there
    localStorage.setItem(SESSION_KEY, JSON.stringify(DEMO_SESSION));
    _seed();
    setDemoState({ active: true, step: 0, paused: false });
    window.location.href = '/';
  };
  
  window.pauseAutoDemo = function() {
    let state = getDemoState();
    if (state) {
      state.paused = true;
      setDemoState(state);
      updateDemoUI(state);
    }
  };
  
  window.resumeAutoDemo = function() {
    let state = getDemoState();
    if (state) {
      state.paused = false;
      setDemoState(state);
      updateDemoUI(state);
      checkDemoFlow();
    }
  };
  
  window.stopAutoDemo = function() {
    sessionStorage.removeItem('autoDemoState');
    const banner = document.getElementById('demoModeBanner');
    if (banner) banner.classList.add('hidden');
    const tooltip = document.getElementById('autoDemoTooltip');
    if (tooltip) tooltip.remove();
    _clean();
    window.location.href = '/';
  };

  // URL override hook
  if (window.location.search.includes('demo=true') && !getDemoState()?.active) {
    window.startAutoDemo();
  } else {
    // If active and not paused, resume check
    const state = getDemoState();
    if (state && state.active) {
      updateDemoUI(state);
      if (!state.paused) {
        checkDemoFlow();
      }
    }
  }

})();
