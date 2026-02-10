
// const ExcelJS = require('exceljs');
// const path = require('path');
// const fs = require('fs');

// class ComparePage {
//     // 1. Cleans everything (LEAD -> lead, Current (A) -> current)
//     clean(val) {
//         if (!val) return '';
//         return val.toString().toLowerCase()
//             .replace(/\(.*\)/g, '') // Removes anything in parentheses like (A) or (V)
//             .replace(/[^a-z0-9]/g, '') // Removes spaces, dots, and newlines
//             .trim();
//     }

//     // 2. Normalizes values (50.0 -> 50)
//      normalizeValue(val) {
//     if (val === null || val === undefined) return '';
//     let strVal = val.toString().trim();
    
//     // Handle numbers (50.0 becomes 50)
//     if (strVal !== '' && !isNaN(strVal)) return Number(strVal).toString();
    
//     // This is the fix: LEAD and Lead both become "lead"
//     return strVal.toLowerCase(); 
// }

//     // 3. Robust Column Finder
//     findColIdx(headerMap, targetName) {
//         const target = this.clean(targetName);
//         if (headerMap[target]) return headerMap[target];
        
//         // Check for partials (e.g., "current" inside "avgcurrent")
//         for (let key in headerMap) {
//             if (key.includes(target) || target.includes(key)) return headerMap[key];
//         }
//         return null;
//     }

//     async runAutoCompare() {
//         const exportsDir = path.join(__dirname, '..', 'exports');
//         const getLatest = (pre) => {
//             const files = fs.readdirSync(exportsDir).filter(f => f.startsWith(pre) && f.endsWith('.xlsx'))
//                 .sort((a, b) => fs.statSync(path.join(exportsDir, b)).mtime - fs.statSync(path.join(exportsDir, a)).mtime);
//             return files.length > 0 ? files[0] : null;
//         };

//         const actual = getLatest('ActualData_Full_Comparison');
//         const prod = getLatest('Production_Row_1');
//         if (!actual || !prod) throw new Error("Files missing");

//         await this.compareWorkbooks(path.join(exportsDir, actual), path.join(exportsDir, prod));
//     }

    
   
//     async compareWorkbooks(actualPath, prodPath) {
//     const actualWb = new ExcelJS.Workbook(); await actualWb.xlsx.readFile(actualPath);
//     const prodWb = new ExcelJS.Workbook(); await prodWb.xlsx.readFile(prodPath);
//     const resultWb = new ExcelJS.Workbook();

//     const configs = [
//         { 
//             name: 'Pass_View', 
//             keys: ['Station', 'Bug Type', 'Torch'] 
//         },
//         { 
//             name: 'Zone_View', 
//             keys: ['Station', 'Bug Type', 'Torch', 'Zone'] 
//         },
//         { 
//             name: 'Tilt_View', 
//             keys: ['Station', 'Bug Type', 'Torch', 'Tilt Range'] 
//         },
//         { name: 'Pass_DataAnalysis', keys: ['Zone', 'Event'] },
//         { name: 'Zone_DataAnalysis', keys: ['Zone', 'Event'] },
//         // ADDED THIS LINE BELOW
//         { name: 'Tilt_DataAnalysis', keys: ['Zone', 'Event'] }, 
//         { name: 'Setup', prodSheet: 'WeldSummary', keys: ['Job', 'Weld'] }
//     ];

//     for (const cfg of configs) {
//         const aSheet = actualWb.getWorksheet(cfg.name);
//         // Note: This looks for a sheet with the same name in Production
//         const pSheet = prodWb.getWorksheet(cfg.prodSheet || cfg.name); 
        
//         if (aSheet && pSheet) {
//             this.compare(aSheet, pSheet, resultWb, cfg.name, cfg.keys);
//         } else {
//             console.warn(`⚠️ Skipping ${cfg.name}: Sheet not found in both files.`);
//         }
//     }
//     this.createSummarySheet(resultWb, globalDifferences);
//     const out = path.join(__dirname, '..', 'exports', `Final_Comparison_${Date.now()}.xlsx`);
//     await resultWb.xlsx.writeFile(out);
//     console.log("✅ Comparison Saved: " + out);
// }
   
// compare(aSheet, pSheet, resultWb, title, keyCols) {
//     const resSheet = resultWb.addWorksheet(title);
//     const ignoreList = ['time', 'pass', 'passname', 'weldstarttime', 'status', 'slno'];

//     const getHMap = (s) => {
//         const m = {};
//         s.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { m[this.clean(c.value)] = i; });
//         return m;
//     };

//     const aHMap = getHMap(aSheet);
//     const pHMap = getHMap(pSheet);

