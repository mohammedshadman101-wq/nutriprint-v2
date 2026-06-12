let lastBMIResult = null;

async function calculateBMI() {
  const name   = document.getElementById('bmiName').value.trim();
  const age    = document.getElementById('bmiAge').value;
  const gender = document.getElementById('bmiGender').value;
  const height = document.getElementById('bmiHeight').value;
  const weight = document.getElementById('bmiWeight').value;

  if (!name || !age || !height || !weight) {
    // Show inline validation error instead of alert
    const resultEl = document.getElementById('bmiResult');
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <div class="es-toast es-toast--warn">
          <span class="es-toast-icon">⚠️</span>
          <div class="es-toast-body">
            <div class="es-toast-title">Missing information</div>
            <div class="es-toast-msg">Please fill in all fields — Name, Age, Height, and Weight — to calculate BMI.</div>
          </div>
        </div>`;
    }
    return;
  }

  // Show loading state
  const btn        = document.querySelector('button[onclick="calculateBMI()"]');
  const resultEl   = document.getElementById('bmiResult');
  const advisorEl  = document.getElementById('advisorPanel');

  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing…'; }

  // Show a loading card where the result will appear
  if (resultEl) {
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="ld-bmi-card">
        <div class="ld-bmi-spinner" role="status" aria-label="Calculating BMI"></div>
        <div>
          <p class="ld-bmi-label">Analyzing student measurements…</p>
          <p class="ld-bmi-sub">Calculating BMI, percentile, and Z-score</p>
        </div>
        <div class="ld-bmi-skeleton w-full">
          <div class="ld-shimmer ld-sk-line ld-sk-line--short"></div>
          <div class="ld-shimmer ld-sk-line ld-sk-line--thick" style="margin-top:0.25rem;"></div>
          <div class="ld-shimmer ld-sk-line ld-sk-line--full" style="height:10px;margin-top:0.75rem;border-radius:9999px;"></div>
          <div class="ld-shimmer ld-sk-line ld-sk-line--med" style="margin-top:0.5rem;"></div>
        </div>
      </div>`;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  try {
    const res = await fetch('/api/bmi/calculate', {
      method  : 'POST',
      headers : {'Content-Type':'application/json'},
      body    : JSON.stringify({
        student_name : name,
        age          : parseInt(age),
        gender,
        height_cm    : parseFloat(height),
        weight_kg    : parseFloat(weight),
        teacher_id   : localStorage.getItem('teacher_id') || null,
      })
    });

    if (!res.ok) {
      if (resultEl) {
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
          <div class="es-card es-card--error es-card--full">
            <div class="es-icon es-icon--red">⚠️</div>
            <div class="es-title">Assessment failed</div>
            <div class="es-body">Unable to calculate BMI right now. Please check the values and try again.</div>
            <button class="es-btn" onclick="document.getElementById('bmiResult').classList.add('hidden')">Try Again</button>
          </div>`;
      }
      return;
    }

    const data = await res.json();

    lastBMIResult = data;
    window.lastBMIResult = data;
    try {
      localStorage.setItem('nutriprint_last_bmi', JSON.stringify(data));
    } catch (_) {}

    // ── Auto-save to progress tracker ──────────────────────────────────────
    try {
      const ptKey     = 'bmi_history_' + data.student_name;
      const ptRecords = JSON.parse(localStorage.getItem(ptKey) || '[]');
      ptRecords.push({
        date           : new Date().toLocaleDateString('en-IN'),
        bmi            : data.bmi_value,
        classification : data.classification,
        age            : data.age,
        gender         : data.gender,
        percentile     : data.percentile,
        z_score        : data.z_score,
        weight_kg      : parseFloat(document.getElementById('bmiWeight')?.value || 0),
        height_cm      : parseFloat(document.getElementById('bmiHeight')?.value || 0),
        label          : null,
      });
      localStorage.setItem(ptKey, JSON.stringify(ptRecords));
      // If progress tracker is on the same page, refresh it
      if (typeof window.ptRender === 'function') window.ptRender();
    } catch (_) {}

    // Restore result el HTML structure before populating
    resultEl.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 id="resultName" class="heading text-2xl font-bold text-slate-900"></h3>
          <p id="resultBMI" class="mt-1 text-sm text-slate-500"></p>
        </div>
        <span id="resultBadge" class="rounded-full px-4 py-2 text-sm font-bold"></span>
      </div>
      <div class="mt-5">
        <div class="mb-1 flex justify-between text-xs text-slate-400"><span>Underweight</span><span>Normal</span><span>Overweight</span><span>Obese</span></div>
        <div class="h-3 w-full rounded-full bg-slate-100"><div id="gaugeBar" class="h-3 rounded-full transition-all duration-700" style="width:0%"></div></div>
        <p id="resultPercentile" class="mt-2 text-right text-xs text-slate-500"></p>
      </div>
      <div id="resultAdviceEN" class="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700"></div>
      <div id="resultAdviceKN" class="kn mt-3 rounded-2xl bg-amber-50 p-4 text-sm text-slate-700"></div>
      <button onclick="prefillMealForm()" class="btn-secondary mt-6 w-full py-3">Generate Meal Plan for this Student</button>`;

    showBMIResult(data);
    showGrowthChart(data.student_name);

  } catch (err) {
    console.error('BMI error:', err);
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <div class="es-card es-card--error es-card--full">
          <div class="es-icon es-icon--red">🔌</div>
          <div class="es-title">Connection problem</div>
          <div class="es-body">Unable to reach the assessment service. Please check your connection and try again.</div>
          <button class="es-btn" onclick="document.getElementById('bmiResult').classList.add('hidden');document.getElementById('bmiName').focus()">Try Again</button>
        </div>`;
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Calculate BMI'; }
  }
}

function showBMIResult(data) {
  document.getElementById('bmiResult').classList.remove('hidden');

  document.getElementById('resultName').textContent =
    `${data.student_name} — ${data.age} yrs, ${data.gender}`;
  document.getElementById('resultBMI').textContent =
    `BMI: ${data.bmi_value} kg/m² · Z-score: ${data.z_score}`;

  const badge = document.getElementById('resultBadge');
  badge.textContent  = data.classification.toUpperCase();
  badge.className    = `px-4 py-1.5 rounded-full text-sm font-bold badge-${data.classification}`;

  // Gauge bar
  const gaugeColors = {
    underweight: '#3B82F6',
    normal     : '#10B981',
    overweight : '#F97316',
    obese      : '#EF4444',
  };
  const bar = document.getElementById('gaugeBar');
  bar.style.width      = `${Math.min(data.percentile, 99)}%`;
  bar.style.background = gaugeColors[data.classification];

  document.getElementById('resultPercentile').textContent =
    `${data.percentile}th percentile`;
  document.getElementById('resultAdviceEN').textContent = data.advice_en;
  document.getElementById('resultAdviceKN').textContent = data.advice_kn;

  if (window.NutriPrintAdvisor) {
    const advisorPanel = document.getElementById('advisorPanel');
    window.NutriPrintAdvisor.renderBMI(advisorPanel, data);
  }

  // Scroll to result
  document.getElementById('bmiResult').scrollIntoView({behavior:'smooth', block:'center'});
}

function prefillMealForm() {
  if (!lastBMIResult) return;
  try {
    localStorage.setItem('prefill_name', lastBMIResult.student_name || '');
    localStorage.setItem('prefill_age', String(lastBMIResult.age || ''));
    localStorage.setItem('prefill_gender', lastBMIResult.gender || 'boy');
    localStorage.setItem('nutriprint_last_bmi', JSON.stringify(lastBMIResult));
  } catch (_) {}
  window.location.href = '/meal-planner';
}

// Voice input
function startVoice(fieldId) {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const resultEl = document.getElementById('bmiResult');
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <div class="es-toast es-toast--info">
          <span class="es-toast-icon">🎙️</span>
          <div class="es-toast-body">
            <div class="es-toast-title">Voice input not supported</div>
            <div class="es-toast-msg">Your browser does not support voice input. Please type the value directly.</div>
          </div>
        </div>`;
    }
    return;
  }
  const SR   = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec  = new SR();
  rec.lang   = 'en-IN';
  rec.start();
  rec.onresult = (e) => {
    const val = e.results[0][0].transcript.replace(/[^0-9.]/g,'');
    document.getElementById(fieldId).value = val;
  };
}

async function showGrowthChart(studentName) {
  // Only shows if same student assessed before
  const records = JSON.parse(
    localStorage.getItem(`bmi_history_${studentName}`) || '[]'
  );

  // Save current result to history
  if (lastBMIResult) {
    records.push({
      date : new Date().toLocaleDateString('en-IN'),
      bmi  : lastBMIResult.bmi_value,
      class: lastBMIResult.classification,
    });
    localStorage.setItem(
      `bmi_history_${studentName}`,
      JSON.stringify(records)
    );
  }

  if (records.length < 2) return; // Need at least 2 points

  // Inject chart container
  const oldChart = document.getElementById('growthChartWrapper');
  if (oldChart) oldChart.remove();
  
  document.getElementById('bmiResult').insertAdjacentHTML(
  'beforeend',
  `<div id="growthChartWrapper" class="mt-6">
     <p class="heading font-bold text-gray-800 mb-3">
       📈 Growth Trend
       <span class="kn text-orange-400 text-sm ml-1">
         ಬೆಳವಣಿಗೆ ಗ್ರಾಫ್
       </span>
     </p>
     <canvas id="growthChart" height="120"></canvas>
   </div>`
);

  const ctx = document.getElementById('growthChart').getContext('2d');
  new Chart(ctx, {
    type : 'line',
    data : {
      labels   : records.map(r => r.date),
      datasets : [{
        label           : 'BMI',
        data            : records.map(r => r.bmi),
        borderColor     : '#1D9E75',
        backgroundColor : 'rgba(29,158,117,0.1)',
        borderWidth     : 3,
        pointRadius     : 6,
        pointBackgroundColor: records.map(r =>
          r.class === 'normal'      ? '#10B981' :
          r.class === 'underweight' ? '#3B82F6' :
          r.class === 'overweight'  ? '#F97316' : '#EF4444'
        ),
        tension: 0.4,
        fill   : true,
      }]
    },
    options: {
      responsive : true,
      plugins    : {
        legend : { display: false },
        tooltip: {
          callbacks: {
            label: ctx =>
              `BMI: ${ctx.raw} — ${records[ctx.dataIndex].class}`
          }
        }
      },
      scales: {
        y: {
          min  : 10,
          max  : 30,
          title: { display:true, text:'BMI (kg/m²)' }
        }
      }
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeInto(id, text) {
  const el = document.getElementById(id);
  el.value = '';
  for (const ch of text) {
    el.value += ch;
    await sleep(50);
  }
}

async function runDemo() {
  document.querySelector('#bmi').scrollIntoView({behavior:'smooth'});
  await sleep(800);

  await typeInto('bmiName',   'Priya Shetty');
  await typeInto('bmiAge',    '10');
  document.getElementById('bmiGender').value = 'girl';
  await typeInto('bmiHeight', '132');
  await typeInto('bmiWeight', '24');
  await sleep(500);

  await calculateBMI();
  await sleep(1500);

  document.querySelector('#meal').scrollIntoView({behavior:'smooth'});
  await sleep(800);

  await typeInto('mealSchool',   'Govt High School Mangalore');
  await typeInto('mealStudent',  'Priya Shetty');
  document.getElementById('mealDiet').value     = 'vegetarian';
  document.getElementById('mealRegion').value   = 'mangalore';
  document.getElementById('mealStrategy').value = 'calcium_iron';
  await sleep(500);

  await generateMeal();
}

// Restore prefill from dashboard reassess on page load
window.addEventListener('DOMContentLoaded', () => {
  const prefillName   = localStorage.getItem('prefill_name');
  const prefillAge    = localStorage.getItem('prefill_age');
  const prefillGender = localStorage.getItem('prefill_gender');

  if (prefillName) {
    const bmiName = document.getElementById('bmiName');
    const bmiAge  = document.getElementById('bmiAge');
    const bmiGender = document.getElementById('bmiGender');
    const mealStudent = document.getElementById('mealStudent');
    if (bmiName) bmiName.value = prefillName;
    if (bmiAge && prefillAge) bmiAge.value = prefillAge;
    if (bmiGender && prefillGender) bmiGender.value = prefillGender;
    if (mealStudent) mealStudent.value = prefillName;
    localStorage.removeItem('prefill_name');
    localStorage.removeItem('prefill_age');
    localStorage.removeItem('prefill_gender');
  }

  try {
    const storedBmi = localStorage.getItem('nutriprint_last_bmi');
    if (storedBmi && !window.lastBMIResult) {
      window.lastBMIResult = JSON.parse(storedBmi);
      lastBMIResult = window.lastBMIResult;
    }
  } catch (_) {}
});
