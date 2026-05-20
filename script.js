/* ============================================================
   Finlytics — Expense Tracker with Analytics
   Vanilla JS · LocalStorage · Chart.js
============================================================ */

// ---------- State ----------
const STORE_KEY = 'finlytics:v1';
const CATEGORIES = ['Food','Transport','Bills','Entertainment','Education','Shopping','Healthcare','Miscellaneous'];

const state = {
  transactions: [],
  budget: 0,
  categoryBudgets: {},
  settings: { theme: 'dark', accent: '#6366f1', currency: '$' },
};

let charts = {}; // chart instances

// ---------- Storage ----------
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) { console.warn('Load failed', e); }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// ---------- Utilities ----------
const fmt = (n) => `${state.settings.currency}${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const todayStr = () => new Date().toISOString().slice(0,10);
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(100%)'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

function showLoader(ms=300) {
  const l = $('#loader'); l.classList.add('show');
  setTimeout(() => l.classList.remove('show'), ms);
}

// ---------- Routing ----------
function navigate(section) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${section}`)?.classList.add('active');
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.section === section));
  $('#sidebar').classList.remove('open');
  // refresh data for that view
  renderView(section);
}

function renderView(section) {
  if (section === 'dashboard') renderDashboard();
  if (section === 'transactions') renderTransactions();
  if (section === 'analytics') renderAnalytics();
  if (section === 'budget') renderBudget();
  if (section === 'reports') renderReports();
}

// ---------- Form ----------
function resetForm() {
  $('#txForm').reset();
  $('#txId').value = '';
  $('#date').value = todayStr();
  $('#formTitle').textContent = 'Add Transaction';
  $('#submitBtn').textContent = 'Save Transaction';
}

function editTx(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  $('#txId').value = t.id;
  $('#title').value = t.title;
  $('#amount').value = t.amount;
  $('#category').value = t.category;
  $('#date').value = t.date;
  $('#notes').value = t.notes || '';
  $$('input[name=type]').forEach(r => r.checked = r.value === t.type);
  $('#formTitle').textContent = 'Edit Transaction';
  $('#submitBtn').textContent = 'Update Transaction';
  navigate('add');
}

