// const fs = require('fs');
// const path = require('path');
// const ExcelJS = require('exceljs');

// class ActualDataExtractor {
//   constructor() {
//     this.inputTxtPath = path.join(__dirname, 'AUTOMATION.txt');  // ✅ tests/AUTOMATION.txt
//     this.outputDir = path.join(__dirname, '..', 'exports');      // ✅ exports/
//     this.outputFile = `ActualData_FromTxt_${Date.now()}.xlsx`;
//   }

//   parseAutomationFile() {
//     console.log('📖 Reading:', this.inputTxtPath);
//     const raw = fs.readFileSync(this.inputTxtPath, 'utf-8');
//     const lines = raw.split(/\r?\n/).filter(l => l.trim());

//     const records = [];
//     let setupData = {};

//     for (const line of lines) {
//       if (line.startsWith('{')) {
//         try {
//           const obj = JSON.parse(line);
          
//           if (obj.Record === 'S') {
//             setupData = obj;  // Store setup info
//             console.log('✅ Found Setup record');
//           } else if (obj.Record === 'T') {
//             records.push({
//               event: obj.Event,
//               time: obj.Time,
//               tilt: obj.Tilt,
//               distance: obj.Distance,
//               travel_speed: obj.Travel_speed,

//               // Lead data
//               lead_pass_name: obj.Lead_pass_name,
//               lead_volts: obj.Lead_volts,
//               lead_amps: obj.Lead_amps,
//               lead_wire_speed: obj.Lead_wire_speed,
//               lead_oscillate_width: obj.Lead_oscillate_width,
//               lead_target: obj.Lead_target,
//               lead_heat: obj.Lead_heat,

//               // Trail data
//               trail_pass_name: obj.Trail_pass_name,
//               trail_volts: obj.Trail_volts,
//               trail_amps: obj.Trail_amps,
//               trail_wire_speed: obj.Trail_wire_speed,
//               trail_oscillate_width: obj.Trail_oscillate_width,
//               trail_target: obj.Trail_target,
//               trail_heat: obj.Trail_heat,
//             });
//           }
//         } catch (e) {
//           // Skip invalid JSON
//         }
//       }
//     }

//     console.log(`✅ Parsed ${records.length} Tilt records`);
//     return { records, setupData };
//   }

//   async createExcel({ records, setupData }) {
//     const workbook = new ExcelJS.Workbook();
    
//     // Setup sheet
//     const setupSheet = workbook.addWorksheet('Setup');
//     setupSheet.addRow(Object.keys(setupData));
//     setupSheet.addRow(Object.values(setupData));

//     // Main data sheet
//     const dataSheet = workbook.addWorksheet('ActualData');
//     dataSheet.addRow([
//       'Event', 'Time', 'Tilt', 'Distance', 'Travel_speed',
//       'Lead_pass_name', 'Lead_volts', 'Lead_amps', 'Lead_wire_speed', 
//       'Lead_oscillate_width', 'Lead_target', 'Lead_heat',
//       'Trail_pass_name', 'Trail_volts', 'Trail_amps', 'Trail_wire_speed', 
//       'Trail_oscillate_width', 'Trail_target', 'Trail_heat'
//     ]);

//     records.forEach(r => {
//       dataSheet.addRow([
//         r.event, r.time, r.tilt, r.distance, r.travel_speed,
//         r.lead_pass_name, r.lead_volts, r.lead_amps, r.lead_wire_speed,
//         r.lead_oscillate_width, r.lead_target, r.lead_heat,
//         r.trail_pass_name, r.trail_volts, r.trail_amps, r.trail_wire_speed,
//         r.trail_oscillate_width, r.trail_target, r.trail_heat
//       ]);
//     });

//     const outputPath = path.join(this.outputDir, this.outputFile);
//     await workbook.xlsx.writeFile(outputPath);
//     console.log('✅ SAVED:', outputPath);
//     return outputPath;
//   }

//   async run() {
//     if (!fs.existsSync(this.inputTxtPath)) {
//       throw new Error(`❌ AUTOMATION.txt NOT FOUND in tests/ folder`);
//     }
    
//     const data = this.parseAutomationFile();
//     await this.createExcel(data);
//   }
// }

// module.exports = ActualDataExtractor;

// const fs = require('fs');
// const path = require('path');
// const ExcelJS = require('exceljs');

