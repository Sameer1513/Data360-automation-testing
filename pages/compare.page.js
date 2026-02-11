

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ComparePage {
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

    async runAutoCompare() {
        const exportsDir = path.join(process.cwd(), 'exports');
        const files = fs.readdirSync(exportsDir);

        // 1. Updated helper to handle timestamps using startsWith
       const getLatest = (prefix) => {
        return files
        .filter(f => f.startsWith(prefix) && f.endsWith('.xlsx'))
        .sort((a, b) => {
            const statA = fs.statSync(path.join(exportsDir, a));
            const statB = fs.statSync(path.join(exportsDir, b));
            return statB.mtimeMs - statA.mtimeMs; // Latest file first
        })[0];
    };

     // 2. Update prefixes to match your Extraction Script output
     // Your script saves: Production_weld_data1_[timestamp].xlsx
    const actual = getLatest('ActualData_'); 
    const prod = getLatest('Production_weld_data1'); 

    // 3. Improved error message for debugging
        if (!actual || !prod) {
           throw new Error(`Files missing in ${exportsDir}. \nLooking for: "ActualData_" and "Production_weld_data1" \nFound: ${files.length} files total.`);
      }
    }

    async compareWorkbooks(actualPath, prodPath) {
        const actualWb = new ExcelJS.Workbook(); await actualWb.xlsx.readFile(actualPath);
        const prodWb = new ExcelJS.Workbook(); await prodWb.xlsx.readFile(prodPath);
        const resultWb = new ExcelJS.Workbook();

        // 1. CREATE SUMMARY SHEET FIRST (This makes it Sheet 1)
        const summarySheet = resultWb.addWorksheet('SUMMARY_DASHBOARD');
        summarySheet.addRow(['Report Name', 'Final Status', 'Navigation Link']);
        
        // Formatting for Summary Header
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        const configs = [
            { name: 'Pass_View', keys: ['Station', 'Bug Type', 'Torch'] },
            { name: 'Zone_View', keys: ['Station', 'Bug Type', 'Torch', 'Zone'] },
            { name: 'Tilt_View', keys: ['Station', 'Bug Type', 'Torch', 'Tilt Range'] },
            { name: 'Pass_DataAnalysis', keys: ['Zone', 'Event'] },
            // { name: 'Zone_DataAnalysis', keys: ['Zone', 'Event'] },
            // { name: 'Tilt_DataAnalysis', keys: ['Zone', 'Event'] }, 
            { name: 'Setup', prodSheet: 'WeldSummary', keys: ['Job', 'Weld'] }
        ];

        // 2. PROCESS OTHER SHEETS (These become Sheet 2, 3, etc.)
        for (const cfg of configs) {
            const aSheet = actualWb.getWorksheet(cfg.name);
            const pSheet = prodWb.getWorksheet(cfg.prodSheet || cfg.name); 
            
            if (aSheet && pSheet) {
                const hasFailures = this.compare(aSheet, pSheet, resultWb, cfg.name, cfg.keys);
                const status = hasFailures ? 'FAIL' : 'PASS';
                
                // Add entry to the first sheet
                const row = summarySheet.addRow([
                    cfg.name.replace(/_/g, ' '),
                    status,
                    {
                        text: `Go to ${cfg.name}`,
                        hyperlink: `#'${cfg.name}'!A1` // Correct internal link syntax
                    }
                ]);

                // Cell styling for the summary row
                const statusCell = row.getCell(2);
                statusCell.font = { bold: true, color: { argb: status === 'PASS' ? 'FF006100' : 'FF9C0006' } };
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: status === 'PASS' ? 'FFC6EFCE' : 'FFFFC7CE' } };
                
                row.getCell(3).font = { color: { argb: 'FF0000FF' }, underline: true };
            }
        }

        // Auto-size summary columns
        summarySheet.columns = [
            { width: 30 }, { width: 15 }, { width: 25 }
        ];

        const out = path.join(__dirname, '..', 'exports', `Final_Comparison_${Date.now()}.xlsx`);
        await resultWb.xlsx.writeFile(out);
        console.log("✅ Comparison Saved: " + out);
    }

    compare(aSheet, pSheet, resultWb, title, keyCols) {
        const resSheet = resultWb.addWorksheet(title);
        const ignoreList = ['time', 'pass', 'passname', 'weldstarttime', 'status', 'slno'];
        let sheetHasFail = false;

        const getHMap = (s) => {
            const m = {};
            s.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { m[this.clean(c.value)] = i; });
            return m;
        };

        const aHMap = getHMap(aSheet);
        const pHMap = getHMap(pSheet);
        const headers = [];
        aSheet.getRow(1).eachCell(c => headers.push(c.value));

        const pMap = new Map();
        pSheet.eachRow((row, i) => {
            if (i === 1) return;
            const k = keyCols.map(col => {
                const idx = this.findColIdx(pHMap, col);
                return idx ? this.normalizeValue(row.getCell(idx).value) : '';
            }).join('_');
            pMap.set(k, row);
        });

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
            let rowFails = false;

            headers.forEach((h, idx) => {
                const aVal = aRow.getCell(idx + 1).value;
                aDisp.push(aVal);
                const pIdx = this.findColIdx(pHMap, h);
                const pVal = (pRow && pIdx) ? pRow.getCell(pIdx).value : 'N/A';
                pDisp.push(pVal);

                const cleanHeader = this.clean(h);
                const isIgnored = ignoreList.some(item => cleanHeader.includes(item));

                if (!isIgnored && pVal !== 'N/A') {
                    if (this.normalizeValue(aVal) !== this.normalizeValue(pVal)) {
                        rowFails = true;
                        sheetHasFail = true;
                    }
                }
            });

            const status = (pRow && !rowFails) ? 'PASS' : (pRow ? 'FAIL' : 'NOT FOUND');
            aDisp[1] = status; pDisp[1] = status;
            
            const ar = resSheet.addRow(aDisp);
            const pr = resSheet.addRow(pDisp);

            [ar, pr].forEach(row => {
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.alignment = { horizontal: 'left' }; 
                    if (status !== 'PASS' && row === pr) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                    }
                });
            });
            resSheet.addRow([]); 
        });
        resSheet.getRow(1).font = { bold: true };
        return sheetHasFail;
    }
    
}

module.exports = ComparePage;