function deleteTx(id) {
  if (!confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  save();
  toast('Transaction deleted', 'success');
  renderView('transactions');
  renderDashboard();
}

function handleSubmit(e) {
  e.preventDefault();
  const id = $('#txId').value;
  const title = $('#title').value.trim();
  const amount = parseFloat($('#amount').value);
  const category = $('#category').value;
  const date = $('#date').value;
  const notes = $('#notes').value.trim();
  const type = $$('input[name=type]').find(r => r.checked)?.value || 'expense';

  // Validation
  if (!title) return toast('Title is required', 'error');
  if (!amount || amount <= 0 || isNaN(amount)) return toast('Amount must be greater than zero', 'error');
  if (!category) return toast('Please select a category', 'error');
  if (!date) return toast('Date is required', 'error');

  const tx = { id: id || uid(), title, amount, category, date, notes, type, createdAt: Date.now() };

  if (id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    state.transactions[idx] = tx;
    toast('Transaction updated', 'success');
  } else {
    state.transactions.unshift(tx);
    toast('Transaction added', 'success');
    checkBudgetWarning();
  }
  save();
  resetForm();
  navigate('dashboard');
}

function checkBudgetWarning() {
  if (!state.budget) return;
  const spent = monthExpense(new Date());
  if (spent > state.budget) toast('⚠️ Monthly budget exceeded!', 'error');
  else if (spent > state.budget * 0.85) toast('Approaching budget limit', 'warn');
}

// ---------- Calculations ----------
function totals(list = state.transactions) {
  const income = list.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const expense = list.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}
function monthExpense(d=new Date()) {
  const y=d.getFullYear(), m=d.getMonth();
  return state.transactions
    .filter(t => t.type==='expense' && (() => { const td=new Date(t.date); return td.getFullYear()===y && td.getMonth()===m; })())
    .reduce((s,t)=>s+t.amount,0);
}
function byCategory(list = state.transactions) {
  const map = {};
  list.filter(t=>t.type==='expense').forEach(t => map[t.category] = (map[t.category]||0) + t.amount);
  return map;
}
function inRange(date, range) {
  const d = new Date(date), now = new Date();
  if (range === 'day') return d.toDateString() === now.toDateString();
  if (range === 'week') { const diff = (now - d)/(1000*60*60*24); return diff >= 0 && diff < 7; }
  if (range === 'month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  if (range === 'year') return d.getFullYear()===now.getFullYear();
  return true;
}

// ---------- Counter animation ----------
function animateCounter(el, target) {
  const prefix = el.dataset.prefix || '';
  const start = parseFloat(el.dataset.counter || 0);
  const dur = 700, t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    const val = start + (target - start) * (1 - Math.pow(1 - p, 3));
    el.textContent = prefix + val.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    if (p < 1) requestAnimationFrame(step);
    else el.dataset.counter = target;
  }
  requestAnimationFrame(step);
}

// ---------- Dashboard ----------
function renderDashboard() {
  const { income, expense, balance } = totals();
  const counters = $$('.counter');
  counters[0] && animateCounter(counters[0], income);
  counters[1] && animateCounter(counters[1], expense);
  counters[2] && animateCounter(counters[2], balance);

  // Budget summary
  const spent = monthExpense();
  $('#budgetSummary').textContent = `${fmt(spent)} / ${fmt(state.budget)}`;
  const pct = state.budget ? Math.min(100, (spent / state.budget) * 100) : 0;
  const bar = $('#budgetBar');
  bar.style.width = pct + '%';
  bar.className = 'progress-bar' + (pct>=100?' danger':pct>=85?' warn':'');

  // Recent
  const tbody = $('#recentTable tbody');
  tbody.innerHTML = '';
  state.transactions.slice(0,5).forEach(t => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${escapeHtml(t.title)}</td>
        <td><span class="chip">${t.category}</span></td>
        <td>${t.date}</td>
        <td class="${t.type==='income'?'amount-pos':'amount-neg'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</td>
      </tr>`);
  });
  if (!state.transactions.length) tbody.innerHTML = `<tr><td colspan="4" class="empty">No transactions yet.</td></tr>`;

  renderDashCharts();
}

function renderDashCharts() {
  const cats = byCategory();
  destroyChart('dashPie');
  charts.dashPie = new Chart($('#dashPieChart'), {
    type: 'doughnut',
    data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: palette(Object.keys(cats).length), borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels:{color:cssVar('--text')} } }, cutout: '65%' }
  });

  // 30-day spend
  const days = [...Array(30)].map((_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (29-i));
    return d.toISOString().slice(0,10);
  });
  const dayTotals = days.map(d => state.transactions.filter(t=>t.type==='expense'&&t.date===d).reduce((s,t)=>s+t.amount,0));
  destroyChart('dashLine');
  charts.dashLine = new Chart($('#dashLineChart'), {
    type: 'line',
    data: { labels: days.map(d=>d.slice(5)), datasets: [{
      label: 'Spent', data: dayTotals, borderColor: cssVar('--accent'),
      backgroundColor: 'rgba(99,102,241,.15)', fill: true, tension: .35, pointRadius: 0
    }] },
    options: chartOpts()
  });
}

// ---------- Transactions ----------
function populateCategoryFilters() {
  const sel = $('#filterCategory');
  sel.innerHTML = '<option value="">All categories</option>' + CATEGORIES.map(c=>`<option>${c}</option>`).join('');
}

function getFiltered() {
  const q = $('#searchInput').value.toLowerCase().trim();
  const cat = $('#filterCategory').value;
  const type = $('#filterType').value;
  const from = $('#filterFrom').value;
  const to = $('#filterTo').value;
  const min = parseFloat($('#filterMin').value) || 0;
  const max = parseFloat($('#filterMax').value) || Infinity;

  return state.transactions.filter(t => {
    if (q && !(t.title.toLowerCase().includes(q) || (t.notes||'').toLowerCase().includes(q))) return false;
    if (cat && t.category !== cat) return false;
    if (type && t.type !== type) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (t.amount < min || t.amount > max) return false;
    return true;
  });
}

function renderTransactions() {
  const list = getFiltered();
  const tbody = $('#txTable tbody');
  tbody.innerHTML = '';
  $('#emptyState').hidden = list.length > 0;
  list.forEach(t => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>
          <div><strong>${escapeHtml(t.title)}</strong></div>
          ${t.notes ? `<div class="muted small">${escapeHtml(t.notes)}</div>`:''}
        </td>
        <td><span class="chip">${t.category}</span></td>
        <td><span class="chip">${t.type}</span></td>
        <td>${t.date}</td>
        <td class="${t.type==='income'?'amount-pos':'amount-neg'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</td>
        <td>
          <button class="btn ghost tiny" onclick="editTx('${t.id}')">Edit</button>
          <button class="btn danger tiny" onclick="deleteTx('${t.id}')">Delete</button>
        </td>
      </tr>`);
  });
}

