const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { sanitizeExcelSheetName, sanitizeFileSegment, sanitizeFolderName } = require('../Helper/excelNaming.util.js');

class StatusConfigCompare {
    /**
     * @param {string} weldParamExcelPath
     * @param {string} statusPassExcelPath
     * @param {string|null} weldSheetName
     * @param {string|null} jobNumber — UI Job Number; drives output filename + UI worksheet lookup
     * @param {string|null} projectName — output folder `exports/<projectName>/` (legacy: `StatusConfig Compared with WeldParam` if omitted)
     */
    constructor(weldParamExcelPath, statusPassExcelPath, weldSheetName = null, jobNumber = null, projectName = null) {
        this.weldParamExcelPath = weldParamExcelPath;
        this.statusPassExcelPath = statusPassExcelPath;
        this.weldSheetName = weldSheetName; // ✅ Save sheet name
        this.jobNumber = jobNumber;
        this.projectName = projectName;

        this.baseExportDir = path.join(process.cwd(), 'exports');
    }

    initializeExportDir() {
        this.exportDir = this.projectName
            ? path.join(this.baseExportDir, sanitizeFolderName(this.projectName))
            : path.join(this.baseExportDir, 'StatusConfig Compared with WeldParam');

        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }

        const jobPart = sanitizeFileSegment(this.jobNumber, 'Job');
        this.outputPath = path.join(
            this.exportDir,
            `StatusConfigCompare_${jobPart}_${Date.now()}.xlsx`
        );
    }

    normalizeParam(name) {
        if (!name) return '';
        return name.toString()
            .toLowerCase()
            .replace(/\(.*?\)/g, '')
            .replace(/\s+/g, '')
            .trim();
    }

    normalizeValue(val) {
        if (val === null || val === undefined || val === '') {
            return '0';
        }
        const num = Number(val);
        if (!isNaN(num)) {
            return num.toString();
        }
        return val.toString().toLowerCase();
    }

    async run() {
        try {
            this.initializeExportDir();
            console.log(`🚀 StatusConfigCompare - Weld: ${this.weldParamExcelPath}`);
            console.log(`   UI: ${this.statusPassExcelPath}`);

            // IMPORTANT: Create a fresh workbook per run.
            // Reusing a module-level workbook causes worksheet name collisions
            // when the test runs p600z and then p625.
            const workbook = new ExcelJS.Workbook();

            // ✅ Validate input files exist
            if (!fs.existsSync(this.weldParamExcelPath)) {
                throw new Error(`Weld Excel missing: ${this.weldParamExcelPath}`);
            }
            if (!fs.existsSync(this.statusPassExcelPath)) {
                throw new Error(`UI Excel missing: ${this.statusPassExcelPath}`);
            }

            const csvWorkbook = new ExcelJS.Workbook();
            await csvWorkbook.xlsx.readFile(this.weldParamExcelPath);

            const uiWorkbook = new ExcelJS.Workbook();
            await uiWorkbook.xlsx.readFile(this.statusPassExcelPath);

            // ✅ FIXED: Single coherent passSheet detection
            let passSheet = null;
            if (this.weldSheetName) {
                passSheet = csvWorkbook.getWorksheet(this.weldSheetName);
                console.log(`📄 Using specified Weld sheet: ${this.weldSheetName}`);
            }
            if (!passSheet) {
                passSheet = csvWorkbook.worksheets.find(ws =>
                    ws.name.toLowerCase().includes('pass level')
                );
                if (passSheet) console.log(`📄 Auto-found Weld Pass sheet: ${passSheet.name}`);
            }
            if (!passSheet) {
                passSheet = csvWorkbook.worksheets[0];
                console.log(`📄 Fallback to first Weld sheet: ${passSheet?.name || 'NONE'}`);
            }
            if (!passSheet) {
                throw new Error('❌ No valid Weld sheet found');
            }

            // ✅ UI sheet: primary name = Job Number (sanitized), same as StatusConfigPass.writeToExcel
            let uiSheet = null;
            if (this.jobNumber != null && String(this.jobNumber).trim() !== '') {
                uiSheet = uiWorkbook.getWorksheet(sanitizeExcelSheetName(this.jobNumber));
            }
            if (!uiSheet) {
                uiSheet = uiWorkbook.getWorksheet('Status_Config_UI');
            }
            if (!uiSheet) {
                uiSheet = uiWorkbook.worksheets.find(ws =>
                    ws.name.toLowerCase().includes('ui') ||
                    ws.name.toLowerCase().includes('status')
                );
            }
            if (!uiSheet) {
                uiSheet = uiWorkbook.worksheets[0];
            }
            if (!uiSheet) {
                throw new Error('❌ No valid UI sheet found');
            }
            console.log(`📄 UI sheet: ${uiSheet.name}`);


// ✅ 1. SUMMARY SHEET (Dashboard)
const summarySheet = workbook.addWorksheet('SUMMARY_DASHBOARD');

summarySheet.addRow(['Report Name', 'Final Status', 'Navigation Link']);
summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
};

// ✅ 2. DETAIL SHEET (Actual comparison)
const comparisonSheet = workbook.addWorksheet('StatusConfig_vs_Weld');

let globalFailure = false;

// ✅ Build headers correctly
const headerRow = passSheet.getRow(1);

// Skip first column (Parameter)
const rawHeaders = headerRow.values.slice(2);

const formattedHeaders = [];

for (let i = 0; i < rawHeaders.length; i += 2) {
    const passName = rawHeaders[i];
    if (!passName) continue;

    formattedHeaders.push(`${passName} Min`);
    formattedHeaders.push(`${passName} Max`);
}

const headers = ['Source', 'Parameter', ...formattedHeaders];

comparisonSheet.addRow(headers);
comparisonSheet.getRow(1).font = { bold: true };

            // Build UI parameter map
            const uiMap = {};
            uiSheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                const param = row.getCell(1).value;
                const normalized = this.normalizeParam(param);
                if (!normalized) return;

                const values = [];
                for (let col = 2; col <= row.cellCount; col++) {
                    values.push(row.getCell(col).value);
                }
                uiMap[normalized] = values;
            });
            console.log(`📊 UI params mapped: ${Object.keys(uiMap).length}`);

            // Process each row from Weld sheet
            let matchedRows = 0;
            for (let rowNum = 2; rowNum <= passSheet.rowCount; rowNum++) {
                const weldRow = passSheet.getRow(rowNum);
                const parameter = weldRow.getCell(1).value;
                if (!parameter) continue;

                const normalized = this.normalizeParam(parameter);
                const uiValues = uiMap[normalized];
                if (!uiValues) {
                    console.log(`⚠️ No UI match for: ${parameter}`);
                    continue;
                }

                // Weld values (skip col 1)
                const weldValues = [];
                for (let col = 2; col <= weldRow.cellCount; col++) {
                    weldValues.push(weldRow.getCell(col).value);
                }

                // Add rows: Weld then UI
                const weldExcelRow = comparisonSheet.addRow(['Weld Parameter', parameter, ...weldValues]);
                const uiExcelRow = comparisonSheet.addRow(['Status Config UI', parameter, ...uiValues]);

                // Compare & highlight
                const maxCols = Math.max(weldValues.length, uiValues.length);
                for (let col = 3; col <= 2 + maxCols; col++) {
                    const weldCell = weldExcelRow.getCell(col);
                    const uiCell = uiExcelRow.getCell(col);
                    weldCell.alignment = uiCell.alignment = { horizontal: 'center', vertical: 'middle' };

                    const match = this.normalizeValue(weldCell.value) === this.normalizeValue(uiCell.value);
                    if (!match) {
                        globalFailure = true;

                        weldCell.fill = uiCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFC7CE' }
                        };
                        weldCell.font = uiCell.font = { color: { argb: 'FF9C0006' } };
                    }
                }
                matchedRows++;
            }

            console.log(`✅ Matched ${matchedRows} parameter rows`);
            comparisonSheet.columns.forEach(col => col.width = 18);

            const finalStatus = globalFailure ? 'FAIL' : 'PASS';