// class ActualDataExtractor {
//   constructor() {
//     this.inputTxtPath = path.join(__dirname, 'AUTOMATION.txt');
//     this.outputDir = path.join(__dirname, '..', 'exports');
//     this.outputFile = `ActualData_Cleaned_${Date.now()}.xlsx`;
//   }

//   parseAutomationFile() {
//     console.log('📖 Reading:', this.inputTxtPath);
//     const raw = fs.readFileSync(this.inputTxtPath, 'utf-8');
//     const lines = raw.split(/\r?\n/).filter(l => l.trim());

//     const tRecords = [];
//     let setupData = {};
//     const keysToExclude = new Set(['Record']); // Always exclude Record type

//     for (const line of lines) {
//       if (!line.startsWith('{')) continue;
//       try {
//         const obj = JSON.parse(line);
//         if (obj.Record === 'S') {
//           setupData = obj;
//         } else if (obj.Record === 'T') {
//           tRecords.push(obj);
          
//           // Logic: Check every key in this record
//           Object.keys(obj).forEach(key => {
//             const value = obj[key];
//             // If the value is an object (flower brackets), add key to exclusion list
//             if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
//               keysToExclude.add(key);
//             }
//           });
//         }
//       } catch (e) { /* skip invalid json */ }
//     }

//     if (tRecords.length === 0) throw new Error("No 'T' records found.");

//     // DYNAMIC COLUMN DISCOVERY (excluding the flower bracket keys)
//     const allKeys = new Set();
//     tRecords.forEach(rec => Object.keys(rec).forEach(k => {
//         if (!keysToExclude.has(k)) allKeys.add(k);
//     }));

//     const commonKeys = [];
//     const leadTrailSuffixes = new Set();

//     allKeys.forEach(key => {
//       if (key.startsWith('Lead_')) {
//         leadTrailSuffixes.add(key.replace('Lead_', ''));
//       } else if (key.startsWith('Trail_')) {
//         leadTrailSuffixes.add(key.replace('Trail_', ''));
//       } else {
//         commonKeys.push(key);
//       }
//     });

//     const dynamicSuffixes = Array.from(leadTrailSuffixes).sort();
//     return { tRecords, setupData, commonKeys, dynamicSuffixes };
//   }

//   async createExcel({ tRecords, setupData, commonKeys, dynamicSuffixes }) {
//     const workbook = new ExcelJS.Workbook();
    
//     // Setup Sheet
//     const setupSheet = workbook.addWorksheet('Setup');
//     setupSheet.addRow(Object.keys(setupData));
//     setupSheet.addRow(Object.values(setupData));

//     // Main Data Sheet
//     const dataSheet = workbook.addWorksheet('ActualData');
//     const headers = [...commonKeys, 'Side Type', ...dynamicSuffixes];
//     dataSheet.addRow(headers);

//     const leadRows = [];
//     const trailRows = [];

//     tRecords.forEach(rec => {
//       const commonValues = commonKeys.map(k => rec[k] ?? '');

//       // Group Leads
//       if (rec.Lead_pass_name) {
//         leadRows.push([
//           ...commonValues,
//           'LEAD',
//           ...dynamicSuffixes.map(s => rec[`Lead_${s}`] ?? '')
//         ]);
//       }

//       // Group Trails
//       if (rec.Trail_pass_name) {
//         trailRows.push([
//           ...commonValues,
//           'TRAIL',
//           ...dynamicSuffixes.map(s => rec[`Trail_${s}`] ?? '')
//         ]);
//       }
//     });

//     // Add grouped rows
//     dataSheet.addRows(leadRows);
//     dataSheet.addRows(trailRows);

//     // Styling
//     dataSheet.getRow(1).font = { bold: true };
//     dataSheet.columns.forEach(column => { column.width = 20; });

//     const outputPath = path.join(this.outputDir, this.outputFile);
//     if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    
//     await workbook.xlsx.writeFile(outputPath);
//     console.log('✅ SAVED CLEANED EXCEL:', outputPath);
//     return outputPath;
//   }

//   async run() {
//     const data = this.parseAutomationFile();
//     await this.createExcel(data);
//   }
// }