// ---------- Analytics ----------
function renderAnalytics() {
  const range = $('#analyticsRange').value;
  const list = state.transactions.filter(t => inRange(t.date, range));
  const { income, expense, balance } = totals(list);
  $('#aIncome').textContent = fmt(income);
  $('#aExpense').textContent = fmt(expense);
  $('#aBalance').textContent = fmt(balance);
  const cats = byCategory(list);
  const top = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  $('#aTopCat').textContent = top ? `${top[0]} · ${fmt(top[1])}` : '—';

  destroyChart('pie');
  charts.pie = new Chart($('#pieChart'), {
    type: 'pie',
    data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: palette(Object.keys(cats).length), borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels:{color:cssVar('--text')} } } }
  });

  destroyChart('bar');
  charts.bar = new Chart($('#barChart'), {
    type: 'bar',
    data: { labels:['Income','Expense'], datasets:[{
      data:[income, expense], backgroundColor:[cssVar('--success'), cssVar('--danger')], borderRadius:8
    }] },
    options: { ...chartOpts(), plugins:{legend:{display:false}} }
  });

  // Trend: monthly across year
  const months = [...Array(12)].map((_,i)=>i);
  const now = new Date();
  const monthly = months.map(m => state.transactions
    .filter(t => { const d=new Date(t.date); return d.getFullYear()===now.getFullYear() && d.getMonth()===m && t.type==='expense'; })
    .reduce((s,t)=>s+t.amount,0));
  destroyChart('line');
  charts.line = new Chart($('#lineChart'), {
    type: 'line',
    data: { labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      datasets: [{ label:'Expense', data:monthly, borderColor:cssVar('--accent'),
        backgroundColor:'rgba(99,102,241,.15)', fill:true, tension:.35 }] },
    options: chartOpts()
  });

  // Percentages
  const total = Object.values(cats).reduce((a,b)=>a+b,0) || 1;
  $('#catPercents').innerHTML = CATEGORIES.map(c => {
    const v = cats[c] || 0;
    const pct = ((v/total)*100).toFixed(1);
    return `<div class="cat-percent">
      <div class="row-between"><span>${c}</span><strong>${pct}%</strong></div>
      <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      <p class="muted small" style="margin-top:6px">${fmt(v)}</p>
    </div>`;
  }).join('');
}

// ---------- Budget ----------
function renderBudget() {
  $('#budgetInput').value = state.budget || '';
  const spent = monthExpense();
  const remain = (state.budget||0) - spent;
  $('#bSpent').textContent = fmt(spent);
  $('#bRemain').textContent = fmt(remain);
  const pct = state.budget ? Math.min(100, (spent/state.budget)*100) : 0;
  const bar = $('#bBar'); bar.style.width = pct + '%';
  bar.className = 'progress-bar' + (pct>=100?' danger':pct>=85?' warn':'');
  $('#bMsg').textContent = !state.budget ? 'Set a budget to start tracking.' :
    pct>=100 ? '⚠️ You have exceeded your monthly budget.' :
    pct>=85 ? 'You are approaching your budget limit.' : 'On track. Keep it up!';

  // per-category
  const cats = byCategory();
  $('#catBudgets').innerHTML = CATEGORIES.map(c => {
    const used = cats[c] || 0;
    const cap = state.categoryBudgets[c] || 0;
    const p = cap ? Math.min(100, (used/cap)*100) : 0;
    return `<div class="cat-row">
      <span>${c}</span>
      <div>
        <div class="progress"><div class="progress-bar ${p>=100?'danger':p>=85?'warn':''}" style="width:${p}%"></div></div>
        <p class="muted small" style="margin-top:4px">${fmt(used)} of ${cap?fmt(cap):'—'}</p>
      </div>
      <input type="number" min="0" step="0.01" placeholder="Cap" value="${cap||''}" data-cat="${c}" class="cat-budget-input" />
    </div>`;
  }).join('');
  $$('.cat-budget-input').forEach(inp => inp.addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (v < 0) { e.target.value=''; return toast('No negative values', 'error'); }
    state.categoryBudgets[e.target.dataset.cat] = v || 0;
    save(); renderBudget(); toast('Category budget updated','success');
  }));
}

