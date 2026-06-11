let lastBMIResult = null;

async function calculateBMI() {
  const name   = document.getElementById('bmiName').value.trim();
  const age    = document.getElementById('bmiAge').value;
  const gender = document.getElementById('bmiGender').value;
  const height = document.getElementById('bmiHeight').value;
  const weight = document.getElementById('bmiWeight').value;

  if (!name || !age || !height || !weight) {
    alert('Please fill all fields / ದಯವಿಟ್ಟು ಎಲ್ಲಾ ಅಂಕಣಗಳನ್ನು ತುಂಬಿಸಿ');
    return;
  }

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
    alert('Error calculating BMI. Please try again.');
    return;
  }

  const data = await res.json();
  
  lastBMIResult = data;
  window.lastBMIResult = data;
  
  showBMIResult(data);
  showGrowthChart(data.student_name);
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

  // Scroll to result
  document.getElementById('bmiResult').scrollIntoView({behavior:'smooth', block:'center'});
}

function prefillMealForm() {
  if (!lastBMIResult) return;
  document.getElementById('mealStudent').value = lastBMIResult.student_name;
  document.querySelector('#meal').scrollIntoView({behavior:'smooth'});
}

// Voice input
function startVoice(fieldId) {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('Voice input not supported on this browser');
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
