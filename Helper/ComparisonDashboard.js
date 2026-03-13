const ExcelJS = require('exceljs');

function getCellValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object') {
        if (cell.value.result !== undefined) return String(cell.value.result).trim();
        if (cell.value.text !== undefined) return String(cell.value.text).trim();
        if (cell.value.hyperlink !== undefined) return String(cell.value.text || cell.value.hyperlink).trim();
        if (cell.value instanceof Date) return cell.value.toISOString();
    }
    return String(cell.value).trim();
}

function getGroupColName(sheetName) {
    if (sheetName.includes('View'))  return 'Pass Name';
    if (sheetName.includes('tlogs')) return 'Zone';
    return null;
}

// Draw a pure SVG donut chart — no external dependencies
function svgDonut(pass, fail) {
    const total = pass + fail;
    if (total === 0) return `<svg viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#eee"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="#999">N/A</text></svg>`;

    const passAngle = (pass / total) * 360;
    const failAngle = 360 - passAngle;

    function polarToCartesian(cx, cy, r, angleDeg) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function arc(cx, cy, r, startAngle, endAngle, color) {
        if (endAngle - startAngle >= 360) endAngle = startAngle + 359.99;
        const s = polarToCartesian(cx, cy, r, startAngle);
        const e = polarToCartesian(cx, cy, r, endAngle);
        const large = endAngle - startAngle > 180 ? 1 : 0;
        return `<path d="M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z" fill="${color}"/>`;
    }

    const cx = 60, cy = 60, r = 50, hole = 28;
    let svg = `<svg viewBox="0 0 120 120" width="120" height="120">`;

    if (pass > 0 && fail > 0) {
        svg += arc(cx, cy, r, 0, passAngle, '#28a745');
        svg += arc(cx, cy, r, passAngle, 360, '#dc3545');
    } else if (pass > 0) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#28a745"/>`;
    } else {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc3545"/>`;
    }

    // Hole
    svg += `<circle cx="${cx}" cy="${cy}" r="${hole}" fill="white"/>`;

    // Center text
    const pct = Math.round((pass / total) * 100);
    svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" font-weight="bold" fill="#333">${pct}%</text>`;
    svg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#666">pass</text>`;

    // Legend
    svg += `<rect x="4" y="104" width="10" height="10" fill="#28a745" rx="2"/>`;
    svg += `<text x="17" y="113" font-size="9" fill="#555">Pass ${pass}</text>`;
    svg += `<rect x="64" y="104" width="10" height="10" fill="#dc3545" rx="2"/>`;
    svg += `<text x="77" y="113" font-size="9" fill="#555">Fail ${fail}</text>`;

    svg += `</svg>`;
    return svg;
}

