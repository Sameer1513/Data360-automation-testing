const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const parse = require("csv-parse/sync").parse;

class WeldParameterExcel {
  constructor(page) {
    this.page = page;

    this.exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  // -----------------------------
// SCRAPE WELD PARAMETERS TABLE (PRESERVE EXACT UI STRUCTURE)
// -----------------------------
async scrapeWeldTable() {
  console.log('📊 Extracting Weld Parameters (preserve layout mode)...');

  const activePanel = this.page.locator(
    '[role="tabpanel"][data-state="active"]'
  ).last();

  await activePanel.waitFor({ state: 'visible', timeout: 15000 });

  const table = activePanel.locator('table');
  await table.waitFor({ state: 'visible', timeout: 15000 });

  const allRows = table.locator('tr');
  const rowCount = await allRows.count();

  const sheetData = [];

  for (let i = 0; i < rowCount; i++) {
    const cells = allRows.nth(i).locator('th, td');
    const cellCount = await cells.count();

    const rowData = [];

    for (let j = 0; j < cellCount; j++) {
      rowData.push(
        (await cells.nth(j).innerText()).trim()
      );
    }

    sheetData.push(rowData);
  }

  console.log('✅ Weld Parameters table extracted with full structure');

  return sheetData;
}

// -----------------------------
// WRITE TORCH SHEET
// -----------------------------
async writeTorchSheet(workbook, torchName) {
  console.log(`📊 Scraping ${torchName} Torch...`);

  const weldData = await this.scrapeWeldTable();

  const sheet = workbook.addWorksheet(`Weld Parameters - ${torchName}`);

  // Insert custom first row
  const firstRow = [...weldData[0]];
  firstRow[0] = `${torchName} torch`;

  sheet.addRow(firstRow);

  // Add remaining rows
  for (let i = 1; i < weldData.length; i++) {
    sheet.addRow(weldData[i]);
  }

  console.log(`✅ ${torchName} Torch sheet created`);
}
  // -----------------------------
// NAVIGATE BACK USING ARROW
// -----------------------------
async goToProductionScreen() {
  console.log('🔁 Closing any open dialogs...');

  // Wait for any open Radix dialog to disappear
  const openDialog = this.page.locator('[role="dialog"][data-state="open"]');

  if (await openDialog.count() > 0) {
    await openDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }

  console.log('🔁 Clicking back arrow to return to Production...');

  // Target arrow-left SVG button specifically
  const backArrow = this.page.locator('button:has(svg.lucide-arrow-left)');

  await backArrow.waitFor({ state: 'visible', timeout: 10000 });
  await backArrow.click();

  console.log('⏳ Waiting for Production table to reload...');

  await this.page.waitForSelector('table tbody tr', {
    state: 'visible',
    timeout: 15000
  });

  console.log('✅ Returned to Production screen');
}

// -----------------------------
// OPEN WELD PARAMETERS TAB
// -----------------------------
async openWeldParametersTab() {
  console.log('🔁 Opening Weld Parameters tab...');

  const weldParamsButton = this.page.locator('button:has-text("Weld Parameters")');

  await weldParamsButton.waitFor({ state: 'visible', timeout: 15000 });
  await weldParamsButton.click();

  // Wait for Job Configuration heading specifically
  await this.page.waitForSelector(
    'h2:has-text("Job Configuration")',
    { timeout: 15000 }
  );

  console.log('✅ Weld Parameters page loaded');
}

 // -----------------------------
// SCRAPE CURRENT TAB BY NAME
// -----------------------------
// -----------------------------
// SCRAPE ACTIVE TAB PANEL
// -----------------------------
async scrapeKeyValueSection() {

  // Get currently active tabpanel (Radix sets data-state="active")
  const activePanel = this.page.locator(
    '[role="tabpanel"][data-state="active"]'
  ).last(); // last ensures we get inner tab (not production tab)

  await activePanel.waitFor({ state: 'visible', timeout: 15000 });

  const labels = activePanel.locator('label.text-sm.font-medium');
  const count = await labels.count();

  console.log(`🔎 Found ${count} labels in active tab`);

  const data = [];

  for (let i = 0; i < count; i++) {
    const label = labels.nth(i);
    const key = (await label.innerText()).trim();

    const container = label.locator('xpath=..');
    const valueLocator = container.locator('div.text-sm.text-gray-900.font-mono');

    if (await valueLocator.count()) {
      const value = (await valueLocator.first().innerText()).trim();
      data.push({ parameter: key, value });
    }
  }

  return data;
}

async scrapeJobParameters() {
  console.log('📄 Scraping Job Parameters...');

  const heading = await this.page
    .locator('h2:has-text("Job Configuration")')
    .innerText();

  const data = await this.scrapeKeyValueSection();

  return { heading, data };
}

async goToWeldParametersTab() {
  console.log('➡ Navigating to Weld Parameters tab...');

  const weldTab = this.page.getByRole('tab', { name: 'Weld Parameters' });

  await weldTab.click();

  const weldPanel = this.page.locator(
    '[role="tabpanel"][aria-labelledby*="weld-parameters"][data-state="active"]'
  );

  await weldPanel.waitFor({ state: 'visible', timeout: 15000 });

  console.log('✅ Weld Parameters tab active');
}
// -----------------------------
// MAIN EXECUTION
// -----------------------------
async run(projectName, slopeIn, slopeOut) {

  // Step 1: Go back to Production screen
  await this.goToProductionScreen();

  // Step 2: Open Weld Parameters page (IMPORTANT FIX)
  await this.openWeldParametersTab();

  const workbook = new ExcelJS.Workbook();

  // -----------------------------
  // SHEET 1 - JOB PARAMETERS
  // -----------------------------
  const jobSheet = workbook.addWorksheet('Job Parameters');

  const jobData = await this.scrapeJobParameters();

  jobSheet.addRow([jobData.heading]);
  jobSheet.getRow(1).font = { bold: true };
  jobSheet.addRow([]);

  jobSheet.columns = [
    { header: 'Parameter', key: 'parameter', width: 40 },
    { header: 'Value', key: 'value', width: 25 }
  ];

  jobData.data.forEach(item => {
    jobSheet.addRow(item);
  });

  // -----------------------------
// SHEET 2 - WELD PARAMETERS (LEAD)
// -----------------------------
await this.goToWeldParametersTab();  

// Click Lead torch tab (if not already active)
await this.page.getByRole('tab', { name: /Lead/i }).click();
await this.page.waitForTimeout(1000);

const leadSheet = workbook.addWorksheet('Weld Parameters - Lead');

const leadData = await this.scrapeWeldTable();

// Insert custom first row
const leadFirstRow = [...leadData[0]];
leadFirstRow[0] = 'Lead torch';
leadSheet.addRow(leadFirstRow);

// Add remaining rows
for (let i = 1; i < leadData.length; i++) {
  leadSheet.addRow(leadData[i]);
}

// -----------------------------
// SHEET 3 - WELD PARAMETERS (TRAIL)
// -----------------------------
await this.page.getByRole('tab', { name: /Trail/i }).click();
await this.page.waitForTimeout(1000);

const trailSheet = workbook.addWorksheet('Weld Parameters - Trail');

const trailData = await this.scrapeWeldTable();

// Insert custom first row
const trailFirstRow = [...trailData[0]];
trailFirstRow[0] = 'Trail torch';
trailSheet.addRow(trailFirstRow);

// Add remaining rows
for (let i = 1; i < trailData.length; i++) {
  trailSheet.addRow(trailData[i]);
}

// -----------------------------
// SHEET 4 - LEAD TORCH COMPARISON
// -----------------------------
const csvPath = path.join(process.cwd(), 'test-data', 'WeldParameters.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const records = parse(csvContent);

// Extract Lead Torch section from CSV
let leadStartIndex = records.findIndex(row =>
  row[1] && row[1].toString().trim() === 'Lead Torch'
);

let trailStartIndex = records.findIndex(row =>
  row[1] && row[1].toString().trim() === 'Trail Torch'
);

if (leadStartIndex === -1) {
  throw new Error('Lead Torch section not found in CSV');
}

// Slice only Lead section
const csvLeadSection = records.slice(
  leadStartIndex + 1,
  trailStartIndex === -1 ? records.length : trailStartIndex
);

// Remove empty separator rows
const filteredCsvLead = csvLeadSection.filter(row =>
  row.some(cell => cell && cell.toString().trim() !== '')
);

// Create comparison sheet
const compareSheet = workbook.addWorksheet('Lead Comparison');

compareSheet.columns = [
  { header: 'Parameter', width: 30 },
  { header: 'UI Value', width: 40 },
  { header: 'CSV Value', width: 40 },
  { header: 'Status', width: 15 }
];

compareSheet.getRow(1).font = { bold: true };

// Compare row by row
for (let i = 0; i < leadData.length; i++) {
  const uiRow = leadData[i];
  const csvRow = filteredCsvLead[i];

  if (!csvRow) continue;

  for (let col = 0; col < uiRow.length; col++) {
    const uiValue = uiRow[col] ? uiRow[col].toString().trim() : '';
    const csvValue = csvRow[col + 1] ? csvRow[col + 1].toString().trim() : '';

    if (!uiValue && !csvValue) continue;

    const status = uiValue === csvValue ? 'MATCH' : 'MISMATCH';

    const newRow = compareSheet.addRow([
      uiRow[0],   // Parameter name
      uiValue,
      csvValue,
      status
    ]);

    if (status === 'MISMATCH') {
      newRow.getCell(4).font = { color: { argb: 'FFFF0000' }, bold: true };
    }
  }
}

// -----------------------------
// SAVE EXCEL FILE
// -----------------------------
const fileName = `WeldParameters_${projectName}_In${slopeIn}_Out${slopeOut}_${Date.now()}.xlsx`;
const filePath = path.join(this.exportDir, fileName);

await workbook.xlsx.writeFile(filePath);

console.log(`📊 Weld Parameters Excel saved: ${filePath}`);

return filePath;
}
}

module.exports = WeldParameterExcel;