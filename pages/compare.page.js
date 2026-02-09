
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ComparePage {
    // 1. Cleans everything (LEAD -> lead, Current (A) -> current)
    clean(val) {
        if (!val) return '';
        return val.toString().toLowerCase()
            .replace(/\(.*\)/g, '') // Removes anything in parentheses like (A) or (V)
            .replace(/[^a-z0-9]/g, '') // Removes spaces, dots, and newlines
            .trim();
    }

    // 2. Normalizes values (50.0 -> 50)
    normalizeValue(val) {
        if (val === null || val === undefined) return '';
        let strVal = val.toString().trim();
        if (strVal !== '' && !isNaN(strVal)) return Number(strVal).toString();
        return strVal.toLowerCase().trim();
    }

    // 3. Robust Column Finder
    findColIdx(headerMap, targetName) {
        const target = this.clean(targetName);
        if (headerMap[target]) return headerMap[target];
        
        // Check for partials (e.g., "current" inside "avgcurrent")
        for (let key in headerMap) {
            if (key.includes(target) || target.includes(key)) return headerMap[key];
        }
        return null;
    }

    async runAutoCompare() {
        const exportsDir = path.join(__dirname, '..', 'exports');
        const getLatest = (pre) => {
            const files = fs.readdirSync(exportsDir).filter(f => f.startsWith(pre) && f.endsWith('.xlsx'))
                .sort((a, b) => fs.statSync(path.join(exportsDir, b)).mtime - fs.statSync(path.join(exportsDir, a)).mtime);
            return files.length > 0 ? files[0] : null;
        };

        const actual = getLatest('ActualData_Full_Comparison');
        const prod = getLatest('Production_Row_1');
        if (!actual || !prod) throw new Error("Files missing");

        await this.compareWorkbooks(path.join(exportsDir, actual), path.join(exportsDir, prod));
    }

    async compareWorkbooks(actualPath, prodPath) {
        const actualWb = new ExcelJS.Workbook(); await actualWb.xlsx.readFile(actualPath);
        const prodWb = new ExcelJS.Workbook(); await prodWb.xlsx.readFile(prodPath);
        const resultWb = new ExcelJS.Workbook();

        const configs = [
            { name: 'Pass_View', keys: ['Torch'] },
            { name: 'Pass_DataAnalysis', keys: ['Zone', 'Event'] },
            { name: 'Zone_View', keys: ['Torch'] }, // Production has Zone, but Actual doesn't. Matching by Torch only.
            { name: 'Zone_DataAnalysis', keys: ['Zone', 'Event'] },
            { name: 'Setup', prodSheet: 'WeldSummary', keys: ['Job', 'Weld'] }
        ];

        for (const cfg of configs) {
            const aSheet = actualWb.getWorksheet(cfg.name);
            const pSheet = prodWb.getWorksheet(cfg.prodSheet || cfg.name);
            if (aSheet && pSheet) this.compare(aSheet, pSheet, resultWb, cfg.name, cfg.keys);
        }

        const out = path.join(__dirname, '..', 'exports', `Final_Comparison_${Date.now()}.xlsx`);
        await resultWb.xlsx.writeFile(out);
        console.log("✅ Comparison Saved: " + out);
    }

   
    compare(aSheet, pSheet, resultWb, title, keyCols) {
        const resSheet = resultWb.addWorksheet(title);
        
        // --- ADDED THIS LINE ---
        const ignoreList = ['time', 'pass', 'passname', 'weldstarttime', 'status', 'slno'];

        const getHMap = (s) => {
            const m = {};
            s.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { m[this.clean(c.value)] = i; });
            return m;
        };

        const aHMap = getHMap(aSheet);
        const pHMap = getHMap(pSheet);

        const pMap = new Map();
        pSheet.eachRow((row, i) => {
            if (i === 1) return;
            const k = keyCols.map(col => {
                const idx = this.findColIdx(pHMap, col);
                return idx ? this.normalizeValue(row.getCell(idx).value) : '';
            }).join('_');
            pMap.set(k, row);
        });

        const headers = []; aSheet.getRow(1).eachCell(c => headers.push(c.value));
        resSheet.addRow(['Source', 'Status', ...headers]);

        aSheet.eachRow((aRow, i) => {
            if (i === 1) return;
            const k = keyCols.map(col => {
                const idx = this.findColIdx(aHMap, col);
                return idx ? this.normalizeValue(aRow.getCell(idx).value) : '';
            }).join('_');

            const pRow = pMap.get(k);
            const aDisp = ['ACTUAL', ''];
            const pDisp = ['PRODUCTION', ''];
            let fails = [];

            headers.forEach((h, idx) => {
                const aVal = aRow.getCell(idx + 1).value;
                aDisp.push(aVal);

                const pIdx = this.findColIdx(pHMap, h);
                const pVal = (pRow && pIdx) ? pRow.getCell(pIdx).value : 'N/A';
                pDisp.push(pVal);

                // --- EDITED THIS BLOCK ---
                const cleanHeader = this.clean(h);
                const isIgnored = ignoreList.some(item => cleanHeader.includes(item));

                if (!isIgnored && pVal !== 'N/A' && this.normalizeValue(aVal) !== this.normalizeValue(pVal)) {
                    fails.push(idx + 3);
                }
                // -------------------------
            });

            const status = (pRow && fails.length === 0) ? 'PASS' : (pRow ? 'FAIL' : 'NOT FOUND');
            aDisp[1] = status; pDisp[1] = status;
            resSheet.addRow(aDisp);
            const pr = resSheet.addRow(pDisp);
            const ar = resSheet.addRow(aDisp);
            
            if (status !== 'PASS') {
    // "ar" is the Actual Row, "pr" is the Production Row
           [ar, pr].forEach(row => {
            row.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
              });
             });
             }
            resSheet.addRow([]);
        });
    }

}

module.exports = ComparePage;