async function generateDashboard(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    let passed = 0;
    let failed = 0;
    let sheetsData = [];

    workbook.eachSheet(sheet => {
        if (sheet.name === 'SUMMARY_DASHBOARD') return;

        let sheetPassed = 0;
        let sheetFailed = 0;
        let failures    = [];
        let headers     = [];
        let groupColIdx = null;
        let groupCounts = {};

        const maxCol    = sheet.columnCount || 50;
        const headerRow = sheet.getRow(1);

        for (let c = 1; c <= maxCol; c++) {
            headers[c] = getCellValue(headerRow.getCell(c)) || `Col ${c}`;
        }

        const groupColName = getGroupColName(sheet.name);
        if (groupColName) {
            for (let c = 1; c <= maxCol; c++) {
                if (headers[c] === groupColName) { groupColIdx = c; break; }
            }
        }

        for (let i = 2; i <= sheet.rowCount; i++) {
            const row    = sheet.getRow(i);
            const source = getCellValue(row.getCell(1)).toUpperCase();
            const status = getCellValue(row.getCell(2)).toUpperCase();

            if (source !== 'PRODUCTION') continue;

            const groupKey = groupColIdx ? (getCellValue(row.getCell(groupColIdx)) || 'Unknown') : 'All';
            if (!groupCounts[groupKey]) groupCounts[groupKey] = { pass: 0, fail: 0 };

            if (status === 'PASS') {
                sheetPassed++;
                groupCounts[groupKey].pass++;
            } else if (status === 'FAIL') {
                sheetFailed++;
                groupCounts[groupKey].fail++;

                const actualRow = sheet.getRow(i - 1);
                let rowCells = [];
                let hasActualMismatch = false;

                for (let c = 1; c <= maxCol; c++) {
                    const header  = headers[c];
                    if (!header) continue;

                    const prodStr = getCellValue(row.getCell(c));
                    const actStr  = getCellValue(actualRow.getCell(c));

                    let isMismatch = false;
                    if (c > 2) {
                        const font = row.getCell(c).font;
                        if (font && font.color && font.color.argb === 'FFFF0000') {
                            isMismatch        = true;
                            hasActualMismatch = true;
                        }
                    }

                    rowCells.push({ header, actual: actStr, production: prodStr, isMismatch });
                }

                if (hasActualMismatch) failures.push({ rowId: i, cells: rowCells });
            }
        }

        if (sheetPassed + sheetFailed > 0) {
            sheetsData.push({ name: sheet.name, passed: sheetPassed, failed: sheetFailed, failures, groupCounts });
            passed += sheetPassed;
            failed += sheetFailed;
        }
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weld Automation Dashboard</title>
    <style>
        :root { --bg:#f8f9fa; --card:#fff; --text:#333; --pass:#28a745; --fail:#dc3545; --border:#dee2e6; }
        * { box-sizing:border-box; }
        body { font-family:'Segoe UI',sans-serif; background:var(--bg); color:var(--text); padding:20px; margin:0; }
        .container { max-width:1400px; margin:0 auto; }
        h1 { text-align:center; color:#444; margin-bottom:30px; }

        .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:20px; margin-bottom:30px; }
        .stat-card { background:var(--card); padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,.05); text-align:center; }
        .stat-val { font-size:2rem; font-weight:bold; }
        .stat-lbl { color:#666; font-size:.9rem; text-transform:uppercase; letter-spacing:1px; }
        .text-pass { color:var(--pass); }
        .text-fail { color:var(--fail); }

        .card { background:var(--card); padding:25px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,.05); margin-bottom:30px; }
        .card-header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--border); padding-bottom:15px; margin-bottom:20px; }
        .card-header h2 { margin:0; font-size:1.5rem; color:#333; }
        .badges { display:flex; gap:10px; }
        .badge { padding:6px 14px; border-radius:20px; color:#fff; font-weight:600; font-size:.9rem; }
        .bg-pass { background:var(--pass); }
        .bg-fail { background:var(--fail); }

        /* Charts row */
        .charts-row { display:flex; flex-wrap:wrap; gap:24px; margin-bottom:24px; }
        .chart-block { display:flex; flex-direction:column; align-items:center; background:#f9f9f9; border:1px solid #eee; border-radius:10px; padding:12px 16px; }
        .chart-label { font-size:.85rem; font-weight:700; color:#444; margin-bottom:6px; text-align:center; }
        .chart-sub { font-size:.75rem; color:#888; margin-top:4px; text-align:center; }

        /* Failure table */
        .table-wrapper { overflow-x:auto; border:1px solid var(--border); border-radius:6px; }
        .fail-banner { background:#fff0f0; color:var(--fail); padding:10px 15px; font-weight:bold; font-size:1rem; border-bottom:1px solid #ffcaca; }
        .data-table { width:100%; border-collapse:collapse; font-size:.85rem; white-space:nowrap; }
        .data-table th, .data-table td { padding:8px 10px; border-right:1px solid #ddd; text-align:left; }
        .data-table th { background:#f4f7f6; font-weight:600; color:#444; border-bottom:2px solid #aaa; }
        .actual-row td     { background:#fafafa; color:#888; font-style:italic; border-top:2px solid #ccc; border-bottom:0!important; padding-bottom:2px; }
        .production-row td { background:#fff; font-weight:500; color:#222; border-bottom:2px solid #ccc; border-top:0!important; padding-top:2px; }
        .mismatch { background:var(--fail)!important; color:#fff!important; font-weight:bold!important; }
        .success-msg { text-align:center; padding:20px; color:var(--pass); font-size:1.1rem; font-weight:bold; background:#e6ffe6; border-radius:8px; }
    </style>
</head>
<body>
<div class="container">
    <h1>📊 Weld Comparison Report</h1>

    <div class="stats">
        <div class="stat-card"><div class="stat-val">${passed + failed}</div><div class="stat-lbl">Total Tlogs</div></div>
        <div class="stat-card"><div class="stat-val text-pass">${passed}</div><div class="stat-lbl">Passed</div></div>
        <div class="stat-card"><div class="stat-val text-fail">${failed}</div><div class="stat-lbl">Failed</div></div>
        <div class="stat-card"><div class="stat-val">${Math.round((passed / ((passed + failed) || 1)) * 100)}%</div><div class="stat-lbl">Pass Rate</div></div>
    </div>

    ${sheetsData.map(sheet => {
        const groups = Object.entries(sheet.groupCounts);
        return `
    <div class="card">
        <div class="card-header">
            <h2>${sheet.name}</h2>
            <div class="badges">
                <span class="badge bg-pass">PASS: ${sheet.passed}</span>
                <span class="badge bg-fail">FAIL: ${sheet.failed}</span>
            </div>
        </div>

        <div class="charts-row">
            ${groups.map(([groupKey, counts]) => `
            <div class="chart-block">
                <div class="chart-label">${groupKey}</div>
                ${svgDonut(counts.pass, counts.fail)}
                <div class="chart-sub">${counts.pass + counts.fail} total &nbsp;·&nbsp; ${counts.pass} pass &nbsp;·&nbsp; ${counts.fail} fail</div>
            </div>
            `).join('')}
        </div>

        <div>
            ${sheet.failures.length > 0 ? `
            <div class="table-wrapper">
                <div class="fail-banner">⚠️ ${sheet.failures.length} Failed Rows</div>
                <table class="data-table">
                    <thead><tr>${sheet.failures[0].cells.map(c => `<th>${c.header}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${sheet.failures.map(fail => `
                        <tr class="actual-row">${fail.cells.map(c => `<td>${c.actual || '-'}</td>`).join('')}</tr>
                        <tr class="production-row">${fail.cells.map(c => `<td class="${c.isMismatch ? 'mismatch' : ''}">${c.production || '-'}</td>`).join('')}</tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : `<div class="success-msg">✅ All rows match</div>`}
        </div>
    </div>`;
    }).join('')}
</div>
</body>
</html>`;

    return html;
}

module.exports = generateDashboard;