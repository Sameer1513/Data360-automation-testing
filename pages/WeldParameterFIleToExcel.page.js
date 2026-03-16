const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const xml2js = require('xml2js');
const { parse } = require('csv-parse/sync');
 
class WeldParametersCsvToExcel {
  constructor(inputFile) {
  this.csvPath = path.join(process.cwd(), inputFile);
 
  // Base exports directory
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
      const zones = Object.keys(passMap[pass]).sort();
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
      const zones = Object.keys(passMap[pass]).sort();
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
        const zones = Object.keys(passMap[pass]).sort();
 
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
    const fixedParameters = ['Current (A)', 'Volts (V)', 'Wire Speed', 'Travel Speed', 'True Energy', 'Heat', 'Oscillation Width'];
 
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
 
 
class WeldParametersXmlToExcel {
 
    constructor(inputFile) {
 
        this.xmlPath = path.join(process.cwd(), inputFile);
 
        // Base exports folder
        this.baseExportDir = path.join(process.cwd(), 'exports');
 
        if (!fs.existsSync(this.baseExportDir)) {
            fs.mkdirSync(this.baseExportDir, {
                recursive: true
            });
        }
 
        // 🔹 XML specific folder
        this.exportDir = path.join(this.baseExportDir, 'WeldParametersXmlToExcel');
 
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, {
                recursive: true
            });
        }
 
        // Output Excel file
        this.outputPath = path.join(this.exportDir, 'WeldParametersXmlToExcel.xlsx');
    }
 