// ---------- Reports ----------
function renderReports() {
  $('#rDay').textContent = fmt(state.transactions.filter(t=>t.type==='expense'&&inRange(t.date,'day')).reduce((s,t)=>s+t.amount,0));
  $('#rWeek').textContent = fmt(state.transactions.filter(t=>t.type==='expense'&&inRange(t.date,'week')).reduce((s,t)=>s+t.amount,0));
  $('#rMonth').textContent = fmt(monthExpense());
  $('#rYear').textContent = fmt(state.transactions.filter(t=>t.type==='expense'&&inRange(t.date,'year')).reduce((s,t)=>s+t.amount,0));

  // monthly chart
  const now = new Date();
  const monthly = [...Array(12)].map((_,m) => state.transactions
    .filter(t=>{const d=new Date(t.date);return d.getFullYear()===now.getFullYear()&&d.getMonth()===m&&t.type==='expense';})
    .reduce((s,t)=>s+t.amount,0));
  const income = [...Array(12)].map((_,m) => state.transactions
    .filter(t=>{const d=new Date(t.date);return d.getFullYear()===now.getFullYear()&&d.getMonth()===m&&t.type==='income';})
    .reduce((s,t)=>s+t.amount,0));
  destroyChart('report');
  charts.report = new Chart($('#reportChart'), {
    type:'bar',
    data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      datasets:[
        { label:'Income', data:income, backgroundColor:cssVar('--success'), borderRadius:6 },
        { label:'Expense', data:monthly, backgroundColor:cssVar('--danger'), borderRadius:6 }
      ]},
    options: chartOpts(true)
  });

  // history
  const tbody = $('#historyTable tbody');
  tbody.innerHTML = state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`
    <tr>
      <td>${t.date}</td>
      <td>${escapeHtml(t.title)}</td>
      <td><span class="chip">${t.category}</span></td>
      <td>${t.type}</td>
      <td class="${t.type==='income'?'amount-pos':'amount-neg'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty">No data.</td></tr>`;
}