//     // --- FIX 1: CALCULATE COMMON HEADERS ---
//     // We only take headers from Actual that also exist in Production (cleaned match)
//     const rawHeaders = [];
//     aSheet.getRow(1).eachCell(c => rawHeaders.push(c.value));

//     const commonHeaders = rawHeaders.filter(h => {
//         const cleanH = this.clean(h);
//         // Keep it if it's a key column OR if it exists in the Production header map
//         return keyCols.some(k => this.clean(k) === cleanH) || pHMap[cleanH] !== undefined;
//     });

//     // FIX 2: Build Production Map
//     const pMap = new Map();
//     pSheet.eachRow((row, i) => {
//         if (i === 1) return;
//         const k = keyCols.map(col => {
//             const idx = this.findColIdx(pHMap, col);
//             return idx ? this.normalizeValue(row.getCell(idx).value) : '';
//         }).join('_');
//         pMap.set(k, row);
//     });

//     // Add Header Row to Result Sheet
//     resSheet.addRow(['Source', 'Status', ...commonHeaders]);

//     aSheet.eachRow((aRow, i) => {
//         if (i === 1) return;
        
//         const k = keyCols.map(col => {
//             const idx = this.findColIdx(aHMap, col);
//             return idx ? this.normalizeValue(aRow.getCell(idx).value) : '';
//         }).join('_');

//         const pRow = pMap.get(k);
//         const aDisp = ['ACTUAL', ''];
//         const pDisp = ['PRODUCTION', ''];
//         let fails = [];

//         // --- FIX 3: ITERATE ONLY OVER COMMON HEADERS ---
//         commonHeaders.forEach((h, idx) => {
//             const aIdx = this.findColIdx(aHMap, h);
//             const aVal = aIdx ? aRow.getCell(aIdx).value : 'N/A';
//             aDisp.push(aVal);

//             const pIdx = this.findColIdx(pHMap, h);
//             const pVal = (pRow && pIdx) ? pRow.getCell(pIdx).value : 'N/A';
//             pDisp.push(pVal);

//             const cleanHeader = this.clean(h);
//             const isIgnored = ignoreList.some(item => cleanHeader.includes(item));

//             if (!isIgnored && pVal !== 'N/A' && aVal !== 'N/A') {
//                 if (this.normalizeValue(aVal) !== this.normalizeValue(pVal)) {
//                     fails.push(idx + 3); // Track failure index for coloring if needed
//                     globalDifferences.push({
//                         Sheet: title,
//                         Identifier: k.replace(/_/g, ' '), // e.g., "Station 1 Lead"
//                         Parameter: h,
//                         Actual: aVal,
//                         Production: pVal
//                     });
//                 }

//             }
//         });

//         const status = (pRow && fails.length === 0) ? 'PASS' : (pRow ? 'FAIL' : 'NOT FOUND');
//         aDisp[1] = status; pDisp[1] = status;
        
//         const ar = resSheet.addRow(aDisp);
//         const pr = resSheet.addRow(pDisp);

//         // Alignment Fix
//         [ar, pr].forEach(row => {
//             row.eachCell({ includeEmpty: true }, (cell) => {
//                 cell.alignment = { horizontal: 'left' }; 
//                 if (status !== 'PASS' && row === pr) {
//                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
//                 }
//             });
//         });

//         resSheet.addRow([]); // Gap between pairs
//     });

//     // Auto-filter and formatting
//     resSheet.getRow(1).font = { bold: true };
// }

// createSummarySheet(workbook, diffs) {
//     const summarySheet = workbook.addWorksheet('DIFFERENCE_SUMMARY', { properties: { tabColor: { argb: 'FFFF0000' } } });
    
//     // Headers
//     summarySheet.addRow(['Sheet Name', 'Row Identifier', 'Parameter', 'Actual Value', 'Production Value', 'Difference']);
    
//     if (diffs.length === 0) {
//         summarySheet.addRow(['All data matches perfectly! No differences found.']);
//     } else {
//         diffs.forEach(d => {
//             const diffValue = (isNaN(d.Actual) || isNaN(d.Production)) 
//                 ? 'N/A' 
//                 : (Number(d.Actual) - Number(d.Production)).toFixed(2);

//             summarySheet.addRow([
//                 d.Sheet,
//                 d.Identifier,
//                 d.Parameter,
//                 d.Actual,
//                 d.Production,
//                 diffValue
//             ]);
//         });
//     }

//     // Formatting
//     summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
//     summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    
//     summarySheet.columns.forEach(col => {
//         col.width = 25;
//         col.alignment = { horizontal: 'left' };
//     });
//  }
// }

