/**
 * NutriPrint — Student Progress Tracker
 * Reads/writes from localStorage key: bmi_history_<studentName>
 * Schema per record:
 *   { date, bmi, classification, age, gender, percentile, z_score, weight_kg, height_cm, label? }
 */

'use strict';

/* ─── Constants ────────────────────────────────────────────────────────────── */
const PT_HISTORY_PREFIX = 'bmi_history_';
const PT_LABEL_KEY      = 'np_progress_labels';   // { "Name": ["Week 1","Week 4",...] }

const PT_COLORS = {
  underweight : '#3B82F6',
  normal      : '#10B981',
  overweight  : '#F97316',
  obese       : '#EF4444',
};

const PT_BADGE = {
  underweight : 'pt-badge--blue',
  normal      : 'pt-badge--green',
  overweight  : 'pt-badge--orange',
  obese       : 'pt-badge--red',
};

/* ─── Data helpers ─────────────────────────────────────────────────────────── */

function ptGetAllStudentNames() {
  const names = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PT_HISTORY_PREFIX)) {
      names.push(key.slice(PT_HISTORY_PREFIX.length));
    }
  }
  return names.sort();
}

function ptGetHistory(name) {
  try {
    return JSON.parse(localStorage.getItem(PT_HISTORY_PREFIX + name) || '[]');
  } catch (_) { return []; }
}

function ptSaveHistory(name, records) {
  localStorage.setItem(PT_HISTORY_PREFIX + name, JSON.stringify(records));
}

function ptGetLabels() {
  try { return JSON.parse(localStorage.getItem(PT_LABEL_KEY) || '{}'); }
  catch (_) { return {}; }
}

function ptSaveLabels(obj) {
  localStorage.setItem(PT_LABEL_KEY, JSON.stringify(obj));
}

/** Derive trend from ordered records array */
function ptGetTrend(records) {
  if (records.length < 2) return { icon: '➖', label: 'Only 1 Assessment', color: '#94A3B8', key: 'stable' };
  const first = records[0].bmi;
  const last  = records[records.length - 1].bmi;
  const delta = last - first;
  const pct   = ((Math.abs(delta) / first) * 100).toFixed(1);

  // "improving" means moving toward normal — depends on initial category
  const firstClass = records[0].classification;
  const improving  =
    (firstClass === 'underweight' && delta > 0) ||
    (firstClass === 'overweight'  && delta < 0) ||
    (firstClass === 'obese'       && delta < 0) ||
    (records[records.length - 1].classification === 'normal' &&
     records[0].classification !== 'normal');

  if (Math.abs(delta) < 0.3)
    return { icon: '➡️', label: 'Stable', color: '#64748B', key: 'stable', delta: 0, pct: '0.0' };
  if (improving)
    return { icon: '📈', label: 'Improving', color: '#10B981', key: 'improving', delta, pct };
  return   { icon: '📉', label: 'Needs Attention', color: '#F97316', key: 'declining', delta, pct };
}

/** Latest entry */
function ptLatest(records) {
  return records[records.length - 1];
}

/** BMI change from first → last */
function ptChange(records) {
  if (records.length < 2) return null;
  const d = ptLatest(records).bmi - records[0].bmi;
  return { value: d.toFixed(2), positive: d >= 0 };
}

/** Classify nutrition status text */
function ptStatusText(cls) {
  return {
    underweight : 'Underweight',
    normal      : 'Healthy Range',
    overweight  : 'Overweight',
    obese       : 'Obese',
  }[cls] || cls;
}

/* ─── Manual assessment entry ──────────────────────────────────────────────── */

