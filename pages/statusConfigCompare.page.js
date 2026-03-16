const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class StatusConfigCompare {

constructor(weldParamExcelPath, statusPassExcelPath, weldSheetName) {

    this.weldParamExcelPath = weldParamExcelPath;
    this.statusPassExcelPath = statusPassExcelPath;
    this.weldSheetName = weldSheetName;

    this.baseExportDir = path.join(process.cwd(), 'exports');
}

initializeExportDir() {

    this.exportDir = path.join(
        this.baseExportDir,
        'StatusConfig Compared with WeldParam'
    );

    if (!fs.existsSync(this.exportDir)) {
        fs.mkdirSync(this.exportDir, { recursive: true });
    }

    this.outputPath = path.join(
        this.exportDir,
        `StatusConfigCompare_${Date.now()}.xlsx`
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

    this.initializeExportDir();

    console.log('🚀 Running Status Config Comparison');

    const csvWorkbook = new ExcelJS.Workbook();
    await csvWorkbook.xlsx.readFile(this.weldParamExcelPath);

    const uiWorkbook = new ExcelJS.Workbook();
    await uiWorkbook.xlsx.readFile(this.statusPassExcelPath);

    const passSheet = csvWorkbook.getWorksheet(this.weldSheetName);
    const uiSheet = uiWorkbook.getWorksheet('Status_Config_UI');

    if (!passSheet) {
    console.log(`❌ Weld parameter sheet not found: ${this.weldSheetName}`);
    return;
}

if (!uiSheet) {
    console.log('❌ UI sheet not found: Status_Config_UI');
    return;
}

    const workbook = new ExcelJS.Workbook();
    const comparisonSheet = workbook.addWorksheet('Comparison');

    const headerRow = passSheet.getRow(1);

    const headers = ['Source'];

    headerRow.eachCell(cell => {
        headers.push(cell.value);
    });

    comparisonSheet.addRow(headers);
    comparisonSheet.getRow(1).font = { bold: true };

    const uiMap = {};

    uiSheet.eachRow((row, rowNumber) => {

        if (rowNumber === 1) return;

        const param = row.getCell(1).value;

        const normalized = this.normalizeParam(param);

        const values = [];

        row.eachCell((cell, colNumber) => {

            if (colNumber === 1) return;

            values.push(cell.value);
        });

        uiMap[normalized] = values;
    });

    for (let row = 2; row <= passSheet.rowCount; row++) {

        const parameter = passSheet.getRow(row).getCell(1).value;

        if (!parameter) continue;

        const normalized = this.normalizeParam(parameter);

        const uiValues = uiMap[normalized];

        if (!uiValues) continue;

        const csvValues = [];

        for (let col = 2; col <= passSheet.columnCount; col++) {

            csvValues.push(passSheet.getRow(row).getCell(col).value);
        }

        const csvRow = ['Weld Parameter File', parameter];
        const uiRow = ['UI', parameter];

        const maxLength = Math.max(csvValues.length, uiValues.length);

        for (let i = 0; i < maxLength; i++) {

            const csvVal = csvValues[i] ?? '';
            const uiVal = uiValues[i] ?? '';

            csvRow.push(csvVal);
            uiRow.push(uiVal);
        }

        const csvExcelRow = comparisonSheet.addRow(csvRow);
        const uiExcelRow = comparisonSheet.addRow(uiRow);

        for (let col = 3; col <= csvRow.length; col++) {

            const csvCell = csvExcelRow.getCell(col);
            const uiCell = uiExcelRow.getCell(col);

            csvCell.alignment = { horizontal: 'center', vertical: 'middle' };
            uiCell.alignment = { horizontal: 'center', vertical: 'middle' };

            const match =
                this.normalizeValue(csvCell.value) ===
                this.normalizeValue(uiCell.value);

            if (!match) {

                csvCell.fill = uiCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFC7CE' }
                };

                csvCell.font = uiCell.font = {
                    color: { argb: 'FF9C0006' }
                };
            }
        }

        comparisonSheet.addRow([]);
    }

    comparisonSheet.columns.forEach(col => col.width = 18);

    await workbook.xlsx.writeFile(this.outputPath);

    console.log(`✅ Comparison Excel created at: ${this.outputPath}`);

    return this.outputPath;
}

}

module.exports = StatusConfigCompare;