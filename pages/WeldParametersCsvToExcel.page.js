const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');

class WeldParametersCsvToExcel {
  constructor() {
  this.csvPath = path.join(process.cwd(), 'Input', 'p600z_example.csv');

  // Base exports directory
  const baseExportDir = path.join(process.cwd(), 'exports');

  // Create main exports folder if missing
  if (!fs.existsSync(baseExportDir)) {
    fs.mkdirSync(baseExportDir, { recursive: true });
  }

  // 🔹 Create WeldParametersCsvToExcel subfolder
  this.exportDir = path.join(baseExportDir, 'WeldParametersCsvToExcel');

  if (!fs.existsSync(this.exportDir)) {
    fs.mkdirSync(this.exportDir, { recursive: true });
  }

  // Output file inside that folder
  this.outputPath = path.join(this.exportDir, 'WeldParametersCsvToExcel.xlsx');
}

  async run() {
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

    await workbook.xlsx.writeFile(this.outputPath);

console.log(`✅ Excel created at: ${this.outputPath}`);

return this.outputPath;  // 🔥 MUST RETURN THIS
  }
}

module.exports = WeldParametersCsvToExcel;