function ptSaveManualEntry(event) {
  event.preventDefault();
  const nameEl   = document.getElementById('pt-input-name');
  const bmiEl    = document.getElementById('pt-input-bmi');
  const labelEl  = document.getElementById('pt-input-label');
  const dateEl   = document.getElementById('pt-input-date');
  const clsEl    = document.getElementById('pt-input-class');

  const name  = nameEl.value.trim();
  const bmi   = parseFloat(bmiEl.value);
  const label = labelEl.value.trim();
  const date  = dateEl.value || new Date().toLocaleDateString('en-IN');

  // Auto-classify if not set
  let cls = clsEl.value;
  if (!cls) {
    if (bmi < 14.5)       cls = 'underweight';
    else if (bmi < 18.5)  cls = 'normal';
    else if (bmi < 25)    cls = 'overweight';
    else                  cls = 'obese';
  }

  if (!name || isNaN(bmi)) {
    ptShowToast('Please enter a student name and BMI value.', 'warn');
    return;
  }

  const records = ptGetHistory(name);
  records.push({ date, bmi, classification: cls, label: label || null });
  ptSaveHistory(name, records);

  // Save label
  if (label) {
    const labels = ptGetLabels();
    if (!labels[name]) labels[name] = [];
    labels[name].push(label);
    ptSaveLabels(labels);
  }

  nameEl.value  = '';
  bmiEl.value   = '';
  labelEl.value = '';
  ptShowToast(`✅ Assessment saved for "${name}"`, 'success');
  ptRender();
}

/* ─── Delete helpers ───────────────────────────────────────────────────────── */

function ptDeleteStudent(name) {
  if (!confirm(`Remove ALL progress data for "${name}"? This cannot be undone.`)) return;
  localStorage.removeItem(PT_HISTORY_PREFIX + name);
  const labels = ptGetLabels();
  delete labels[name];
  ptSaveLabels(labels);
  ptRender();
}

function ptDeleteRecord(name, index) {
  const records = ptGetHistory(name);
  records.splice(index, 1);
  ptSaveHistory(name, records);
  ptRender();
}

/* ─── Chart rendering ──────────────────────────────────────────────────────── */

let ptChartInstances = {};

function ptDestroyChart(id) {
  if (ptChartInstances[id]) {
    ptChartInstances[id].destroy();
    delete ptChartInstances[id];
  }
}

function ptRenderMiniChart(canvasId, records) {
  ptDestroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || records.length < 2) return;
  const ctx = canvas.getContext('2d');

  const labels   = records.map((r, i) => r.label || r.date || `#${i + 1}`);
  const values   = records.map(r => r.bmi);
  const trend    = ptGetTrend(records);
  const ptColor  = trend.color;

  ptChartInstances[canvasId] = new Chart(ctx, {
    type : 'line',
    data : {
      labels,
      datasets: [{
        data                : values,
        borderColor         : ptColor,
        backgroundColor     : ptColor + '18',
        borderWidth         : 2.5,
        pointRadius         : 5,
        pointBackgroundColor: records.map(r => PT_COLORS[r.classification] || '#94A3B8'),
        pointBorderColor    : '#fff',
        pointBorderWidth    : 1.5,
        tension             : 0.4,
        fill                : true,
      }],
    },
    options: {
      responsive        : true,
      maintainAspectRatio: true,
      animation         : { duration: 600 },
      plugins: {
        legend : { display: false },
        tooltip: {
          callbacks: {
            title: (items) => labels[items[0].dataIndex],
            label: (item)  =>
              ` BMI ${item.raw} — ${ptStatusText(records[item.dataIndex].classification)}`,
          },
        },
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 30 }, grid: { display: false } },
        y: {
          min  : Math.max(8,  Math.floor(Math.min(...values)) - 1),
          max  : Math.ceil(Math.max(...values)) + 1,
          ticks: { font: { size: 10 } },
          title: { display: false },
        },
      },
    },
  });
}

/* ─── Card HTML builder ────────────────────────────────────────────────────── */