// module.exports = ComparePage;

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ComparePage {
    clean(val) {
        if (!val) return '';
        return val.toString().toLowerCase()
            .replace(/\(.*\)/g, '') // Removes (A), (V), etc.
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
        if (headerMap[target]) return headerMap[target]; // Exact clean match
        
        // Fuzzy match: check if one contains the other
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

        const globalDifferences = []; // Initialize here

        const configs = [
            { name: 'Pass_View', keys: ['Station', 'Bug Type', 'Torch'] },
            { name: 'Zone_View', keys: ['Station', 'Bug Type', 'Torch', 'Zone'] },
            { name: 'Tilt_View', keys: ['Station', 'Bug Type', 'Torch', 'Tilt Range'] },
            { name: 'Pass_DataAnalysis', keys: ['Zone', 'Event'] },
            { name: 'Zone_DataAnalysis', keys: ['Zone', 'Event'] },
            { name: 'Tilt_DataAnalysis', keys: ['Zone', 'Event'] }, 
            { name: 'Setup', prodSheet: 'WeldSummary', keys: ['Job', 'Weld'] }
        ];

        for (const cfg of configs) {
            const aSheet = actualWb.getWorksheet(cfg.name);
            const pSheet = prodWb.getWorksheet(cfg.prodSheet || cfg.name); 
            
            if (aSheet && pSheet) {
                // Pass globalDifferences array into the compare method
                this.compare(aSheet, pSheet, resultWb, cfg.name, cfg.keys, globalDifferences);
            }
        }

        this.createSummarySheet(resultWb, globalDifferences);
        
        const out = path.join(__dirname, '..', 'exports', `Final_Comparison_${Date.now()}.xlsx`);
        await resultWb.xlsx.writeFile(out);
        console.log("✅ Comparison Saved: " + out);
    }

    compare(aSheet, pSheet, resultWb, title, keyCols, globalDifferences) {
        const resSheet = resultWb.addWorksheet(title);
        const ignoreList = ['time', 'pass', 'passname', 'weldstarttime', 'status', 'slno'];

        const getHMap = (s) => {
            const m = {};
            s.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { m[this.clean(c.value)] = i; });
            return m;
        };

        const aHMap = getHMap(aSheet);
        const pHMap = getHMap(pSheet);

        // Keep ALL headers from the Actual sheet so nothing is removed
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
            let fails = [];

            headers.forEach((h, idx) => {
                const aVal = aRow.getCell(idx + 1).value;
                aDisp.push(aVal);

                // Use fuzzy finder for every column header
                const pIdx = this.findColIdx(pHMap, h);
                const pVal = (pRow && pIdx) ? pRow.getCell(pIdx).value : 'N/A';
                pDisp.push(pVal);

                const cleanHeader = this.clean(h);
                const isIgnored = ignoreList.some(item => cleanHeader.includes(item));

                // ONLY fail if:
                // 1. Column exists in Production (pVal !== 'N/A')
                // 2. Column is not in ignore list
                // 3. Values don't match
                if (!isIgnored && pVal !== 'N/A') {
                    if (this.normalizeValue(aVal) !== this.normalizeValue(pVal)) {
                        fails.push(idx + 3); 
                        globalDifferences.push({
                            Sheet: title,
                            Identifier: k.replace(/_/g, ' '), 
                            Parameter: h,
                            Actual: aVal,
                            Production: pVal
                        });
                    }
                }
            });

            const status = (pRow && fails.length === 0) ? 'PASS' : (pRow ? 'FAIL' : 'NOT FOUND');
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
    }

    createSummarySheet(workbook, diffs) {
        const summarySheet = workbook.addWorksheet('DIFFERENCE_SUMMARY', { properties: { tabColor: { argb: 'FFFF0000' } } });
        summarySheet.addRow(['Sheet Name', 'Row Identifier', 'Parameter', 'Actual Value', 'Production Value', 'Difference']);
        
        if (diffs.length === 0) {
            summarySheet.addRow(['All data matches perfectly! No differences found.']);
        } else {
            diffs.forEach(d => {
                const diffValue = (isNaN(d.Actual) || isNaN(d.Production)) 
                    ? 'N/A' 
                    : (Number(d.Actual) - Number(d.Production)).toFixed(2);

                summarySheet.addRow([d.Sheet, d.Identifier, d.Parameter, d.Actual, d.Production, diffValue]);
            });
        }

        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        summarySheet.columns.forEach(col => {
            col.width = 25;
            col.alignment = { horizontal: 'left' };
        });
    }
}

module.exports = ComparePage;