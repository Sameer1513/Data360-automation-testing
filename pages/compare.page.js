

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

    async runAutoCompare(projectName, targetWeldIds = []) {
         // Convert targetWeldIds to strings for accurate comparison
        const filterIds = Array.isArray(targetWeldIds) ? targetWeldIds.map(String) : [];
        this.filterIds = filterIds.map(id => this.normalizeValue(id));
        const exportsDir = path.join(process.cwd(), 'exports');
        const files = fs.readdirSync(exportsDir);

        // 1. Updated helper to handle timestamps using startsWith
       const getLatest = (prefix) => {
        return files
        // .filter(f => f.startsWith(prefix) && f.endsWith('.xlsx'))
        .filter(f => f.startsWith(prefix) && f.includes(`_${projectName}_`) && f.endsWith('.xlsx'))
        .sort((a, b) => {
            const statA = fs.statSync(path.join(exportsDir, a));
            const statB = fs.statSync(path.join(exportsDir, b));
            return statB.mtimeMs - statA.mtimeMs; // Latest file first
        })[0];
    };

     // 2. Update prefixes to match your Extraction Script output
     // Your script saves: Production_weld_data1_[timestamp].xlsx
    const actual = getLatest('ActualData_'); 
    const prod = getLatest('Production_Report'); 

    // 3. Improved error message for debugging
        if (!actual || !prod) {
           throw new Error(`Files missing in ${exportsDir}. \nLooking for: "ActualData_" and "Production_report" \nFound: ${files.length} files total.`);
      }
      const actualPath = path.join(exportsDir, actual);
      const prodPath = path.join(exportsDir, prod);
    //  console.log(`🚀 Starting Comparison:\nActual: ${actual}\nProd: ${prod}`); 
    //     await this.compareWorkbooks(actualPath, prodPath);
    const finalOutPath = path.join(exportsDir, `Final_Comparison_${projectName}_${Date.now()}.xlsx`);

    console.log(`🚀 Comparison for ${projectName}:\nActual: ${actual}\nProd: ${prod}`); 
    await this.compareWorkbooks(actualPath, prodPath, finalOutPath);
    }
    

   async compareWorkbooks(actualPath, prodPath,outpath) {
    const actualWb = new ExcelJS.Workbook(); await actualWb.xlsx.readFile(actualPath);
    const prodWb = new ExcelJS.Workbook(); await prodWb.xlsx.readFile(prodPath);
    const resultWb = new ExcelJS.Workbook();

    // 1. CREATE SUMMARY SHEET
    const summarySheet = resultWb.addWorksheet('SUMMARY_DASHBOARD');
    summarySheet.addRow(['Report Name', 'Final Status', 'Navigation Link']);
    
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    // Define which keys belong to which sheet name
    const keyLookup = {
        'Pass_View': [ 'Weld ID','Station', 'Bug Type', 'Torch'],
        'Zone_View': [ 'Weld ID','Station', 'Bug Type', 'Torch', 'Zone'],
        'Tilt_View': [ 'Weld ID','Station', 'Bug Type', 'Torch', 'Tilt Range'],
        'Pass_tlogs_data': [ 'Weld ID','Zone', 'Event'],
        'Zone_tlogs_data': [ 'Weld ID','Zone', 'Event'],
        'Tilt_tlogs_data': [ 'Weld ID','Zone', 'Event'],
        'WeldSummary': ['Job Number', 'Weld ID'] // This will match against 'Setup' in Actual
    };

    // 2. DYNAMIC PROCESS: Only loop through sheets that EXIST in Production Excel
    for (const pSheet of prodWb.worksheets) {
        const pName = pSheet.name;

        if (pName === 'SUMMARY_DASHBOARD') continue;

        // Sync names: Production 'WeldSummary' -> Actual 'Setup'
        let aName = pName;
        if (pName === 'WeldSummary') aName = 'Setup';

        const aSheet = actualWb.getWorksheet(aName);
        const keys = keyLookup[pName];

        // Only proceed if BoltDB has the matching sheet and we have keys defined
        if (aSheet && keys) {
            console.log(`📊 Comparing Sheet: ${pName}`);
            const hasFailures = this.compare(aSheet, pSheet, resultWb, pName, keys);
            const status = hasFailures ? 'FAIL' : 'PASS';

            const row = summarySheet.addRow([
                pName.replace(/_/g, ' '),
                status,
                {
                    text: `Go to ${pName}`,
                    hyperlink: `#'${pName}'!A1`
                }
            ]);

            const statusCell = row.getCell(2);
            statusCell.font = { bold: true, color: { argb: status === 'PASS' ? 'FF006100' : 'FF9C0006' } };
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: status === 'PASS' ? 'FFC6EFCE' : 'FFFFC7CE' } };
            row.getCell(3).font = { color: { argb: 'FF0000FF' }, underline: true };
        }
    }

    // 3. FINALIZING
    summarySheet.columns = [{ width: 30 }, { width: 15 }, { width: 25 }];

    const out = path.join(__dirname, '..', 'exports', `Final_Comparison_${Date.now()}.xlsx`);
    await resultWb.xlsx.writeFile(outpath);
    console.log("✅ Comparison Saved: " + outpath);
}

