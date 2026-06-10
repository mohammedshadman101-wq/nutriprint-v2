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
    })
  });

  if (!res.ok) {
    alert('Error calculating BMI. Please try again.');
    return;
  }

  const data = await res.json();
  lastBMIResult = data;
  showBMIResult(data);
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