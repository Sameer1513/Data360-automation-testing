const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const generateDashboard = require('../Helper/ComparisonDashboard');

class ComparePage {

    // ─────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────

    clean(val) {
        if (!val) return '';
        return val.toString().toLowerCase()
            .replace(/\(.*\)/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    normalizeValue(val) {
        if (val === null || val === undefined) return '';
        let strVal = val.toString().trim();
        if (strVal !== '' && !isNaN(strVal)) return Number(strVal).toString();
        return strVal.toLowerCase();
    }

    findColIdx(headerMap, targetName) {
        const target = this.clean(targetName);
        if (headerMap[target]) return headerMap[target];
        for (let key in headerMap) {
            if (key.includes(target) || target.includes(key)) return headerMap[key];
        }
        return null;
    }

    // Find column index by keyword in a header row (used for limits)
    findColByKeyword(headerRow, keyword) {
        let found = null;
        headerRow.eachCell({ includeEmpty: false }, (cell, colIdx) => {
            const val = (cell.value || '').toString().toLowerCase().replace(/\n/g, ' ');
            if (val.includes(keyword.toLowerCase()) && !found) found = colIdx;
        });
        return found;
    }

    // Map pass name to StatusConfig group (Hot Pass / Fill / Cap)
    getPassType(passName) {
        if (!passName) return null;
        const lower = passName.toString().toLowerCase();
        if (lower.includes('hot') || lower.includes('root')) return 'Hot Pass';
        if (lower.includes('fill')) return 'Fill';
        if (lower.includes('cap'))  return 'Cap';
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────
    // ENTRY POINT
    //
    // options = {
    //   runDataCompare  : bool  (from fc.comparison or fc.dataCompare)
    //   runLimitsCheck  : bool  (from fc.comparison or fc.limitsCheck)
    //   statusConfigPath: string
    // }
    //
    // flowControl mapping (done in spec):
    //   comparison  = true  → runDataCompare: true,  runLimitsCheck: true
    //   dataCompare = true  → runDataCompare: true,  runLimitsCheck: false
    //   limitsCheck = true  → runDataCompare: false, runLimitsCheck: true
    // ─────────────────────────────────────────────────────────────────────

    async runAutoCompare(projectName, targetWeldIds = [], options = {}) {
        const {
            runDataCompare   = true,
            runLimitsCheck   = false,
            statusConfigPath = null
        } = options;

        const filterIds    = Array.isArray(targetWeldIds) ? targetWeldIds.map(String) : [];
        this.filterIds     = filterIds.map(id => this.normalizeValue(id));

        const actualDir   = path.join(process.cwd(), 'exports', 'ActualData');
        const prodDir     = path.join(process.cwd(), 'exports', 'ProductionData');
        const comparedDir = path.join(process.cwd(), 'exports', 'ComparedData');
        if (!fs.existsSync(comparedDir)) fs.mkdirSync(comparedDir, { recursive: true });

        const getLatest = (dir, prefix) => {
            if (!fs.existsSync(dir)) return null;
            return fs.readdirSync(dir)
                .filter(f => f.startsWith(prefix) && f.includes(`_${projectName}_`) && f.endsWith('.xlsx'))
                .sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)[0];
        };

        const prod = getLatest(prodDir, 'Production_Report');
        if (!prod) throw new Error(`Production file missing in ${prodDir}`);
        const prodPath = path.join(prodDir, prod);

        const finalOutPath = path.join(comparedDir, `Final_Comparison_${projectName}_${Date.now()}.xlsx`);
        const resultWb     = new ExcelJS.Workbook();
        let globalFailure  = false;
        let limitsHasViolations = false;

        // ── DATA COMPARE ─────────────────────────────────────────────────
        if (runDataCompare) {
            const actual = getLatest(actualDir, 'BoltD_');
            if (!actual) throw new Error(`Actual (BoltDB) file missing in ${actualDir}`);
            const actualPath = path.join(actualDir, actual);
            console.log(`🚀 Data Comparison:\nActual: ${actual}\nProd: ${prod}`);
            globalFailure = await this._runDataCompareSheets(actualPath, prodPath, resultWb);
        }

        // ── LIMITS CHECK ─────────────────────────────────────────────────
        if (runLimitsCheck) {
            if (!statusConfigPath || !fs.existsSync(statusConfigPath)) {
                console.warn('⚠️  limitsCheck enabled but StatusConfig file not found — skipping');
            } else {
                console.log(`📐 Limits Check: ${prod}`);
                limitsHasViolations = await this._runLimitsCheckSheets(prodPath, statusConfigPath, resultWb, filterIds);
            }
        }

        // ── SAVE SINGLE EXCEL + DASHBOARD ────────────────────────────────
        await resultWb.xlsx.writeFile(finalOutPath);
        console.log('✅ Report Saved: ' + finalOutPath);

        const dashboardHtml = await generateDashboard(finalOutPath);
        const dashboardPath = finalOutPath.replace('.xlsx', '.html');
        fs.writeFileSync(dashboardPath, dashboardHtml);
        console.log('📊 Dashboard Generated: ' + dashboardPath);

        return { hasFailure: globalFailure, limitsHasViolations, reportPath: finalOutPath, dashboardPath };
    }

    // ─────────────────────────────────────────────────────────────────────
    // DATA COMPARE — adds SUMMARY_DASHBOARD + comparison sheets
    // ─────────────────────────────────────────────────────────────────────

    async _runDataCompareSheets(actualPath, prodPath, resultWb) {
        const actualWb = new ExcelJS.Workbook(); await actualWb.xlsx.readFile(actualPath);
        const prodWb   = new ExcelJS.Workbook(); await prodWb.xlsx.readFile(prodPath);
        let globalFailure = false;

        const summarySheet = resultWb.addWorksheet('SUMMARY_DASHBOARD');
        summarySheet.addRow(['Report Name', 'Final Status', 'Navigation Link']);
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        const keyLookup = {
            'Pass_View':       ['Weld ID', 'Station', 'Bug Type', 'Torch'],
            'Zone_View':       ['Weld ID', 'Station', 'Bug Type', 'Torch', 'Zone'],
            'Tilt_View':       ['Weld ID', 'Station', 'Bug Type', 'Torch', 'Tilt Range'],
            'Pass_tlogs_data': ['Weld ID', 'Zone', 'Event'],
            'Zone_tlogs_data': ['Weld ID', 'Zone', 'Event'],
            'Tilt_tlogs_data': ['Weld ID', 'Zone', 'Event'],
            // 'WeldSummary':     ['Job Number', 'Weld ID'],
        };

        for (const pSheet of prodWb.worksheets) {
            const pName = pSheet.name;
            if (pName === 'SUMMARY_DASHBOARD') continue;
            let aName = pName === 'WeldSummary' ? 'Setup' : pName;
            const aSheet = actualWb.getWorksheet(aName);
            const keys   = keyLookup[pName];

            if (aSheet && keys) {
                console.log(`📊 Comparing Sheet: ${pName}`);
                const hasFailures = this._compareSheet(aSheet, pSheet, resultWb, pName, keys);
                if (hasFailures) globalFailure = true;
                const status = hasFailures ? 'FAIL' : 'PASS';

                const row = summarySheet.addRow([
                    pName.replace(/_/g, ' '), status,
                    { text: `Go to ${pName}`, hyperlink: `#'${pName}'!A1` }
                ]);
                row.getCell(2).font = { bold: true, color: { argb: status === 'PASS' ? 'FF006100' : 'FF9C0006' } };
                row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: status === 'PASS' ? 'FFC6EFCE' : 'FFFFC7CE' } };
                row.getCell(3).font = { color: { argb: 'FF0000FF' }, underline: true };
            }
        }

        summarySheet.columns = [{ width: 30 }, { width: 15 }, { width: 25 }];
        return globalFailure;
    }

