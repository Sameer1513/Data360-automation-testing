const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class StatusConfigCompare {
    constructor(inputFilePath, passFilePath = null) {
    this.inputFilePath = inputFilePath;
    this.passFilePath = passFilePath; // optional

    this.exportDir = path.join(process.cwd(), 'exports');

    if (!fs.existsSync(this.exportDir)) {
        fs.mkdirSync(this.exportDir, { recursive: true });
    }

    this.outputPath = path.join(
        this.exportDir,
        `StatusConfigCompare_${Date.now()}.xlsx`
    );
}

async addComparisonSheet() {

    if (!this.passFilePath) {
        console.log('⚠ No pass file provided. Skipping comparison sheet.');
        return;
    }

    console.log('🔍 Creating Comparison Sheet...');

    const compareWorkbook = new ExcelJS.Workbook();
    await compareWorkbook.xlsx.readFile(this.outputPath);

    const passWorkbook = new ExcelJS.Workbook();
    await passWorkbook.xlsx.readFile(this.passFilePath);

    // ✅ Sheet 2 from BOTH files
    const compareSheet = compareWorkbook.getWorksheet(2);
    const passSheet = passWorkbook.getWorksheet(2);

    if (!compareSheet || !passSheet) {
        console.log('❌ Sheet 2 not found in one of the files.');
        return;
    }

    const comparisonSheet = compareWorkbook.addWorksheet('Comparison');

    // Header
    comparisonSheet.addRow([
        'Parameter',
        'Pass Level (CSV)',
        'Pass Level (Status Config)',
        'Status'
    ]);

    comparisonSheet.getRow(1).font = { bold: true };

    const maxRows = Math.max(compareSheet.rowCount, passSheet.rowCount);
    const maxCols = compareSheet.columnCount;

    // Start from row 2 (skip header)
    for (let row = 2; row <= maxRows; row++) {

        const parameter = compareSheet.getRow(row).getCell(1).value;

        if (!parameter) continue;

        for (let col = 2; col <= maxCols; col++) {

            const header = compareSheet.getRow(1).getCell(col).value;

            if (!header) continue;

            // Normalize value function
const normalizeValue = (val) => {

    if (val === null || val === undefined || val === '') {
        return 0;
    }

    // Convert numeric strings to number
    const num = Number(val);

    return isNaN(num) ? val : num;
};

const raw1 = compareSheet.getRow(row).getCell(col).value;
const raw2 = passSheet.getRow(row).getCell(col).value;

const value1 = normalizeValue(raw1);
const value2 = normalizeValue(raw2);

const isMatch = value1 === value2;

            comparisonSheet.addRow([
                `${parameter} - ${header}`,
                value1,
                value2,
                isMatch ? 'MATCH ✅' : 'MISMATCH ❌'
            ]);
        }
    }

    comparisonSheet.columns.forEach(col => col.width = 28);

    await compareWorkbook.xlsx.writeFile(this.outputPath);

    console.log('✅ Comparison Sheet Added Successfully');
}
    async run() {
        console.log('🚀 Running StatusConfigCompare...');
        console.log(`📘 Reading: ${this.inputFilePath}`);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.inputFilePath);
        const finalData = [];
        const sheet2 = workbook.getWorksheet(2);
        const sheet3 = workbook.getWorksheet(3);
        if (!sheet2 || !sheet3) {
            console.log('❌ Sheet 2 or Sheet 3 not found.');
            return;
        }
        await this.processSheet(sheet2, finalData);
        await this.processSheet(sheet3, finalData);
        console.log(`📊Total extracted rows:$ {
            finalData.length
        }`);
        await this.createOutput(finalData);
        await this.addComparisonSheet();
    }
    async processSheet(sheet, finalData) {
        console.log(`📊Processing sheet: ${
            sheet.name
        }`);
        const passRow = sheet.getRow(2);
        const totalCols = sheet.columnCount;
        const rowMap = {};
        const normalize = (text) => text?.toString().toLowerCase().replace(/\s+/g, '').trim();
        // Map row labels
        sheet.eachRow((row, rowNumber) => {
            const label = row.getCell(1).value;
            if (label) {
                rowMap[normalize(label)] = rowNumber;
            }
        });
        const findRowNumber = (keyword) => {
            const normalizedKeyword = normalize(keyword);
            const match = Object.keys(rowMap).find(key => key.includes(normalizedKeyword));
            return match ? rowMap[match] : null;
        };
        const passNameRow = findRowNumber('passname');
        const zoneRow = findRowNumber('passpend');
        const passEnableRow = findRowNumber('passenable'); // ✅ NEW 
        const travelHighRow = findRowNumber('travelspeedhigh');
        const travelLowRow = findRowNumber('travelspeedlow');
        const oscHighRow = findRowNumber('oscwidthhigh');
        const oscLowRow = findRowNumber('oscwidthlow');
        const verticalHighRow = findRowNumber('verticaltargethigh');
        const verticalLowRow = findRowNumber('verticaltargetlow');
        const wireHighRow = findRowNumber('wirefeedspeedhigh');
        const wireLowRow = findRowNumber('wirefeedspeedlow');
        if (!passNameRow || !zoneRow) {
            console.log('❌ Critical rows missing. Skipping sheet.');
            return;
        }
        for (let col = 2; col <= totalCols; col++) {
            const passHeader = passRow.getCell(col).value;
            if (!passHeader) continue;
            const passName = sheet.getRow(passNameRow).getCell(col).value;
            const zoneName = sheet.getRow(zoneRow).getCell(col).value;
            if (!passName || !zoneName) continue; // ✅ CHECK PASS ENABLE 
            const passEnableValue = passEnableRow ? sheet.getRow(passEnableRow).getCell(col).value : null;
            if (!passEnableValue || passEnableValue.toString().toLowerCase() !== 'yes') {
                continue; // ❌ Skip this pass/zone completely
            }
            const getVal = (rowNum) => rowNum ? sheet.getRow(rowNum).getCell(col).value : null;
            const travelHigh = getVal(travelHighRow);
            const travelLow = getVal(travelLowRow);
            const oscHigh = getVal(oscHighRow);
            const oscLow = getVal(oscLowRow);
            const verticalHigh = getVal(verticalHighRow);
            const verticalLow = getVal(verticalLowRow);
            const wireHigh = getVal(wireHighRow);
            const wireLow = getVal(wireLowRow);
            if (travelHigh != null && travelLow != null) {
                finalData.push(['Travel Speed', passName, zoneName, travelLow, travelHigh]);
            }
            if (oscHigh != null && oscLow != null) {
                finalData.push(['Oscillation Width', passName, zoneName, oscLow, oscHigh]);
            }
            if (verticalHigh != null && verticalLow != null) {
                finalData.push(['Volts (V)', passName, zoneName, verticalLow, verticalHigh]);
            }
            if (wireHigh != null && wireLow != null) {
                finalData.push(['Wire Speed', passName, zoneName, wireLow, wireHigh]);
            }
        }
    }
    async createOutput(data) {
        console.log('📄 Creating 3-Level Hierarchical Excel...');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Zone Level');
        // ----------------------------- // 1. Fixed Parameter Order (ALWAYS SHOWN) // -----------------------------
        const fixedParameters = ['Current (A)', 'Volts (V)', 'Wire Speed', 'Travel Speed', 'True Energy', 'Heat', 'Oscillation Width'];
        // ----------------------------- // 2. Group data by Pass → Zone → Parameter // ----------------------------- 
        const passMap = {};
        data.forEach(([parameter, pass, zone, min, max]) => {
            if (!passMap[pass]) passMap[pass] = {};
            if (!passMap[pass][zone]) passMap[pass][zone] = {};
            passMap[pass][zone][parameter] = {
                min,
                max
            };
        });
        const passes = Object.keys(passMap);
        if (!passes.length) {
            console.log('⚠ No enabled passes found.');
            return;
        } // ----------------------------- // 3. Build Header Rows // -----------------------------
        const headerRow1 = ['Parameter'];
        const headerRow2 = [''];
        const headerRow3 = [''];
        passes.forEach(pass => {
            const zones = Object.keys(passMap[pass]);
            headerRow1.push(pass);
            for (let i = 1; i < zones.length * 2; i++) {
                headerRow1.push(null);
            }
            zones.forEach(zone => {
                headerRow2.push(zone);
                headerRow2.push(null);
            });
            zones.forEach(() => {
                headerRow3.push('Min');
                headerRow3.push('Max');
            });
        });
        sheet.addRow(headerRow1);
        sheet.addRow(headerRow2);
        sheet.addRow(headerRow3);
        // ----------------------------- // 4. Merge Pass Headers // ----------------------------- 
        let colIndex = 2;
        passes.forEach(pass => {
            const zoneCount = Object.keys(passMap[pass]).length;
            const span = zoneCount * 2;
            sheet.mergeCells(1, colIndex, 1, colIndex + span - 1);
            colIndex += span;
        });
        // Merge Zone Headers
        let zoneCol = 2;
        passes.forEach(pass => {
            const zones = Object.keys(passMap[pass]);
            zones.forEach(() => {
                sheet.mergeCells(2, zoneCol, 2, zoneCol + 1);
                zoneCol += 2;
            });

        }); // Merge Parameter Column 
        sheet.mergeCells(1, 1, 3, 1);
        // ----------------------------- // 5. Insert Fixed Parameter Rows // -----------------------------
        fixedParameters.forEach(parameter => {
            const row = [parameter];
            passes.forEach(pass => {
                const zones = Object.keys(passMap[pass]);
                zones.forEach(zone => {
                    const record = passMap[pass][zone]?.[parameter];
                    row.push(record?.min ?? '');
                    row.push(record?.max ?? '');
                });
            });
            sheet.addRow(row);
        }); // ----------------------------- // 6. Styling // ----------------------------- 
        sheet.getRow(1).font = {
            bold: true
        };
        sheet.getRow(2).font = {
            bold: true
        };
        sheet.getRow(3).font = {
            bold: true
        };
        sheet.columns.forEach(col => col.width = 18);
        // ===================================================== // PASS LEVEL SHEET (MERGED TORCHES) // ===================================================== 
        const passSheet = workbook.addWorksheet('Pass Level');
        // ---------------------------------- // Step 1: Group by BASE PASS NAME // ---------------------------------- 
        const basePassMap = {};
        Object.keys(passMap).forEach(fullPassName => {
            // Extract base name (remove trailing number) 
            const baseName = fullPassName.replace(/\s*\d+$/, '').trim();
            if (!basePassMap[baseName]) {
                basePassMap[baseName] = {};
            }
            const zones = Object.keys(passMap[fullPassName]);
            zones.forEach(zone => {
                Object.keys(passMap[fullPassName][zone]).forEach(parameter => {
                    const record = passMap[fullPassName][zone][parameter];
                    if (!basePassMap[baseName][parameter]) {
                        basePassMap[baseName][parameter] = {
                            mins: [],
                            maxs: []
                        };
                    }
                    if (record.min !== '' && record.min !== undefined) basePassMap[baseName][parameter].mins.push(Number(record.min));
                    if (record.max !== '' && record.max !== undefined) basePassMap[baseName][parameter].maxs.push(Number(record.max));
                });
            });
        });
        const basePasses = Object.keys(basePassMap);
        // ---------------------------------- // Step 2: Create Header // ---------------------------------- 
        const passHeader = ['Parameter'];
        basePasses.forEach(pass => {
            passHeader.push(`${pass} Min`);
            passHeader.push(`${pass} Max`);
        });
        passSheet.addRow(passHeader);
        passSheet.getRow(1).font = {
            bold: true
        };
        // ---------------------------------- // Step 3: Insert Rows // ---------------------------------- 
        fixedParameters.forEach(parameter => {
            const row = [parameter];
            basePasses.forEach(pass => {
                const paramData = basePassMap[pass][parameter];
                if (paramData) {
                    const passMin = Math.min(...paramData.mins);
                    const passMax = Math.max(...paramData.maxs);
                    row.push(passMin);
                    row.push(passMax);
                } else {
                    row.push('');
                    row.push('');
                }
            });
            passSheet.addRow(row);
        });
        // Adjust column width
        passSheet.columns.forEach(col => col.width = 18);
        await workbook.xlsx.writeFile(this.outputPath);
        console.log(`✅3 - Level Hierarchical Excel saved at: $ {
            this.outputPath
        }`);
    }
}
module.exports = StatusConfigCompare;