// ---------- Export ----------
function exportCSV(list = state.transactions, filename='transactions.csv') {
  const header = ['Date','Title','Category','Type','Amount','Notes'];
  const rows = list.map(t => [t.date,t.title,t.category,t.type,t.amount,(t.notes||'').replace(/"/g,'""')]);
  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  downloadBlob(csv, filename, 'text/csv');
  toast('CSV exported', 'success');
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { income, expense, balance } = totals();
  doc.setFontSize(20); doc.text('Finlytics Report', 14, 20);
  doc.setFontSize(11); doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.setTextColor(0); doc.setFontSize(12);
  doc.text(`Total Income:  ${fmt(income)}`, 14, 42);
  doc.text(`Total Expense: ${fmt(expense)}`, 14, 50);
  doc.text(`Balance:       ${fmt(balance)}`, 14, 58);
  doc.text(`Monthly Budget: ${fmt(state.budget)}  ·  Spent: ${fmt(monthExpense())}`, 14, 66);

  doc.setFontSize(13); doc.text('Transactions', 14, 80);
  doc.setFontSize(10);
  let y = 88;
  doc.text('Date', 14, y); doc.text('Title', 44, y); doc.text('Category', 100, y); doc.text('Type', 140, y); doc.text('Amount', 170, y);
  y += 4; doc.line(14, y, 196, y); y += 6;
  state.transactions.slice(0, 35).forEach(t => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(String(t.date), 14, y);
    doc.text(String(t.title).slice(0,28), 44, y);
    doc.text(String(t.category), 100, y);
    doc.text(String(t.type), 140, y);
    doc.text(`${t.type==='income'?'+':'-'}${fmt(t.amount)}`, 170, y);
    y += 7;
  });
  doc.save('finlytics-report.pdf');
  toast('PDF exported', 'success');
}

function downloadBlob(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Settings ----------
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  document.documentElement.style.setProperty('--accent', state.settings.accent);
  // re-render charts to update colors
  Object.keys(charts).forEach(k => destroyChart(k));
  const active = $('.view.active')?.id.replace('view-','');
  if (active) renderView(active);
}

// ---------- Helpers ----------
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function chartOpts(legend=false) {
  return {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { display: legend, labels: { color: cssVar('--text') } } },
    scales: {
      x: { ticks:{color:cssVar('--muted')}, grid:{color:'rgba(255,255,255,.04)'} },
      y: { ticks:{color:cssVar('--muted')}, grid:{color:'rgba(255,255,255,.04)'} }
    }
  };
}
function palette(n) {
  const base = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316','#a855f7'];
  return Array.from({length:n}, (_,i)=>base[i%base.length]);
}
function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Init ----------
function init() {
  load();
  applyTheme();
  $('#date').value = todayStr();
  populateCategoryFilters();

  // navigation
  $$('.nav-link').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.section); }));
  $$('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.go); }));

  // form
  $('#txForm').addEventListener('submit', handleSubmit);
  $('#resetForm').addEventListener('click', resetForm);

  // filters
  ['searchInput','filterCategory','filterType','filterFrom','filterTo','filterMin','filterMax']
    .forEach(id => $('#'+id).addEventListener('input', renderTransactions));
  $('#clearFilters').addEventListener('click', () => {
    ['searchInput','filterCategory','filterType','filterFrom','filterTo','filterMin','filterMax'].forEach(id => $('#'+id).value = '');
    renderTransactions();
  });
  $('#globalSearch').addEventListener('input', e => {
    $('#searchInput').value = e.target.value;
    navigate('transactions');
  });

  // analytics
  $('#analyticsRange').addEventListener('change', renderAnalytics);

  // budget
  $('#budgetForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = parseFloat($('#budgetInput').value);
    if (isNaN(v) || v < 0) return toast('Enter a valid non-negative budget', 'error');
    state.budget = v; save(); renderBudget(); renderDashboard();
    toast('Budget saved', 'success');
  });

  // exports
  $('#exportCsv').addEventListener('click', () => exportCSV(getFiltered()));
  $('#exportPdf').addEventListener('click', exportPDF);
  $('#reportCsv').addEventListener('click', () => exportCSV(state.transactions, 'report.csv'));
  $('#reportPdf').addEventListener('click', exportPDF);

  // settings
  $('#themeSelect').value = state.settings.theme;
  $('#currencySelect').value = state.settings.currency;
  $('#themeSelect').addEventListener('change', e => { state.settings.theme = e.target.value; save(); applyTheme(); });
  $('#currencySelect').addEventListener('change', e => { state.settings.currency = e.target.value; save(); renderView($('.view.active').id.replace('view-','')); });
  $('#themeToggle').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    $('#themeSelect').value = state.settings.theme;
    save(); applyTheme();
  });
  $$('#swatches button').forEach(b => {
    if (b.dataset.c === state.settings.accent) b.classList.add('active');
    b.addEventListener('click', () => {
      $$('#swatches button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      state.settings.accent = b.dataset.c;
      save(); applyTheme();
    });
  });

  // data ops
  $('#exportJson').addEventListener('click', () => {
    downloadBlob(JSON.stringify(state, null, 2), 'finlytics-data.json', 'application/json');
    toast('Data exported', 'success');
  });
  $('#importJson').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.assign(state, data); save(); applyTheme();
        toast('Data imported', 'success'); navigate('dashboard');
      } catch { toast('Invalid file', 'error'); }
    };
    r.readAsText(file);
  });
  $('#clearAll').addEventListener('click', () => {
    if (confirm('Clear ALL data? This cannot be undone.')) {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }
  });

  // sidebar
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // expose for inline handlers
  window.editTx = editTx;
  window.deleteTx = deleteTx;

  showLoader(400);
  renderDashboard();
}

document.addEventListener('DOMContentLoaded', init);
