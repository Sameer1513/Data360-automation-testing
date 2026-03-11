const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class StatusConfigCompare {
    constructor(inputFilePath, uiData = null) {
        this.inputFilePath = inputFilePath;
        this.uiData = uiData; // UI extracted data
        // Base exports directory - only reference, actual creation in run()
        this.baseExportDir = path.join(process.cwd(), 'exports');
    }

    // Initialize export directory only when needed
    initializeExportDir() {
        // New folder for StatusConfig comparison
        this.exportDir = path.join(
            this.baseExportDir,
            'StatusConfig Compared with WeldParam'
        );

        // Create folder if it does not exist
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }

        // Excel output path
        this.outputPath = path.join(
            this.exportDir,
            `StatusConfigCompare_${Date.now()}.xlsx`
        );
    }

    async addComparisonSheet() {

        if (!this.uiData) {
            console.log('⚠ No UI data provided. Skipping comparison.');
            return;
        }

        console.log('🔍 Creating Styled Comparison Sheet...');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.outputPath);

        const passSheet = workbook.getWorksheet('Pass Level (CSV)');
        if (!passSheet) {
            console.log('❌ Pass Level sheet not found.');
            return;
        }

        const comparisonSheet = workbook.addWorksheet('Comparison');

        // Header
        const headerRow = passSheet.getRow(1);
        const headers = ['Source'];
        for (let col = 1; col <= headerRow.cellCount; col++) {
            headers.push(headerRow.getCell(col).value);
        }
        comparisonSheet.addRow(headers);
        comparisonSheet.getRow(1).font = {
            bold: true
        };

        // Normalize helpers
        const normalizeParam = (name) => {
            if (!name) return '';
            return name.toString().toLowerCase()
                .replace(/\(.*?\)/g, '')
                .replace(/\s+/g, '')
                .trim();
        };

        const normalizeValue = (val) => {

            // 🔥 Treat empty as ZERO during comparison
            if (val === null || val === undefined || val === '') {
                return '0';
            }

            const num = Number(val);

            // If numeric → normalize everything like 0, 0.0, 0.00 → "0"
            if (!isNaN(num)) {
                return num.toString();
            }

            return val.toString().toLowerCase();
        };

        // Build UI Map
        const uiMap = {};
        this.uiData.gridData.rows.forEach(row => {
            const normalized = normalizeParam(row[0]);
            uiMap[normalized] = row.slice(1);
        });

        // Compare row by row
        for (let row = 2; row <= passSheet.rowCount; row++) {

            const parameter = passSheet.getRow(row).getCell(1).value;
            if (!parameter) continue;

            const normalized = normalizeParam(parameter);
            const uiValues = uiMap[normalized];
            if (!uiValues) continue;

            const csvValues = [];
            for (let col = 2; col <= passSheet.columnCount; col++) {
                csvValues.push(passSheet.getRow(row).getCell(col).value);
            }

            const csvRow = ['CSV', parameter];
            const uiRow = ['UI', parameter];
            let rowMismatch = false;

            const maxLength = Math.max(csvValues.length, uiValues.length);

            for (let i = 0; i < maxLength; i++) {

                const csvVal = csvValues[i] ?? '';
                const uiVal = uiValues[i] ?? '';

                csvRow.push(csvVal);
                uiRow.push(uiVal);
            }

            const csvExcelRow = comparisonSheet.addRow(csvRow);
            const uiExcelRow = comparisonSheet.addRow(uiRow);

            // Style cells
            for (let col = 3; col <= csvRow.length; col++) {

                const csvCell = csvExcelRow.getCell(col);
                const uiCell = uiExcelRow.getCell(col);

                // Force uniform alignment
                csvCell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                uiCell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
                const isMatch =
                    normalizeValue(csvCell.value) === normalizeValue(uiCell.value);

                if (!isMatch) {
                    // Highlight ONLY mismatches in red
                    csvCell.fill = uiCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: {
                            argb: 'FFFFC7CE'
                        }
                    };

                    csvCell.font = uiCell.font = {
                        color: {
                            argb: 'FF9C0006'
                        }
                    };
                }
            }

            comparisonSheet.addRow([]); // spacer row
        }

        comparisonSheet.columns.forEach(col => col.width = 18);


        await workbook.xlsx.writeFile(this.outputPath);

        console.log('✅ Styled Comparison Sheet Added Successfully');
    }
    async run() {
        // Initialize export directory only when needed
        this.initializeExportDir();
        
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
        const weldingProcessRow = findRowNumber('weldingprocess');
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
            const weldingProcess = weldingProcessRow ?
                sheet.getRow(weldingProcessRow).getCell(col).value :
                null;

            const processType = weldingProcess ?
                weldingProcess.toString().toLowerCase().trim() :
                '';
            const wireHigh = getVal(wireHighRow);
            const wireLow = getVal(wireLowRow);
            if (travelHigh != null && travelLow != null) {
                finalData.push(['Travel Speed', passName, zoneName, travelLow, travelHigh]);
            }
            if (oscHigh != null && oscLow != null) {
                finalData.push(['Oscillation Width', passName, zoneName, oscLow, oscHigh]);
            }
            if (verticalHigh != null && verticalLow != null) {

                if (processType.includes('short')) {

                    // SHORT ARC → Vertical Target values are CURRENT
                    finalData.push(['Current (A)', passName, zoneName, verticalLow, verticalHigh]);

                    // Do NOT push Volts for short arc

                } else if (processType.includes('pulse')) {

                    // PULSE ARC → Vertical Target values are VOLTS
                    finalData.push(['Volts (V)', passName, zoneName, verticalLow, verticalHigh]);

                } else {

                    // Default → treat as Volts
                    finalData.push(['Volts (V)', passName, zoneName, verticalLow, verticalHigh]);
                }
            }
            if (wireHigh != null && wireLow != null) {
                finalData.push(['Wire Speed', passName, zoneName, wireLow, wireHigh]);
            }
        }
    }
    async createOutput(data) {
        console.log('📄 Creating 3-Level Hierarchical Excel...');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Zone Level (CSV)');
        // ----------------------------- // 1. Fixed Parameter Order (ALWAYS SHOWN) // -----------------------------
        const fixedParameters = ['Current (A)', 'Volts (V)', 'Wire Speed', 'Travel Speed', 'True Energy', 'Heat', 'Oscillation Width'];
        // ----------------------------- // 2. Group data by Pass → Zone → Parameter // ----------------------------- 
        const passMap = {};
        data.forEach(([parameter, pass, zone, min, max]) => {
            if (!passMap[pass]) passMap[pass] = {};
            if (!passMap[pass][zone]) passMap[pass][zone] = {};
            const minVal = Number(min);
            const maxVal = Number(max);

            if (!passMap[pass][zone][parameter]) {
                passMap[pass][zone][parameter] = {
                    min: minVal,
                    max: maxVal
                };
            } else {
                passMap[pass][zone][parameter].min =
                    Math.min(passMap[pass][zone][parameter].min, minVal);

                passMap[pass][zone][parameter].max =
                    Math.max(passMap[pass][zone][parameter].max, maxVal);
            }
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

                // Detect if this pass contains Short Arc Current
                const isShortArcPass = zones.some(zone => {
                    const record = passMap[pass][zone]?.['Current (A)'];
                    return record !== undefined;
                });


                if (parameter === 'Current (A)' && isShortArcPass) {

                    const mins = [];
                    const maxs = [];

                    zones.forEach(zone => {
                        const record = passMap[pass][zone]?.[parameter];
                        if (record) {
                            const minVal = Number(record.min);
                            const maxVal = Number(record.max);

                            if (!isNaN(minVal)) mins.push(minVal);
                            if (!isNaN(maxVal)) maxs.push(maxVal);
                        }
                    });

                    const aggregatedMin = mins.length ? Math.min(...mins) : '';
                    const aggregatedMax = maxs.length ? Math.max(...maxs) : '';

                    //  Apply same aggregated values to ALL zones
                    zones.forEach(() => {
                        row.push(aggregatedMin);
                        row.push(aggregatedMax);
                    });

                } else {

                    // Default behavior (per-zone)
                    zones.forEach(zone => {
                        const record = passMap[pass][zone]?.[parameter];
                        row.push(record?.min ?? '');
                        row.push(record?.max ?? '');
                    });

                }

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
        // Apply uniform alignment to Zone Level sheet
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
            });
        });
        // ===================================================== // PASS LEVEL SHEET (MERGED TORCHES) // ===================================================== 
        const passSheet = workbook.addWorksheet('Pass Level (CSV)');
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
                    const minVal = Number(record.min);
                    const maxVal = Number(record.max);

                    if (!isNaN(minVal) && isFinite(minVal)) {
                        basePassMap[baseName][parameter].mins.push(minVal);
                    }

                    if (!isNaN(maxVal) && isFinite(maxVal)) {
                        basePassMap[baseName][parameter].maxs.push(maxVal);
                    }
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

                if (paramData && paramData.mins.length && paramData.maxs.length) {

                    // Special logic ONLY for Current (A)
                    if (parameter === 'Current (A)') {

                        const passMin = Math.min(...paramData.mins);
                        const passMax = Math.max(...paramData.maxs);

                        row.push(passMin);
                        row.push(passMax);

                    } else {

                        const passMin = Math.min(...paramData.mins);
                        const passMax = Math.max(...paramData.maxs);

                        row.push(passMin);
                        row.push(passMax);
                    }

                } else {
                    row.push('');
                    row.push('');
                }

            });

            passSheet.addRow(row);
        });
        // Adjust column width
        passSheet.columns.forEach(col => col.width = 18);
        // Apply uniform alignment to Pass Level sheet
        passSheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle'
                };
            });
        });
        // =====================================================
        // ADD UI SHEETS
        // =====================================================

        if (this.uiData) {

            // Weld Details Sheet
            const weldSheet = workbook.addWorksheet('Weld_Details (UI)');
            weldSheet.addRow(['Field', 'Value']);
            weldSheet.getRow(1).font = {
                bold: true
            };

            Object.entries(this.uiData.weldDetails).forEach(([key, value]) => {
                weldSheet.addRow([key, value]);
            });

            // Status Config Parameters Sheet
            const uiSheet = workbook.addWorksheet('Status_Config_Parameters(UI)');

            uiSheet.addRow(this.uiData.gridData.headers);
            uiSheet.getRow(1).font = {
                bold: true
            };

            this.uiData.gridData.rows.forEach(row => {
                uiSheet.addRow(row);
            });

            uiSheet.views = [{
                state: 'frozen',
                ySplit: 1
            }];
        }

        await workbook.xlsx.writeFile(this.outputPath);
        console.log(`✅3 - Level Hierarchical Excel saved at: $ {
            this.outputPath
        }`);
    }
}
module.exports = StatusConfigCompare;