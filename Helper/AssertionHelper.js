const fs = require('fs');
const path = require('path');

class AssertionHelper {
    constructor() {
        this.results = [];
        this.exportDir = path.join(process.cwd(), 'playwright-report');
        if (!fs.existsSync(this.exportDir)) fs.mkdirSync(this.exportDir, { recursive: true });
    }

    _escInline(str) {
        if (str === undefined || str === null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _lastNonEmptyLines(text, count = 3) {
        const lines = String(text || '')
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);
        return lines.slice(-count);
    }

    /**
     * Logs an assertion result AND pushes it as a monocart annotation on the current test.
     * Call this from within any test or page object.
     *
     * @param {string} stepName   - e.g. "Login Check: Correct Credentials"
     * @param {string} actual     - The actual result / outcome
     * @param {string} expected   - The expected result
     * @param {string} status     - "PASS" or "FAIL"
     * @param {string} comments   - Optional extra detail
     * @param {object} testInfo   - Pass `test.info()` to annotate the monocart row (optional)
     */
    log(stepName, actual, expected, status, comments = '', testInfo = null) {
        const entry = {
            id: this.results.length + 1,
            step: stepName,
            actual,
            expected,
            status: status.toUpperCase(),
            comments,
            timestamp: new Date().toLocaleTimeString()
        };
        this.results.push(entry);

        // ✅ Push structured annotation so monocart can display it
        if (testInfo) {
            testInfo.annotations.push({
                type: status.toUpperCase() === 'PASS' ? '✅ PASS' : '❌ FAIL',
                description: `[${stepName}] Expected: "${expected}" | Actual: "${actual}"${comments ? ` | ${comments}` : ''}`
            });
        }
    }

    /**
     * Attaches a formatted HTML step-summary to the monocart detail panel.
     * Shows as a clickable "📋 Step Summary" attachment that opens a clean table.
     *
     * @param {string}  title    - Heading e.g. "Login Scenarios"
     * @param {Array}   checks   - Array of { name, expected, actual, pass, detail }
     * @param {object}  testInfo - test.info()
     */
    async attachStepSummary(title, checks, testInfo) {
        const totalPass = checks.filter(c => c.pass).length;
        const totalFail = checks.filter(c => !c.pass).length;

        const rows = checks.map(c => {
            const fallbackExpected = this._lastNonEmptyLines(c.actual, 3)
                .map(l => this._escInline(l))
                .join('<br/>');
            const isIdCapturedRow = /ID Captured|🎯 ID Captured/i.test(c.actual || '');
            const expectedLooksLikeCapturedLabel = typeof c.expected === 'string'
                && c.expected.toLowerCase().includes('captureddeviceid');
            const expectedCell = (!c.expected || (isIdCapturedRow && expectedLooksLikeCapturedLabel))
                ? fallbackExpected
                : c.expected;
            return `
        <tr>
            <td>${c.name}</td>
            <td>${expectedCell}</td>
            <td>${c.actual}</td>
            <td>${c.detail || '-'}</td>
            <td class="${c.pass ? 'pass' : 'fail'}">${c.pass ? '✅ PASS' : '❌ FAIL'}</td>
        </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#f8fafc;color:#1e293b}
  h2{margin:0 0 6px 0;font-size:1.1rem;color:#0f172a}
  .summary{display:flex;gap:12px;margin-bottom:16px}
  .badge{padding:4px 14px;border-radius:20px;font-size:.82rem;font-weight:700}
  .badge.pass{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
  .badge.fail{background:#fee2e2;color:#dc2626;border:1px solid #fecaca}
  .badge.total{background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd}
  table{width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:.78rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0}
  td{padding:10px 14px;font-size:.85rem;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#f8fafc}
  td.pass{font-weight:700;color:#16a34a}
  td.fail{font-weight:700;color:#dc2626}
</style>
</head><body>
  <h2>${title}</h2>
  <div class="summary">
    <span class="badge total">Total: ${checks.length}</span>
    <span class="badge pass">✅ ${totalPass} Passed</span>
    ${totalFail > 0 ? `<span class="badge fail">❌ ${totalFail} Failed</span>` : ''}
  </div>
  <table>
    <thead><tr><th>Check</th><th>Expected</th><th>Actual</th><th>Details</th><th>Result</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

        const fileName = `step-summary-${Date.now()}.html`;
        const filePath = require('path').join(this.exportDir, fileName);
        require('fs').writeFileSync(filePath, html);

        await testInfo.attach('📋 Step Summary', { path: filePath, contentType: 'text/html' });

        // One-line annotation for the table column
        testInfo.annotations.push({
            type: totalFail > 0 ? '❌ FAIL' : '✅ PASS',
            description: `${title} — ${totalPass} Passed${totalFail > 0 ? ', ' + totalFail + ' Failed' : ''} | see 📋 Step Summary attachment`
        });
    }

    /**
     * Generates a standalone HTML Assertion Dashboard.
     */
    generateDashboard(fileName = 'Detailed_Assertion_Report.html') {
        const passed  = this.results.filter(r => r.status === 'PASS').length;
        const failed  = this.results.filter(r => r.status === 'FAIL').length;
        const total   = this.results.length;
        const passRate = Math.round((passed / (total || 1)) * 100);

        const rows = this.results.map(r => `
        <tr class="${r.status === 'FAIL' ? 'row-fail' : ''}">
            <td class="center">${r.id}</td>
            <td><b>${this._esc(r.step)}</b><br><span class="ts">${r.timestamp}</span></td>
            <td>${this._esc(r.expected)}</td>
            <td>${this._esc(r.actual)}</td>
            <td class="center"><span class="badge ${r.status === 'PASS' ? 'badge-pass' : 'badge-fail'}">${r.status}</span></td>
            <td class="comment">${this._esc(r.comments)}</td>
        </tr>`).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Assertion Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root {
    --pass: #16a34a; --pass-bg: #dcfce7;
    --fail: #dc2626; --fail-bg: #fee2e2;
    --card: #ffffff; --bg: #f1f5f9;
    --border: #e2e8f0; --text: #1e293b; --muted: #64748b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
  .container { max-width: 1400px; margin: 0 auto; }

  /* Header */
  .page-header { text-align: center; margin-bottom: 28px; }
  .page-header h1 { font-size: 1.8rem; font-weight: 700; color: #0f172a; }
  .page-header p  { color: var(--muted); margin-top: 4px; font-size: 0.95rem; }

  /* Stat Cards */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: var(--card); border-radius: 12px; padding: 20px 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 5px solid var(--border); }
  .stat-card.total  { border-color: #6366f1; }
  .stat-card.pass   { border-color: var(--pass); }
  .stat-card.fail   { border-color: var(--fail); }
  .stat-card.rate   { border-color: #f59e0b; }
  .stat-val { font-size: 2.2rem; font-weight: 800; line-height: 1; margin-bottom: 4px; }
  .stat-card.total .stat-val { color: #6366f1; }
  .stat-card.pass  .stat-val { color: var(--pass); }
  .stat-card.fail  .stat-val { color: var(--fail); }
  .stat-card.rate  .stat-val { color: #f59e0b; }
  .stat-lbl { font-size: 0.78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 600; }

  /* Chart + Table Card */
  .card { background: var(--card); border-radius: 12px; padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 24px; }
  .card-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; color: #0f172a; }

  /* Chart */
  .chart-wrap { display: flex; justify-content: center; margin-bottom: 24px; }
  .chart-wrap canvas { max-width: 320px; max-height: 220px; }

  /* Filter bar */
  .filter-bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .filter-bar input {
    flex: 1; min-width: 200px; padding: 8px 12px;
    border: 1px solid var(--border); border-radius: 8px;
    font-size: 0.9rem; outline: none;
  }
  .filter-bar input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
  .filter-btn { padding: 8px 16px; border: 1px solid var(--border); border-radius: 8px;
    cursor: pointer; font-size: 0.85rem; font-weight: 600; background: var(--card);
    transition: all .15s; }
  .filter-btn:hover { background: #f8fafc; }
  .filter-btn.active-pass { background: var(--pass-bg); border-color: var(--pass); color: var(--pass); }
  .filter-btn.active-fail { background: var(--fail-bg); border-color: var(--fail); color: var(--fail); }

  /* Table */
  .tbl-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  thead tr { background: #f8fafc; }
  th { padding: 11px 14px; font-weight: 700; color: var(--muted); text-align: left;
    border-bottom: 2px solid var(--border); white-space: nowrap; font-size: 0.78rem;
    text-transform: uppercase; letter-spacing: .06em; }
  td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr.row-fail td { background: #fff8f8; }
  tr:not(.row-fail):hover td { background: #f8fafc; }
  .center { text-align: center; }
  .ts { font-size: 0.75rem; color: var(--muted); margin-top: 2px; display: block; }
  .comment { color: var(--muted); font-style: italic; font-size: 0.82rem; }

  /* Badges */
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 0.75rem; font-weight: 700; letter-spacing: .04em; }
  .badge-pass { background: var(--pass-bg); color: var(--pass); }
  .badge-fail { background: var(--fail-bg); color: var(--fail); }

  /* Progress bar */
  .progress-bar { height: 6px; background: #e2e8f0; border-radius: 99px; margin-top: 12px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, var(--pass) ${passRate}%, var(--fail) ${passRate}%); }

  .no-results { text-align: center; padding: 40px; color: var(--muted); font-style: italic; }
</style>
</head>
<body>
<div class="container">

  <div class="page-header">
    <h1>📝 Weld Automation — Assertion Report</h1>
    <p>Detailed step-by-step pass/fail results for every assertion in the test run</p>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>

  <div class="stats">
    <div class="stat-card total">
      <div class="stat-val">${total}</div>
      <div class="stat-lbl">Total Assertions</div>
    </div>
    <div class="stat-card pass">
      <div class="stat-val">${passed}</div>
      <div class="stat-lbl">Passed</div>
    </div>
    <div class="stat-card fail">
      <div class="stat-val">${failed}</div>
      <div class="stat-lbl">Failed</div>
    </div>
    <div class="stat-card rate">
      <div class="stat-val">${passRate}%</div>
      <div class="stat-lbl">Pass Rate</div>
    </div>
  </div>

  <div class="card">
    <div class="chart-wrap">
      <canvas id="pieChart"></canvas>
    </div>

    <div class="filter-bar">
      <input type="text" id="searchBox" placeholder="🔍  Search by step name, actual, expected..." oninput="filterTable()">
      <button class="filter-btn" id="btnAll"  onclick="setFilter('all')" >All</button>
      <button class="filter-btn" id="btnPass" onclick="setFilter('pass')">✅ Pass</button>
      <button class="filter-btn" id="btnFail" onclick="setFilter('fail')">❌ Fail</button>
    </div>

    <div class="tbl-wrap">
      <table id="assertTable">
        <thead>
          <tr>
            <th class="center" style="width:4%">#</th>
            <th style="width:24%">Step / Context</th>
            <th style="width:22%">Expected</th>
            <th style="width:22%">Actual (Outcome)</th>
            <th class="center" style="width:8%">Status</th>
            <th style="width:20%">Details</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          ${rows}
        </tbody>
      </table>
      <div class="no-results" id="noResults" style="display:none">No matching results found.</div>
    </div>
  </div>

</div>

<script>
  // Chart
  const ctx = document.getElementById('pieChart');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Passed (${passed})', 'Failed (${failed})'],
      datasets: [{ data: [${passed}, ${failed}], backgroundColor: ['#16a34a','#dc2626'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } }
      }
    }
  });

  // Filter
  let currentFilter = 'all';

  function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.filter-btn').forEach(b => b.className = 'filter-btn');
    if (f === 'pass') document.getElementById('btnPass').classList.add('active-pass');
    else if (f === 'fail') document.getElementById('btnFail').classList.add('active-fail');
    else document.getElementById('btnAll').style.background = '#f1f5f9';
    filterTable();
  }

  function filterTable() {
    const q = document.getElementById('searchBox').value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody tr');
    let visible = 0;
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const isPass = row.classList.contains('row-fail') === false;
      const matchFilter = currentFilter === 'all'
        || (currentFilter === 'pass' && isPass)
        || (currentFilter === 'fail' && !isPass);
      const matchSearch = !q || text.includes(q);
      const show = matchFilter && matchSearch;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    document.getElementById('noResults').style.display = visible === 0 ? 'block' : 'none';
  }

  setFilter('all');
</script>
</body>
</html>`;

        const finalPath = path.join(this.exportDir, fileName);
        fs.writeFileSync(finalPath, html);
        console.log(`\n📊 Assertion Dashboard → ${finalPath}`);
        return finalPath;
    }

    _esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

module.exports = new AssertionHelper();