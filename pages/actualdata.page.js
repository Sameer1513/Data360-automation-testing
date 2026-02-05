const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class ActualDataExtractor {
  constructor() {
    this.inputTxtPath = path.join(__dirname, 'AUTOMATION.txt');  // ✅ tests/AUTOMATION.txt
    this.outputDir = path.join(__dirname, '..', 'exports');      // ✅ exports/
    this.outputFile = `ActualData_FromTxt_${Date.now()}.xlsx`;
  }

  parseAutomationFile() {
    console.log('📖 Reading:', this.inputTxtPath);
    const raw = fs.readFileSync(this.inputTxtPath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim());

    const records = [];
    let setupData = {};

    for (const line of lines) {
      if (line.startsWith('{')) {
        try {
          const obj = JSON.parse(line);
          
          if (obj.Record === 'S') {
            setupData = obj;  // Store setup info
            console.log('✅ Found Setup record');
          } else if (obj.Record === 'T') {
            records.push({
              event: obj.Event,
              time: obj.Time,
              tilt: obj.Tilt,
              distance: obj.Distance,
              travel_speed: obj.Travel_speed,

              // Lead data
              lead_pass_name: obj.Lead_pass_name,
              lead_volts: obj.Lead_volts,
              lead_amps: obj.Lead_amps,
              lead_wire_speed: obj.Lead_wire_speed,
              lead_oscillate_width: obj.Lead_oscillate_width,
              lead_target: obj.Lead_target,
              lead_heat: obj.Lead_heat,

              // Trail data
              trail_pass_name: obj.Trail_pass_name,
              trail_volts: obj.Trail_volts,
              trail_amps: obj.Trail_amps,
              trail_wire_speed: obj.Trail_wire_speed,
              trail_oscillate_width: obj.Trail_oscillate_width,
              trail_target: obj.Trail_target,
              trail_heat: obj.Trail_heat,
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    console.log(`✅ Parsed ${records.length} Tilt records`);
    return { records, setupData };
  }

  async createExcel({ records, setupData }) {
    const workbook = new ExcelJS.Workbook();
    
    // Setup sheet
    const setupSheet = workbook.addWorksheet('Setup');
    setupSheet.addRow(Object.keys(setupData));
    setupSheet.addRow(Object.values(setupData));

    // Main data sheet
    const dataSheet = workbook.addWorksheet('ActualData');
    dataSheet.addRow([
      'Event', 'Time', 'Tilt', 'Distance', 'Travel_speed',
      'Lead_pass_name', 'Lead_volts', 'Lead_amps', 'Lead_wire_speed', 
      'Lead_oscillate_width', 'Lead_target', 'Lead_heat',
      'Trail_pass_name', 'Trail_volts', 'Trail_amps', 'Trail_wire_speed', 
      'Trail_oscillate_width', 'Trail_target', 'Trail_heat'
    ]);

    records.forEach(r => {
      dataSheet.addRow([
        r.event, r.time, r.tilt, r.distance, r.travel_speed,
        r.lead_pass_name, r.lead_volts, r.lead_amps, r.lead_wire_speed,
        r.lead_oscillate_width, r.lead_target, r.lead_heat,
        r.trail_pass_name, r.trail_volts, r.trail_amps, r.trail_wire_speed,
        r.trail_oscillate_width, r.trail_target, r.trail_heat
      ]);
    });

    const outputPath = path.join(this.outputDir, this.outputFile);
    await workbook.xlsx.writeFile(outputPath);
    console.log('✅ SAVED:', outputPath);
    return outputPath;
  }

  async run() {
    if (!fs.existsSync(this.inputTxtPath)) {
      throw new Error(`❌ AUTOMATION.txt NOT FOUND in tests/ folder`);
    }
    
    const data = this.parseAutomationFile();
    await this.createExcel(data);
  }
}

// RUN IT!
(async () => {
  try {
    const extractor = new ActualDataExtractor();
    await extractor.run();
    console.log('🎉 DONE! Check exports/ folder');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
})();
