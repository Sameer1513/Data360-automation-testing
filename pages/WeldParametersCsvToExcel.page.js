const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');

class WeldParametersCsvToExcel {
  constructor() {
    this.csvPath = path.join(process.cwd(), 'test-data', 'p600z_example.csv');
    
    // Base exports directory - only reference, actual creation in run()
    this.baseExportDir = path.join(process.cwd(), 'exports');
  }

  // Initialize export directory only when needed
  initializeExportDir() {
    // Create main exports folder if missing
    if (!fs.existsSync(this.baseExportDir)) {
      fs.mkdirSync(this.baseExportDir, { recursive: true });
    }

    // 🔹 Create WeldParametersCsvToExcel subfolder
    this.exportDir = path.join(this.baseExportDir, 'WeldParametersCsvToExcel');

    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }

    // Output file inside that folder
    this.outputPath = path.join(this.exportDir, 'WeldParametersCsvToExcel.xlsx');
  }

  async run() {
    // Initialize export directory only when needed
    this.initializeExportDir();
    
    console.log('📄 Reading WeldParameters.csv...');

    const fileContent = fs.readFileSync(this.csvPath, 'utf-8');

    const records = parse(fileContent, {
      relaxColumnCount: true,
      skipEmptyLines: false,
    });

    const jobParams = [];
    const leadTorch = [];
    const trailTorch = [];

    let currentSection = 'job';

    for (const row of records) {
      const rowString = row.join(',');

      // Detect section switches
      if (rowString.includes('Lead Torch')) {
        currentSection = 'lead';
      } else if (rowString.includes('Trail Torch')) {
        currentSection = 'trail';
      }

      // Push rows into respective arrays
      if (currentSection === 'job') {
        jobParams.push(row);
      } else if (currentSection === 'lead') {
        leadTorch.push(row);
      } else if (currentSection === 'trail') {
        trailTorch.push(row);
      }
    }

    console.log('📊 Creating Excel workbook...');

    const workbook = new ExcelJS.Workbook();

    // Sheet 1 – Job Parameters
    const sheet1 = workbook.addWorksheet('Job Parameters');
    jobParams.forEach(row => sheet1.addRow(row.slice(1)));

    // Sheet 2 – Lead Torch
    const sheet2 = workbook.addWorksheet('Lead Torch');
    leadTorch.forEach(row => sheet2.addRow(row.slice(1)));

    // Sheet 3 – Trail Torch
    const sheet3 = workbook.addWorksheet('Trail Torch');
    trailTorch.forEach(row => sheet3.addRow(row.slice(1)));

    // =====================================================
    // PROCESS ZONE AND PASS LEVEL DATA
    // =====================================================

    // Process Lead Torch and Trail Torch for zone/pass data
    const leadTorchData = this.processTorchData(leadTorch, 'Lead Torch');
    const trailTorchData = this.processTorchData(trailTorch, 'Trail Torch');

    // Combine data from both torches
    const combinedData = [...leadTorchData, ...trailTorchData];

    // Create Zone Level (CSV) sheet
    await this.createZoneLevelSheet(workbook, combinedData);

    // Create Pass Level (CSV) sheet
    await this.createPassLevelSheet(workbook, combinedData);

    await workbook.xlsx.writeFile(this.outputPath);

    console.log(`✅ Excel created at: ${this.outputPath}`);

    return this.outputPath;  // 🔥 MUST RETURN THIS
  }

  /**
   * Process torch data to extract pass/zone level parameters
   */
  processTorchData(torchRows, torchName) {
    const finalData = [];

    // Find key rows by parameter name
    const rowMap = {};
    torchRows.forEach((row, index) => {
      const label = row[1]; // Parameter name is in column 1 (index 1)
      if (label) {
        rowMap[label.toString().toLowerCase().replace(/\s+/g, '').trim()] = index;
      }
    });

    const findRowNumber = (keyword) => {
      const normalizedKeyword = keyword.toString().toLowerCase().replace(/\s+/g, '').trim();
      const match = Object.keys(rowMap).find(key => key.includes(normalizedKeyword));
      return match ? rowMap[match] : null;
    };

    // Find required rows
    const passRowIndex = findRowNumber('Pass');
    const passNameRowIndex = findRowNumber('PassName');
    const passPendNameRowIndex = findRowNumber('PassPendName');
    const passEnableRowIndex = findRowNumber('PassEnable');
    const travelHighRowIndex = findRowNumber('TravelSpeedHighLimit');
    const travelLowRowIndex = findRowNumber('TravelSpeedLowLimit');
    const oscHighRowIndex = findRowNumber('OscWidthHighLimit');
    const oscLowRowIndex = findRowNumber('OscWidthLowLimit');
    const verticalHighRowIndex = findRowNumber('VerticalTargetHighLimit');
    const verticalLowRowIndex = findRowNumber('VerticalTargetLowLimit');
    const wireHighRowIndex = findRowNumber('WireFeedSpeedHighLimit');
    const wireLowRowIndex = findRowNumber('WireFeedSpeedLowLimit');
    const weldingProcessRowIndex = findRowNumber('WeldingProcess');

    if (!passRowIndex || !passNameRowIndex || !passPendNameRowIndex) {
      console.log(`⚠️ ${torchName}: Missing critical rows. Skipping.`);
      console.log(`   passRowIndex: ${passRowIndex}, passNameRowIndex: ${passNameRowIndex}, passPendNameRowIndex: ${passPendNameRowIndex}`);
      return [];
    }

    // Get the rows
    const passRow = torchRows[passRowIndex];
    const passNameRow = torchRows[passNameRowIndex];
    const passPendNameRow = torchRows[passPendNameRowIndex];
    const totalCols = passRow.length;

    console.log(`📋 ${torchName}: Processing ${totalCols - 2} passes`);

    // Process each pass (starting from column 2, as column 0 is hex code, column 1 is label)
    for (let col = 2; col < totalCols; col++) {
      // Get pass name from PassName row (e.g., Root, Fill 1, Last Fill, Cap 1)
      const passName = passNameRow[col];
      if (!passName) continue;

      // Get zone name from PassPendName row (e.g., HO, 1T, 1M, etc.)
      const zoneName = passPendNameRow?.[col];
      if (!zoneName) continue;

      // Check if pass is enabled
      const passEnableRow = passEnableRowIndex ? torchRows[passEnableRowIndex] : null;
      const passEnableValue = passEnableRow ? passEnableRow[col] : null;
      if (!passEnableValue || passEnableValue.toString().toLowerCase() !== 'yes') {
        continue; // Skip disabled passes
      }

      const getVal = (rowIndex) => rowIndex !== null ? torchRows[rowIndex]?.[col] : null;

      const travelHigh = getVal(travelHighRowIndex);
      const travelLow = getVal(travelLowRowIndex);
      const oscHigh = getVal(oscHighRowIndex);
      const oscLow = getVal(oscLowRowIndex);
      const verticalHigh = getVal(verticalHighRowIndex);
      const verticalLow = getVal(verticalLowRowIndex);
      const wireHigh = getVal(wireHighRowIndex);
      const wireLow = getVal(wireLowRowIndex);
      const weldingProcess = weldingProcessRowIndex ? getVal(weldingProcessRowIndex) : null;

      const processType = weldingProcess ? weldingProcess.toString().toLowerCase().trim() : '';

      // Add Travel Speed data
      if (travelHigh != null && travelLow != null) {
        finalData.push(['Travel Speed', passName, zoneName, travelLow, travelHigh]);
      }

      // Add Oscillation Width data
      if (oscHigh != null && oscLow != null) {
        finalData.push(['Oscillation Width', passName, zoneName, oscLow, oscHigh]);
      }

      // Add Vertical Target data (Current for Short Arc, Volts for Pulse Arc)
      if (verticalHigh != null && verticalLow != null) {
        if (processType.includes('short')) {
          // SHORT ARC → Vertical Target values are CURRENT
          finalData.push(['Current (A)', passName, zoneName, verticalLow, verticalHigh]);
        } else if (processType.includes('pulse')) {
          // PULSE ARC → Vertical Target values are VOLTS
          finalData.push(['Volts (V)', passName, zoneName, verticalLow, verticalHigh]);
        } else {
          // Default → treat as Volts
          finalData.push(['Volts (V)', passName, zoneName, verticalLow, verticalHigh]);
        }
      }

      // Add Wire Speed data
      if (wireHigh != null && wireLow != null) {
        finalData.push(['Wire Speed', passName, zoneName, wireLow, wireHigh]);
      }
    }

    console.log(`📊 ${torchName}: Extracted ${finalData.length} data rows`);
    return finalData;
  }

  /**
   * Create Zone Level (CSV) sheet with hierarchical structure
   */
  async createZoneLevelSheet(workbook, data) {
    console.log('📊 Creating Zone Level (CSV) sheet...');

    const sheet = workbook.addWorksheet('Zone Level (CSV)');

    // Fixed Parameter Order (ALWAYS SHOWN)
    const fixedParameters = ['Current (A)', 'Volts (V)', 'Wire Speed', 'Travel Speed','True Energy', 'Heat', 'Oscillation Width'];

    // Group data by Pass → Zone → Parameter
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
      console.log('⚠️ No enabled passes found for Zone Level sheet.');
      return;
    }

    // Build Header Rows
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

    // Merge Pass Headers
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
    });

    // Merge Parameter Column
    sheet.mergeCells(1, 1, 3, 1);

    // Insert Fixed Parameter Rows
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
          // Special handling for Short Arc - aggregate across zones
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
    });

    // Styling
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { bold: true };
    sheet.getRow(3).font = { bold: true };
    sheet.columns.forEach(col => col.width = 18);

    // Apply uniform alignment
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle'
        };
      });
    });

    console.log('✅ Zone Level (CSV) sheet created');
  }

  /**
   * Create Pass Level (CSV) sheet with aggregated data by base pass name
   */
  async createPassLevelSheet(workbook, data) {
    console.log('📊 Creating Pass Level (CSV) sheet...');

    const sheet = workbook.addWorksheet('Pass Level (CSV)');

    // Fixed Parameter Order
    const fixedParameters = ['Current (A)', 'Volts (V)', 'Wire Speed', 'Travel Speed', 'Oscillation Width'];

    // Group data by base pass name (remove trailing number)
    const basePassMap = {};

    data.forEach(([parameter, fullPassName, zone, min, max]) => {
      // Extract base name (remove trailing number)
      const baseName = fullPassName.replace(/\s*\d+$/, '').trim();
      if (!basePassMap[baseName]) {
        basePassMap[baseName] = {};
      }

      if (!basePassMap[baseName][parameter]) {
        basePassMap[baseName][parameter] = {
          mins: [],
          maxs: []
        };
      }

      const minVal = Number(min);
      const maxVal = Number(max);

      if (!isNaN(minVal) && isFinite(minVal)) {
        basePassMap[baseName][parameter].mins.push(minVal);
      }
      if (!isNaN(maxVal) && isFinite(maxVal)) {
        basePassMap[baseName][parameter].maxs.push(maxVal);
      }
    });

    const basePasses = Object.keys(basePassMap);
    if (!basePasses.length) {
      console.log('⚠️ No passes found for Pass Level sheet.');
      return;
    }

    // Create Header
    const passHeader = ['Parameter'];
    basePasses.forEach(pass => {
      passHeader.push(`${pass} Min`);
      passHeader.push(`${pass} Max`);
    });
    sheet.addRow(passHeader);
    sheet.getRow(1).font = { bold: true };

    // Insert rows for each parameter
    fixedParameters.forEach(parameter => {
      const row = [parameter];

      basePasses.forEach(pass => {
        const paramData = basePassMap[pass][parameter];

        if (paramData && paramData.mins.length && paramData.maxs.length) {
          const passMin = Math.min(...paramData.mins);
          const passMax = Math.max(...paramData.maxs);

          row.push(passMin);
          row.push(passMax);
        } else {
          row.push('');
          row.push('');
        }
      });

      sheet.addRow(row);
    });

    // Adjust column width
    sheet.columns.forEach(col => col.width = 18);

    // Apply uniform alignment
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle'
        };
      });
    });

    console.log('✅ Pass Level (CSV) sheet created');
  }
}

module.exports = WeldParametersCsvToExcel;