    async run() {
 
        console.log("📥 Reading XML...");
 
        const xmlData = fs.readFileSync(this.xmlPath, 'utf8');
 
        const parser = new xml2js.Parser({
            explicitArray: false
        });
 
        const parsed = await parser.parseStringPromise(xmlData);
 
        let variables = parsed?.crcEvansData?.data?.variable || [];
 
if (!Array.isArray(variables)) {
    variables = [variables];
}
 
 
        //---------------------------------------
// EXTRACT JOB PARAMETERS FROM VIEW
//---------------------------------------
 
console.log("📊 Extracting Job Parameters...");
 
// Get Job Parameter view
const jobView = parsed?.crcEvansData?.views?.view?.find(
  v => v.$?.typeName === "JOB PARAMETERS"
);
 
if (!jobView) {
  console.log("⚠️ JOB PARAMETERS view not found");
}
 
const sequenceVars = jobView?.sequence?.variable || [];
 
// Ensure array
const jobVariables = Array.isArray(sequenceVars) ? sequenceVars : [sequenceVars];
 
// Map values from <data>
const dataVariables = parsed?.crcEvansData?.data?.variable || [];
 
const dataMap = {};
 
dataVariables.forEach(v => {
 
  const name = v.$?.internalName;
 
  if (!name) return;
 
  const values = Array.isArray(v.value) ? v.value : [v.value];
 
  const val = values[0]?.fileData;
 
  dataMap[name] = val;
});
 
// Build Job Parameters
const jobParams = [];
 
jobVariables.forEach(v => {
 
  const internalName = v.$?.internalName;
  const displayName = v._ || internalName;
 
  const value = dataMap[internalName] ?? "";
 
  jobParams.push({
    name: displayName,
    value: value
  });
});
 
 
 
console.log(`✅ Job Parameters extracted: ${jobParams.length}`);
        //---------------------------------------
        // BUILD VARIABLE MAP
        //---------------------------------------
 
        const variableMap = {};
 
        for (const v of variables) {
 
            const name = v.$.internalName;
 
            if (!v.value) continue;
 
            const values = Array.isArray(v.value) ? v.value : [v.value];
 
            variableMap[name] = {};
 
            for (const val of values) {
 
                const group = val.$.groupName;
                const data = val.fileData;
 
                variableMap[name][group] = data;
            }
        }
 
        //---------------------------------------
// HELPER: GET VALUE FROM VARIABLE MAP
//---------------------------------------
 
function getVal(varName, group) {
    return variableMap?.[varName]?.[group] ?? "";
}
 
        //---------------------------------------
        // GET GROUP LIST
        //---------------------------------------
 
        const groups = Object.keys(variableMap.TvSdLoL || {}).sort();
 
        //---------------------------------------
// BUILD PASS GROUP STRUCTURE FROM VIEW
//---------------------------------------
 
const weldView = parsed?.crcEvansData?.views?.view?.find(
    v => v.$?.typeName === "WELD PARAMETERS"
);
 
const passGroups = [];
 
const groupLevel0 = weldView.groupLevel0 || [];
 
groupLevel0.forEach(g0 => {
 
    const passLabel = g0.$.displayName;
 
    const lead = g0.groupLevel1[0].$.internalName;
    const trail = g0.groupLevel1[1].$.internalName;
 
    passGroups.push({
        passLabel,
        lead,
        trail
    });
});
 
//---------------------------------------
// BUILD ZONE DISPLAY NAME MAP
//---------------------------------------
 
const zoneDisplayMap = {};
 
weldView.groupLevel0.forEach(pass => {
 
    const zones = pass.groupLevel1 || [];
 
    zones.forEach(z => {
        const internal = z.$.internalName;
        const display = z.$.displayName;
 
        zoneDisplayMap[internal] = display;
    });
 
});
 
//---------------------------------------
// GET ALL WELD PARAMETER VARIABLES
//---------------------------------------
 
const weldVariables = weldView.sequence.variable;
 
const parameterList = weldVariables.map(v => ({
    name: v._,
    internalName: v.$.internalName
}));
//---------------------------------------
// CREATE EXCEL WORKBOOK
//---------------------------------------
 
const workbook = new ExcelJS.Workbook();
 
const jobSheet = workbook.addWorksheet("Job Parameters");
const weldSheet = workbook.addWorksheet("Weld Parameters");
 
 
//---------------------------------------
// BUILD HEADER ROWS
//---------------------------------------
 
const header1 = ["Parameter"];
const header2 = [""];
 
passGroups.forEach(pg => {
 
    // Pass group name (example: "1 : HPTP : 20")
    header1.push(pg.passLabel, null);
 
    // Lead / Trail
    header2.push("LEAD", "TRAIL");
});
 
weldSheet.addRow(header1);
weldSheet.addRow(header2);
 
//---------------------------------------
// WRITE ALL PARAMETERS
//---------------------------------------
 
parameterList.forEach(param => {
 
    const row = [param.name];
 
    passGroups.forEach(pg => {
 
        row.push(getVal(param.internalName, pg.lead));
        row.push(getVal(param.internalName, pg.trail));
 
    });
 
    weldSheet.addRow(row);
});
 
//---------------------------------------
// BUILD ZONE DATA FROM SHEET 2
//---------------------------------------
 
const zoneData = [];
 
const passRow = weldSheet.getRow(3);     // Pass Name
const zoneRow = weldSheet.getRow(4);     // Zone Name
//---------------------------------------
// FIND "ZONE ENABLE" ROW DYNAMICALLY
//---------------------------------------
 
let zoneEnableRow = null;
 
weldSheet.eachRow((row) => {
 
    const name = row.getCell(1).value;
 
    if (name && name.toString().toLowerCase().includes("zone enable")) {
        zoneEnableRow = row;
    }
 
});
 
if (!zoneEnableRow) {
    console.log("⚠️ Zone Enable row not found");
}
 
weldSheet.eachRow((row, rowNumber) => {
 
    if (rowNumber <= 4) return;
 
    const paramName = row.getCell(1).value;
 
    if (!paramName) return;
 
    const isMax = paramName.toLowerCase().includes("high");
    const isMin = paramName.toLowerCase().includes("low");
 
    if (!isMax && !isMin) return;
 
    const cleanParam = paramName
        .replace(/high limit/i, "")
        .replace(/low limit/i, "")
        .trim();
 
    for (let col = 2; col <= weldSheet.columnCount; col++) {
 
    const pass = passRow.getCell(col).value;
    const zone = zoneRow.getCell(col).value;
    const value = row.getCell(col).value;
 
    const zoneEnabled = zoneEnableRow.getCell(col).value;
 
    // Skip disabled zones
    if (zoneEnabled !== "Enabled") continue;
 
    if (!pass || !zone || value === null || value === "") continue;
 
        zoneData.push({
            pass,
            zone,
            parameter: cleanParam,
            type: isMin ? "min" : "max",
            value
        });
    }
 
});
 
//---------------------------------------
// STRUCTURE DATA
//---------------------------------------
 
const structured = [];
const map = {};
 
zoneData.forEach(r => {
 
    const key = `${r.pass}_${r.zone}_${r.parameter}`;
 
    if (!map[key]) {
        map[key] = {
            pass: r.pass,
            zone: r.zone,
            parameter: r.parameter,
            min: "",
            max: ""
        };
    }
 
    if (r.type === "min") map[key].min = r.value;
    if (r.type === "max") map[key].max = r.value;
 
});
 
Object.values(map).forEach(v => structured.push(v));
 
//---------------------------------------
// NORMALIZE PARAMETER NAMES
//---------------------------------------
 
const parameterRenameMap = {
    "Vertical Target Amps": "Current",
    "Vertical Target Volts": "Volts",
    "Wire Feed Speed": "Wire Speed",
    "Travel Speed": "Travel Speed",
    "Oscillation Width": "Oscillation Width"
};
 
// parameters to ignore
const ignoreParams = [
    "Vertical Target Resistance"
];
 
structured.forEach(r => {
 
    if (parameterRenameMap[r.parameter]) {
        r.parameter = parameterRenameMap[r.parameter];
    }
 
});
 
//---------------------------------------
// FILTER PARAMETERS
//---------------------------------------
 
let cleanedStructured = structured.filter(r =>
    !ignoreParams.includes(r.parameter)
);
 
await this.createZoneLevelSheet(workbook, cleanedStructured);
await this.createPassLevelSheet(workbook, cleanedStructured);
 
//---------------------------------------
// MERGE PASS HEADERS
//---------------------------------------
 
let col = 2;
 
passGroups.forEach(() => {
 
    weldSheet.mergeCells(1, col, 1, col + 1);
 
    col += 2;
});
 
 
weldSheet.columns.forEach(col => {
    col.width = 18;
});
 
weldSheet.eachRow(row => {
    row.eachCell(cell => {
        cell.alignment = {
            horizontal: "center",
            vertical: "middle"
        };
    });
});
 
        //---------------------------------------
        // WRITE JOB PARAMETERS SHEET
        //---------------------------------------
 
        jobSheet.columns = [{
                header: "Parameter",
                key: "name",
                width: 40
            },
            {
                header: "Value",
                key: "value",
                width: 25
            }
        ];
 
        jobParams.forEach(param => {
            jobSheet.addRow(param);
        });
 
        jobSheet.getRow(1).font = {
            bold: true
        };
 
        jobSheet.eachRow(row => {
            row.eachCell(cell => {
                cell.alignment = {
                    horizontal: "center",
                    vertical: "middle"
                };
            });
        });
 
 
        //---------------------------------------
        // SAVE FILE
        //---------------------------------------
 
        await workbook.xlsx.writeFile(this.outputPath);
 
        console.log(`✅ XML Converted to Excel → ${this.outputPath}`);
 
        return this.outputPath;
    }
 