function ptBuildCard(name, records) {
  if (!records.length) return '';

  const trend   = ptGetTrend(records);
  const latest  = ptLatest(records);
  const change  = ptChange(records);
  const badgeCls = PT_BADGE[latest.classification] || '';

  /* History table rows */
  const rows = records.map((r, i) => `
    <tr class="pt-tr">
      <td class="pt-td pt-td--label">${r.label || '—'}</td>
      <td class="pt-td">${r.date}</td>
      <td class="pt-td pt-td--bmi">${r.bmi}</td>
      <td class="pt-td">
        <span class="pt-badge ${PT_BADGE[r.classification] || ''}">
          ${ptStatusText(r.classification)}
        </span>
      </td>
      <td class="pt-td pt-td--del">
        <button class="pt-del-btn" title="Remove this record"
          onclick="ptDeleteRecord('${name.replace(/'/g,"\\'")}', ${i})">✕</button>
      </td>
    </tr>`).join('');

  /* Trend progression pills */
  const pills = records.map((r, i) => {
    const arrow = i < records.length - 1 ? '<span class="pt-pill-arrow">→</span>' : '';
    return `<span class="pt-pill pt-pill--${r.classification}">${r.label || `#${i+1}`} · ${r.bmi}</span>${arrow}`;
  }).join('');

  /* Change badge */
  const changeHtml = change
    ? `<span class="pt-change ${change.positive ? 'pt-change--up' : 'pt-change--down'}">
         ${change.positive ? '▲' : '▼'} ${Math.abs(change.value)} BMI
       </span>`
    : '';

  const chartId = `pt-chart-${name.replace(/\W+/g, '_')}`;

  return `
<div class="pt-card" data-student="${name}">

  <!-- Card header -->
  <div class="pt-card-header">
    <div class="pt-card-avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="pt-card-meta">
      <div class="pt-card-name">${name}</div>
      <div class="pt-card-sub">${records.length} assessment${records.length !== 1 ? 's' : ''} recorded</div>
    </div>
    <div class="pt-card-header-right">
      <div class="pt-trend-badge" style="--trend-color:${trend.color}">
        <span>${trend.icon}</span>
        <span>${trend.label}</span>
      </div>
      <button class="pt-del-student-btn" title="Remove student"
        onclick="ptDeleteStudent('${name.replace(/'/g,"\\'")}')">🗑</button>
    </div>
  </div>

  <!-- KPI row -->
  <div class="pt-kpi-row">
    <div class="pt-kpi">
      <div class="pt-kpi-value">${latest.bmi}</div>
      <div class="pt-kpi-label">Latest BMI</div>
    </div>
    <div class="pt-kpi">
      <div class="pt-kpi-value">
        <span class="pt-badge ${badgeCls}">${ptStatusText(latest.classification)}</span>
      </div>
      <div class="pt-kpi-label">Current Status</div>
    </div>
    <div class="pt-kpi">
      <div class="pt-kpi-value">${change ? changeHtml : '<span class="pt-na">—</span>'}</div>
      <div class="pt-kpi-label">Total Change</div>
    </div>
    <div class="pt-kpi">
      <div class="pt-kpi-value pt-kpi-value--trend" style="color:${trend.color}">${trend.icon} ${trend.label}</div>
      <div class="pt-kpi-label">Progress Trend</div>
    </div>
  </div>

  <!-- Progression pills -->
  <div class="pt-pills-row" aria-label="BMI progression">
    ${pills}
  </div>

  <!-- Chart -->
  ${records.length >= 2 ? `
  <div class="pt-chart-wrap">
    <canvas id="${chartId}" height="110"></canvas>
  </div>` : `<p class="pt-chart-hint">Add a second assessment to see the trend chart.</p>`}

  <!-- History table -->
  <details class="pt-details">
    <summary class="pt-summary">📋 Assessment History</summary>
    <div class="pt-table-wrap">
      <table class="pt-table">
        <thead>
          <tr>
            <th class="pt-th">Label</th>
            <th class="pt-th">Date</th>
            <th class="pt-th">BMI</th>
            <th class="pt-th">Status</th>
            <th class="pt-th"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </details>

</div>`;
}

/* ─── Search / filter ──────────────────────────────────────────────────────── */

let ptSearchQuery = '';
let ptFilterTrend = 'all';

function ptSetSearch(val) {
  ptSearchQuery = val.toLowerCase();
  ptRenderCards();
}

function ptSetFilter(val) {
  ptFilterTrend = val;
  // Update button states
  document.querySelectorAll('.pt-filter-btn').forEach(b => {
    b.classList.toggle('pt-filter-btn--active', b.dataset.filter === val);
  });
  ptRenderCards();
}

/* ─── Summary stats bar ────────────────────────────────────────────────────── */