compare(aSheet, pSheet, resultWb, title, keyCols) {
    const resSheet = resultWb.addWorksheet(title);
    const ignoreList = ['Weld ID', 'pass', 'status', 'slno', 'record', 'event', 'pipe', 'band', 'logging', 'year', 'month', 'day', 'hour', 'minute', 'second', 'iwm', 'm500'];
    let sheetHasFail = false;

    const getHMap = (s) => {
        const m = {};
        s.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { m[this.clean(c.value)] = i; });
        return m;
    };

    const aHMap = getHMap(aSheet);
    const pHMap = getHMap(pSheet);
    const weldIdColIdx = this.findColIdx(aHMap, 'Weld ID') || 1;

    // 1. Prepare Headers (Only shared columns)
    const headers = [];
    aSheet.getRow(1).eachCell(c => {
        if (this.findColIdx(pHMap, c.value) !== null) {
            headers.push(c.value);
        }
    });

    // 2. Map Actual Data
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

    // 3. Process Production Rows
    pSheet.eachRow((pRow, i) => {
        if (i === 1) return;

        const pWeldIdIdx = this.findColIdx(pHMap, 'Weld ID') || 1;
        const pWeldVal = this.normalizeValue(pRow.getCell(pWeldIdIdx).value);
        if (this.filterIds.length > 0 && !this.filterIds.includes(pWeldVal)) return;

        const k = keyCols.map(col => {
            const idx = this.findColIdx(pHMap, col);
            return idx ? this.normalizeValue(pRow.getCell(idx).value) : '';
        }).join('_');

        const aRow = aMap.get(k);
        if (!aRow) return; // Skip if not in Actual database

        const aDisp = ['ACTUAL', ''];
        const pDisp = ['PRODUCTION', ''];
        let rowFails = false;
        let diffColumnIndices = []; // Track which columns are different

        headers.forEach((h, index) => {
            const aIdx = this.findColIdx(aHMap, h);
            const pIdx = this.findColIdx(pHMap, h);
            
            const aVal = aRow.getCell(aIdx).value;
            const pVal = pRow.getCell(pIdx).value;

            aDisp.push(aVal);
            pDisp.push(pVal);

            const cleanHeader = this.clean(h);
            const isIgnored = ignoreList.some(item => cleanHeader.includes(item));

            if (!isIgnored) {
                const normA = this.normalizeValue(aVal);
                const normP = this.normalizeValue(pVal);

                // Check if values are actually different (and not both empty)
                if (normA !== normP && (normA !== '' || normP !== '')) {
                    rowFails = true;
                    sheetHasFail = true;
                    // Position is index + 3 (Source + Status + column offset)
                    diffColumnIndices.push(index + 3); 
                }
            }
        });

        const status = rowFails ? 'FAIL' : 'PASS';
        aDisp[1] = status;
        pDisp[1] = status;

        const ar = resSheet.addRow(aDisp);
        const pr = resSheet.addRow(pDisp);

        // Apply Formatting
        [ar, pr].forEach(row => {
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.alignment = { horizontal: 'left' };
                
                // Row fill for FAIL status on the Production row
                if (status === 'FAIL' && row === pr) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                }

                // RED TEXT PART: Apply to mismatched cells in the Production row
                if (row === pr && diffColumnIndices.includes(colNumber)) {
                    cell.font = {
                        color: { argb: 'FFFF0000' }, // Red
                        bold: true
                    };
                }
            });
        });
        resSheet.addRow([]); // Spacer
    });

    // Formatting for the whole sheet
    resSheet.getRow(1).font = { bold: true };
    resSheet.columns.forEach(col => { col.width = 10; });

    return sheetHasFail;
}
}
module.exports = ComparePage;