    async createZoneLevelSheet(workbook, data) {
 
        console.log("📊 Creating Zone Level (XML) sheet...");
 
        const sheet = workbook.addWorksheet("Zone Level (XML)");
       
 
        const passMap = {};
 
data.forEach(row => {
 
    const { pass, zone, parameter, min, max } = row;
 
    if (!passMap[pass]) passMap[pass] = {};
    if (!passMap[pass][zone]) passMap[pass][zone] = {};
 
    passMap[pass][zone][parameter] = {
        min,
        max
    };
 
});
        const passes = Object.keys(passMap);
 
        if (!passes.length) {
            console.log("⚠️ No data for Zone Level sheet");
            return;
        }
       
//-----------------------------------
// HEADERS
//-----------------------------------
 
const header1 = ["Parameter"];
const header2 = [""];
const header3 = [""];
 
passes.forEach(pass => {
 
    const zones = Object.keys(passMap[pass]).sort();
 
    // Pass header
    header1.push(pass);
 
    for (let i = 1; i < zones.length * 2; i++) {
        header1.push(null);
    }
 
    // Zone headers
    zones.forEach(zone => {
        header2.push(zone);
        header2.push(null);
    });
 
    // Min / Max
    zones.forEach(() => {
        header3.push("Min");
        header3.push("Max");
    });
 
});
 
// ⭐ ADD THESE LINES
sheet.addRow(header1);
sheet.addRow(header2);
sheet.addRow(header3);
        //-----------------------------------
        // MERGING
        //-----------------------------------
 
        let colIndex = 2;
 
        passes.forEach(pass => {
 
            const zoneCount = Object.keys(passMap[pass]).length;
            const span = zoneCount * 2;
 
            sheet.mergeCells(1, colIndex, 1, colIndex + span - 1);
 
            colIndex += span;
        });
 
        let zoneCol = 2;
 
        passes.forEach(pass => {
 
            const zones = Object.keys(passMap[pass]).sort();
 
            zones.forEach(() => {
                sheet.mergeCells(2, zoneCol, 2, zoneCol + 1);
                zoneCol += 2;
            });
        });
 
        sheet.mergeCells(1, 1, 3, 1);
 
        //-----------------------------------
        // DATA ROWS
        //-----------------------------------
 
        //-----------------------------------
// PARAMETER LIST
//-----------------------------------
 
const parameters = [
    "Current",
    "Volts",
    "Travel Speed",
    "Oscillation Width",
    "Wire Speed",
    "Heat",
    "True Energy"
];
 
        parameters.forEach(parameter => {
 
            const row = [parameter];
 
            passes.forEach(pass => {
 
                const zones = Object.keys(passMap[pass]).sort();
 
                zones.forEach(zone => {
 
                    const record = passMap[pass][zone][parameter];
 
                    row.push(record?.min ?? "");
                    row.push(record?.max ?? "");
                });
            });
 
            sheet.addRow(row);
        });
 
        //-----------------------------------
        // STYLE
        //-----------------------------------
 
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
 
        sheet.eachRow(row => {
            row.eachCell(cell => {
                cell.alignment = {
                    horizontal: "center",
                    vertical: "middle"
                };
            });
        });
 
        console.log("✅ Zone Level (XML) sheet created");
    }
 
 
        async createPassLevelSheet(workbook, data) {
 
    console.log("📊 Creating Pass Level sheet...");
 
    const sheet = workbook.addWorksheet("Pass Level");
 
    //-----------------------------------
    // BUILD PASS STRUCTURE
    //-----------------------------------
 
    const passMap = {};
 
    data.forEach(row => {
 
        const { pass, parameter } = row;
 
        const min = parseFloat(row.min);
        const max = parseFloat(row.max);
 
        if (!passMap[pass]) passMap[pass] = {};
        if (!passMap[pass][parameter]) {
 
            passMap[pass][parameter] = {
                min: Infinity,
                max: -Infinity
            };
        }
 
        if (!isNaN(min)) {
            passMap[pass][parameter].min =
                Math.min(passMap[pass][parameter].min, min);
        }
 
        if (!isNaN(max)) {
            passMap[pass][parameter].max =
                Math.max(passMap[pass][parameter].max, max);
        }
 
    });
 
    //-----------------------------------
    // PASS LIST
    //-----------------------------------
 
    const passes = Object.keys(passMap);
 
    if (!passes.length) {
        console.log("⚠️ No pass data found");
        return;
    }
 
    //-----------------------------------
    // PARAMETERS
    //-----------------------------------
 
    const parameters = [
        "Current",
        "Volts",
        "Travel Speed",
        "Oscillation Width",
        "Wire Speed",
        "Heat",
        "True Energy"
    ];
 
    //-----------------------------------
    // HEADERS
    //-----------------------------------
 
    const header1 = ["Parameter"];
    const header2 = [""];
 
    passes.forEach(pass => {
 
        header1.push(pass, null);
        header2.push("Min", "Max");
 
    });
 
    sheet.addRow(header1);
    sheet.addRow(header2);
 
    //-----------------------------------
    // MERGE PASS HEADERS
    //-----------------------------------
 
    let col = 2;
 
    passes.forEach(() => {
 
        sheet.mergeCells(1, col, 1, col + 1);
        col += 2;
 
    });
 
    //-----------------------------------
    // WRITE DATA
    //-----------------------------------
 
    parameters.forEach(parameter => {
 
        const row = [parameter];
 
        passes.forEach(pass => {
 
            const record = passMap[pass][parameter];
 
            row.push(record?.min === Infinity ? "" : record?.min);
            row.push(record?.max === -Infinity ? "" : record?.max);
 
        });
 
        sheet.addRow(row);
 
    });
 
    //-----------------------------------
    // STYLING
    //-----------------------------------
 
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { bold: true };
 
    sheet.columns.forEach(col => col.width = 18);
 
    sheet.eachRow(row => {
 
        row.eachCell(cell => {
 
            cell.alignment = {
                horizontal: "center",
                vertical: "middle"
            };
 
        });
 
    });
 
    console.log("✅ Pass Level sheet created");
}
   
}
module.exports = {
    WeldParametersCsvToExcel,
    WeldParametersXmlToExcel
};
 