    _compareSheet(aSheet, pSheet, resultWb, title, keyCols) {
        const resSheet   = resultWb.addWorksheet(title);
        const ignoreList = ['Weld ID', 'pass', 'status', 'slno', 'record', 'event', 'pipe', 'band', 'logging', 'year', 'month', 'day', 'hour', 'minute', 'second', 'iwm', 'm500', 'welder'];
        let sheetHasFail = false;

        const getHMap = (s) => {
            const m = {};
            s.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { m[this.clean(c.value)] = i; });
            return m;
        };
        const aHMap = getHMap(aSheet);
        const pHMap = getHMap(pSheet);
        const weldIdColIdx = this.findColIdx(aHMap, 'Weld ID') || 1;

        const headers = [];
        aSheet.getRow(1).eachCell(c => {
            if (this.findColIdx(pHMap, c.value) !== null) headers.push(c.value);
        });

        const aMap = new Map();
        aSheet.eachRow((row, i) => {
            if (i === 1) return;
            const weldVal = this.normalizeValue(row.getCell(weldIdColIdx).value);
            if (this.filterIds.length > 0 && !this.filterIds.includes(weldVal)) return;
            const k = keyCols.map(col => {
                const idx = this.findColIdx(aHMap, col);
                return idx ? this.normalizeValue(row.getCell(idx).value) : '';
            }).join('_');
            aMap.set(k, row);
        });