const row = summarySheet.addRow([
    'StatusConfig Compare',
    finalStatus,
    { text: 'Go to Comparison', hyperlink: `#'StatusConfig_vs_Weld'!A1` }
]);

row.getCell(2).font = {
    bold: true,
    color: { argb: finalStatus === 'PASS' ? 'FF006100' : 'FF9C0006' }
};

row.getCell(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: finalStatus === 'PASS' ? 'FFC6EFCE' : 'FFFFC7CE' }
};

row.getCell(3).font = {
    color: { argb: 'FF0000FF' },
    underline: true
};

            await workbook.xlsx.writeFile(this.outputPath);
            console.log(`✅ Comparison Excel created: ${this.outputPath}`);
            return this.outputPath;

        } catch (error) {
            console.error(`❌ StatusConfigCompare FAILED: ${error.message}`);
            // Create error file
            const wb = new ExcelJS.Workbook();
            const errorSheet = wb.addWorksheet('ERROR');
            errorSheet.getCell('A1').value = `Comparison Failed: ${error.message}`;
            errorSheet.getCell('A2').value = `Weld: ${this.weldParamExcelPath}`;
            errorSheet.getCell('A3').value = `UI: ${this.statusPassExcelPath}`;
            await wb.xlsx.writeFile(this.outputPath);
            console.log(`⚠️ Error file created: ${this.outputPath}`);
            throw error;
        }
    }
}

module.exports = StatusConfigCompare;