function ptRenderSummary(names) {
  const el = document.getElementById('pt-summary-bar');
  if (!el) return;

  let total = 0, improving = 0, stable = 0, declining = 0, healthy = 0;
  names.forEach(name => {
    const rec = ptGetHistory(name);
    if (!rec.length) return;
    total++;
    const t = ptGetTrend(rec);
    if (t.key === 'improving')  improving++;
    else if (t.key === 'stable') stable++;
    else                         declining++;
    if (ptLatest(rec).classification === 'normal') healthy++;
  });

  el.innerHTML = `
    <div class="pt-stat">
      <div class="pt-stat-value">${total}</div>
      <div class="pt-stat-label">Students Tracked</div>
    </div>
    <div class="pt-stat pt-stat--green">
      <div class="pt-stat-value">${improving}</div>
      <div class="pt-stat-label">Improving</div>
    </div>
    <div class="pt-stat pt-stat--blue">
      <div class="pt-stat-value">${healthy}</div>
      <div class="pt-stat-label">In Healthy Range</div>
    </div>
    <div class="pt-stat pt-stat--slate">
      <div class="pt-stat-value">${stable}</div>
      <div class="pt-stat-label">Stable</div>
    </div>
    <div class="pt-stat pt-stat--orange">
      <div class="pt-stat-value">${declining}</div>
      <div class="pt-stat-label">Needs Attention</div>
    </div>`;
}

/* ─── Main render ──────────────────────────────────────────────────────────── */

function ptRenderCards() {
  const container = document.getElementById('pt-cards-container');
  if (!container) return;

  const names    = ptGetAllStudentNames();
  const filtered = names.filter(name => {
    if (ptSearchQuery && !name.toLowerCase().includes(ptSearchQuery)) return false;
    if (ptFilterTrend !== 'all') {
      const rec = ptGetHistory(name);
      if (!rec.length) return false;
      const trend = ptGetTrend(rec);
      if (trend.key !== ptFilterTrend) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="pt-empty">
        <div class="pt-empty-icon">📋</div>
        <div class="pt-empty-title">
          ${names.length ? 'No students match your filter.' : 'No student progress data yet.'}
        </div>
        <div class="pt-empty-sub">
          ${names.length
            ? 'Try a different search or filter.'
            : 'Run a BMI assessment or add a manual entry above to start tracking progress.'}
        </div>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(name =>
    ptBuildCard(name, ptGetHistory(name))
  ).join('');

  // Render charts (after DOM is updated)
  requestAnimationFrame(() => {
    filtered.forEach(name => {
      const records  = ptGetHistory(name);
      const chartId  = `pt-chart-${name.replace(/\W+/g, '_')}`;
      ptRenderMiniChart(chartId, records);
    });
  });
}

function ptRender() {
  const names = ptGetAllStudentNames();
  ptRenderSummary(names);
  ptRenderCards();
}

/* ─── Export CSV ───────────────────────────────────────────────────────────── */

function ptExportCSV() {
  const names = ptGetAllStudentNames();
  if (!names.length) {
    ptShowToast('No progress data to export.', 'warn');
    return;
  }
  const rows = [['Student', 'Label', 'Date', 'BMI', 'Classification', 'Change from First']];
  names.forEach(name => {
    const records = ptGetHistory(name);
    records.forEach((r, i) => {
      const chg = i === 0 ? '—' : (r.bmi - records[0].bmi).toFixed(2);
      rows.push([name, r.label || '', r.date, r.bmi, r.classification, chg]);
    });
  });
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'nutriprint_progress.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Toast ────────────────────────────────────────────────────────────────── */

function ptShowToast(msg, type = 'success') {
  const colors = { success: '#1D9E75', warn: '#F97316', error: '#EF4444' };
  const icons  = { success: '✅', warn: '⚠️', error: '❌' };
  const toast  = document.createElement('div');
  toast.className = 'pt-toast';
  toast.style.cssText = `border-left:4px solid ${colors[type]}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('pt-toast--in'));
  setTimeout(() => {
    toast.classList.remove('pt-toast--in');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/* ─── Init ─────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Set today's date as default for manual entry
  const dateEl = document.getElementById('pt-input-date');
  if (dateEl) dateEl.value = new Date().toLocaleDateString('en-IN');

  ptRender();
});

// Re-export so BMI page can call after a new assessment
window.ptRender = ptRender;