        resSheet.addRow(['Source', 'Status', ...headers]);

        pSheet.eachRow((pRow, i) => {
            if (i === 1) return;
            const pWeldIdIdx = this.findColIdx(pHMap, 'Weld ID') || 1;
            const pWeldVal   = this.normalizeValue(pRow.getCell(pWeldIdIdx).value);
            if (this.filterIds.length > 0 && !this.filterIds.includes(pWeldVal)) return;

            const k = keyCols.map(col => {
                const idx = this.findColIdx(pHMap, col);
                return idx ? this.normalizeValue(pRow.getCell(idx).value) : '';
            }).join('_');

            const aRow = aMap.get(k);
            if (!aRow) return;

            const aDisp = ['ACTUAL', ''];
            const pDisp = ['PRODUCTION', ''];
            let rowFails = false;
            let diffColumnIndices = [];

            headers.forEach((h, index) => {
                const aIdx = this.findColIdx(aHMap, h);
                const pIdx = this.findColIdx(pHMap, h);
                const aVal = aRow.getCell(aIdx).value;
                const pVal = pRow.getCell(pIdx).value;
                aDisp.push(aVal);
                pDisp.push(pVal);

                const isIgnored = ignoreList.some(item => this.clean(h).includes(item));
                if (!isIgnored) {
                    const normA = this.normalizeValue(aVal);
                    const normP = this.normalizeValue(pVal);
                    if (normA !== normP && (normA !== '' || normP !== '')) {
                        rowFails = true;
                        sheetHasFail = true;
                        diffColumnIndices.push(index + 3);
                    }
                }
            });

            const status = rowFails ? 'FAIL' : 'PASS';
            aDisp[1] = status;
            pDisp[1] = status;
            const ar = resSheet.addRow(aDisp);
            const pr = resSheet.addRow(pDisp);

            [ar, pr].forEach(row => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.alignment = { horizontal: 'left' };
                    if (status === 'FAIL' && row === pr)
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                    if (row === pr && diffColumnIndices.includes(colNumber))
                        cell.font = { color: { argb: 'FFFF0000' }, bold: true };
                });
            });
            resSheet.addRow([]);
        });

        resSheet.getRow(1).font = { bold: true };
        resSheet.columns.forEach(col => { col.width = 10; });
        return sheetHasFail;
    }

    // Keep original method name as alias (backward compatibility)
    compare(aSheet, pSheet, resultWb, title, keyCols) {
        return this._compareSheet(aSheet, pSheet, resultWb, title, keyCols);
    }

    // ─────────────────────────────────────────────────────────────────────
    // LIMITS CHECK — adds LIMITS_SUMMARY + Limits_* sheets
    // ─────────────────────────────────────────────────────────────────────

    get PARAM_MAP() {
        return [
            { configName: 'Current (A)',            keyword: 'current'           },
            { configName: 'Volts (V)',              keyword: 'voltage'           },
            { configName: 'Wire Speed (in/min)',    keyword: 'wire speed'        },
            { configName: 'Travel Speed (in/min)', keyword: 'travel speed'      },
            { configName: 'Oscillation Width (in)',keyword: 'oscillation width'  },
            { configName: 'Heat (kJ/in)',           keyword: 'heat'              },
            { configName: 'True Energy (kJ/in)',    keyword: 'true energy'       },
        ];
    }

    async _parseLimits(statusConfigPath) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(statusConfigPath);
        const ws = wb.getWorksheet('Status_Config_UI');
        if (!ws) throw new Error('Sheet "Status_Config_UI" not found in StatusConfig file');

        const limits = { method: null, level: null, params: {} };
        ws.eachRow(row => {
            const a = (row.getCell(1).value || '').toString().trim();
            const b = (row.getCell(2).value || '').toString().trim();
            if (a === 'Status Calculation Method') limits.method = b;
            if (a === 'Status Calculation Level')  limits.level  = b;
        });

        let headerRowNum = null;
        const passGroups = [];
        const colMap     = {};

        ws.eachRow((row, rowNum) => {
            if ((row.getCell(1).value || '').toString().trim() !== 'Parameter') return;
            headerRowNum = rowNum;
            row.eachCell({ includeEmpty: false }, (cell, colIdx) => {
                if (colIdx === 1) return;
                const header = (cell.value || '').toString().trim();
                colMap[header] = colIdx;
                const match = header.match(/^(.+?)\s+(Min|Max)$/i);
                if (match && !passGroups.includes(match[1].trim())) passGroups.push(match[1].trim());
            });
        });

        if (!headerRowNum) throw new Error('Parameter table not found in StatusConfig sheet');

        ws.eachRow((row, rowNum) => {
            if (rowNum <= headerRowNum) return;
            const paramName = (row.getCell(1).value || '').toString().trim();
            if (!paramName) return;
            limits.params[paramName] = {};
            passGroups.forEach(group => {
                limits.params[paramName][group] = {
                    min: parseFloat(row.getCell(colMap[`${group} Min`])?.value) || 0,
                    max: parseFloat(row.getCell(colMap[`${group} Max`])?.value) || 0,
                };
            });
        });

        console.log(`📋 Method: ${limits.method} | Level: ${limits.level} | Groups: ${passGroups.join(', ')}`);
        return limits;
    }

    _getTargetSheet(method, level) {
        const m = (method || '').toLowerCase();
        const l = (level  || '').toLowerCase();
        if (m.includes('instantaneous'))                return 'Pass_tlogs_data';
        if (m.includes('average') && l.includes('zone')) return 'Zone_View';
        if (m.includes('average') && l.includes('tilt')) return 'Tilt_View';
        if (m.includes('average'))                      return 'Pass_View';
        return 'Pass_View';
    }

    async _runLimitsCheckSheets(prodPath, statusConfigPath, resultWb, filterIds = []) {
        const limits          = await this._parseLimits(statusConfigPath);
        const targetSheetName = this._getTargetSheet(limits.method, limits.level);

        const prodWb = new ExcelJS.Workbook();
        await prodWb.xlsx.readFile(prodPath);
        const prodSheet = prodWb.getWorksheet(targetSheetName);

        if (!prodSheet) {
            console.warn(`⚠️  Sheet "${targetSheetName}" not found in production file`);
            return false;
        }

        const normFilterIds = filterIds.map(id => this.normalizeValue(id));
        const headerRow     = prodSheet.getRow(1);

        const paramColMap = {};
        this.PARAM_MAP.forEach(p => {
            const col = this.findColByKeyword(headerRow, p.keyword);
            if (col) paramColMap[p.configName] = col;
        });

        const weldIdCol = this.findColByKeyword(headerRow, 'weld id') || this.findColByKeyword(headerRow, 'search weld');
        const passCol   = this.findColByKeyword(headerRow, 'pass name') || this.findColByKeyword(headerRow, 'pass');
        const statusCol = this.findColByKeyword(headerRow, 'status');

        const violatingRows = [];
        let totalChecked    = 0;

        prodSheet.eachRow((row, rowNum) => {
            if (rowNum === 1) return;

            if (normFilterIds.length > 0 && weldIdCol) {
                if (!normFilterIds.includes(this.normalizeValue(row.getCell(weldIdCol).value))) return;
            }

            const passName   = passCol   ? (row.getCell(passCol).value   || '').toString().trim() : '';
            const passType   = this.getPassType(passName);
            const weldId     = weldIdCol ? row.getCell(weldIdCol).value  : '';
            const currStatus = statusCol ? (row.getCell(statusCol).value || '').toString().toLowerCase() : '';

            if (!passType) return;
            totalChecked++;

            const violations = [];
            this.PARAM_MAP.forEach(p => {
                const colIdx = paramColMap[p.configName];
                if (!colIdx) return;
                const rawVal = row.getCell(colIdx).value;
                if (rawVal === null || rawVal === undefined || rawVal === '') return;
                const numVal = parseFloat(rawVal.toString());
                if (isNaN(numVal)) return;

                const limitGroup = limits.params[p.configName]?.[passType];
                if (!limitGroup) return;

                const { min, max } = limitGroup;
                if (min === 0 && max === 0) return;

                let reason = '';
                if (min && numVal < min) reason = `${numVal} < Min(${min})`;
                if (max && numVal > max) reason += reason ? ` & ${numVal} > Max(${max})` : `${numVal} > Max(${max})`;

                if (reason) {
                    const alreadyFlagged = currStatus === 'false' || currStatus === 'fail';
                    violations.push({ param: p.configName, value: numVal, min, max, reason, alreadyFlagged });
                }
            });

            if (violations.length > 0) violatingRows.push({ weldId, passName, violations });
        });

        console.log(`   📐 ${totalChecked} rows checked | ${violatingRows.length} with violations`);

        this._addLimitsDetailSheet(resultWb, targetSheetName, violatingRows);
        this._addLimitsSummarySheet(resultWb, limits, targetSheetName, totalChecked, violatingRows);

        return violatingRows.length > 0;
    }

    _addLimitsDetailSheet(resultWb, sheetName, violatingRows) {
        const ws = resultWb.addWorksheet(`Limits_${sheetName.replace(/_/g, '')}`);

        const hRow = ws.addRow(['Weld ID', 'Pass', 'Parameter', 'Value', 'Min Limit', 'Max Limit', 'Violation', 'Flagged in Production?']);
        hRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            cell.alignment = { horizontal: 'center' };
        });

        if (violatingRows.length === 0) {
            const okRow = ws.addRow(['✅ All values are within configured limits']);
            okRow.getCell(1).font = { bold: true, color: { argb: 'FF006100' } };
            okRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
            ws.mergeCells('A2:H2');
        } else {
            violatingRows.forEach(r => {
                r.violations.forEach(v => {
                    const dataRow = ws.addRow([
                        r.weldId, r.passName, v.param, v.value, v.min, v.max, v.reason,
                        v.alreadyFlagged ? 'Yes — already red in production' : '⚠️ NOT flagged — needs attention'
                    ]);
                    // 🟡 Yellow = new violation not caught, 🔴 Red = already flagged
                    const bg = v.alreadyFlagged ? 'FFFFC7CE' : 'FFFFFF00';
                    dataRow.eachCell({ includeEmpty: true }, cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                    });
                    if (!v.alreadyFlagged) dataRow.getCell(8).font = { bold: true, color: { argb: 'FFCC0000' } };
                });
                ws.addRow([]);
            });
        }

        ws.columns = [{ width: 12 }, { width: 18 }, { width: 22 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 30 }, { width: 32 }];
    }

    _addLimitsSummarySheet(resultWb, limits, sheetName, totalChecked, violatingRows) {
        const ws = resultWb.addWorksheet('LIMITS_SUMMARY');
        ws.addRow(['Status Calculation Method', limits.method || 'Unknown']);
        ws.addRow(['Status Calculation Level',  limits.level  || 'Unknown']);
        ws.addRow(['Sheet Checked',             sheetName]);
        ws.addRow([]);

        const hRow = ws.addRow(['Sheet', 'Rows Checked', 'Violations', 'Status', 'Link']);
        hRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        });

        const hasFail   = violatingRows.length > 0;
        const linkSheet = `Limits_${sheetName.replace(/_/g, '')}`;
        const row = ws.addRow([sheetName, totalChecked, violatingRows.length,
            hasFail ? 'VIOLATIONS FOUND' : 'ALL WITHIN LIMITS',
            { text: `Go to ${linkSheet}`, hyperlink: `#'${linkSheet}'!A1` }
        ]);
        row.getCell(4).font = { bold: true, color: { argb: hasFail ? 'FF9C0006' : 'FF006100' } };
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hasFail ? 'FFFFC7CE' : 'FFC6EFCE' } };
        row.getCell(5).font = { color: { argb: 'FF0000FF' }, underline: true };

        ws.addRow([]);
        ws.addRow(['LEGEND']).getCell(1).font = { bold: true };
        const ly = ws.addRow(['🟡 Yellow', 'Out of limits but NOT flagged in production — investigate']);
        ly.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        const lr = ws.addRow(['🔴 Red-tint', 'Out of limits AND already flagged red in production']);
        lr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };

        ws.addRow([]);
        ws.addRow(['METHOD REFERENCE']).getCell(1).font = { bold: true };
        ws.addRow(['Instantaneous',   'Each tlog reading checked individually against limits']);
        ws.addRow(['Average by Pass', 'Pass-level averages checked against limits']);
        ws.addRow(['Average by Zone', 'Zone-level averages — any zone fail = pass fail']);
        ws.addRow(['Average by Tilt', 'Tilt-range averages checked against limits']);
        ws.columns = [{ width: 25 }, { width: 65 }, { width: 15 }, { width: 22 }, { width: 28 }];
    }
}

module.exports = ComparePage;