// module.exports = ActualDataExtractor;

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class ActualDataExtractor {
  constructor() {
    this.inputTxtPath = path.join(__dirname, 'AUTOMATION.txt');
    this.outputDir = path.join(__dirname, '..', 'exports');
    this.outputFile = `ActualData_Comparison_Ready_${Date.now()}.xlsx`;
    
    // Mapping for reference and potential comparison logic
    this.uiMapping = {
      'Event': 'Event',
      'Time': 'Time',
      'Tilt': 'Tilt',
      'Torch Type': 'Torch Type', // Renamed from Side Type
      'pass_name': 'Pass',
      'distance': 'Distance (in)',
      'travel_speed': 'Travel Speed (in/min)',
      'volts': 'Voltage (V)',
      'amps': 'Current (A)',
      'wire_speed': 'Wire Speed (in/min)',
      'oscillate_width': 'Oscillation Width (in)',
      'target': 'Target (A)',
      'horizontal_bias': 'Horizontal Bias (A)',
      'frequency': 'Frequency (cyc/min)',
      'total_wire_consumed': 'Total Wire Consumed (in)',
      'heat': 'Heat (kJ/in)'
    };
  }

  parseAutomationFile() {
    console.log('📖 Reading:', this.inputTxtPath);
    const raw = fs.readFileSync(this.inputTxtPath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim());

    const tRecords = [];
    let setupData = {};

    for (const line of lines) {
      if (!line.startsWith('{')) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.Record === 'S') {
          setupData = obj;
        } else if (obj.Record === 'T') {
          tRecords.push(obj);
        }
      } catch (e) { /* skip invalid json */ }
    }

    if (tRecords.length === 0) throw new Error("No 'T' records found.");
    return { tRecords, setupData };
  }

  async createExcel({ tRecords, setupData }) {
    const workbook = new ExcelJS.Workbook();
    const setupSheet = workbook.addWorksheet('Setup');
    setupSheet.addRow(Object.keys(setupData));
    setupSheet.addRow(Object.values(setupData));

    const dataSheet = workbook.addWorksheet('ActualData');

    // Headers ordered to match UI Data Analysis exactly
    const orderedHeaders = [
      'Event', 'Time', 'Tilt', 'Torch Type', 'Pass', 'Distance (in)', 
      'Travel Speed (in/min)', 'Voltage (V)', 'Current (A)', 
      'Wire Speed (in/min)', 'Oscillation Width (in)', 'Target (A)', 
      'Horizontal Bias (A)', 'Frequency (cyc/min)', 'Total Wire Consumed (in)', 'Heat (kJ/in)'
    ];
    dataSheet.addRow(orderedHeaders);

    const leadRows = [];
    const trailRows = [];

    tRecords.forEach(rec => {
      // Create LEAD Torch rows
      if (rec.Lead_pass_name) {
        leadRows.push([
          rec.Event, rec.Time, rec.Tilt, 'LEAD', rec.Lead_pass_name, rec.Distance,
          rec.Travel_speed, rec.Lead_volts, rec.Lead_amps, rec.Lead_wire_speed,
          rec.Lead_oscillate_width, rec.Lead_target, rec.Lead_horizontal_bias,
          rec.Lead_frequency, rec.Lead_total_wire_consumed, rec.Lead_heat
        ]);
      }

      // Create TRAIL Torch rows
      if (rec.Trail_pass_name) {
        trailRows.push([
          rec.Event, rec.Time, rec.Tilt, 'TRAIL', rec.Trail_pass_name, rec.Distance,
          rec.Travel_speed, rec.Trail_volts, rec.Trail_amps, rec.Trail_wire_speed,
          rec.Trail_oscillate_width, rec.Trail_target, rec.Trail_horizontal_bias,
          rec.Trail_frequency, rec.Trail_total_wire_consumed, rec.Trail_heat
        ]);
      }
    });

    // Add all Leads, then all Trails (Grouped)
    dataSheet.addRows(leadRows);
    dataSheet.addRows(trailRows);

    // Formatting for clean appearance
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.columns.forEach(col => { col.width = 22; });

    const outputPath = path.join(this.outputDir, this.outputFile);
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    
    await workbook.xlsx.writeFile(outputPath);
    console.log('✅ COMPARISON READY EXCEL SAVED:', outputPath);
    return outputPath;
  }

  async run() {
    const data = this.parseAutomationFile();
    await this.createExcel(data);
  }
}

module.exports = ActualDataExtractor;