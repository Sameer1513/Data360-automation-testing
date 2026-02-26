const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { autoScroll } = require('../utils/scroll.util');

class StatusConfigPass {
  constructor(page) {
    this.page = page;
    this.exportDir = path.join(process.cwd(), 'exports');

    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }


  async navigateToStatusConfig() {
    console.log('🔁 Navigating to Status Configuration...');

    await this.page.getByRole('tab', { name: 'Production' }).click();
    await this.page.getByRole('button', { name: 'Status Configuration' }).click();

    // Confirm page load using slope input
    await this.page.locator('div')
      .filter({ hasText: /^In:$/ })
      .locator('input')
      .waitFor({ timeout: 15000 });

    console.log('✅ Status Configuration Loaded');
  }

  async run(projectName, slopeIn, slopeOut) {
  await this.navigateToStatusConfig();

  const workbook = new ExcelJS.Workbook();

  // =====================================================
  // 🟢 SHEET 1 → WELD DETAILS
  // =====================================================

  const weldSheet = workbook.addWorksheet('Weld_Details');

  console.log('🔎 Extracting Weld Details...');

  const weldDetails = await this.extractWeldDetails();
  console.log("weldDetails",weldDetails)

  weldSheet.addRow(['Field', 'Value']);

  Object.entries(weldDetails).forEach(([key, value]) => {
    weldSheet.addRow([key, value]);
  });

  weldSheet.getRow(1).font = { bold: true };

  // =====================================================
  // 🟢 SHEET 2 → STATUS CONFIG TABLE
  // =====================================================

  const tableSheet = workbook.addWorksheet('Status_Config_Parameters');

  console.log('⏳ Waiting for Status Config table...');
  const gridRoot = this.page.locator(
  'div:has-text("Status Configuration Parameters")'
).locator('xpath=following::div[contains(@class,"grid")][1]');
await this.page.waitForSelector(
  'span.text-gray-800.truncate',
  { timeout: 20000 }
);

  console.log('⏳ Waiting for Status Config table...');

// Wait for any parameter label to appear
await this.page.waitForSelector(
  'span.text-gray-800.truncate',
  { timeout: 20000 }
);

// Scroll the main grid container
const scroller = this.page.locator('div.overflow-auto').first();



if (await scroller.count()) {
  console.log('🔄 Scrolling vertically...');
  await autoScroll(scroller);

  console.log('↔️ Scrolling horizontally...');
  await scroller.evaluate(el => {
    el.scrollLeft = el.scrollWidth;
  });
}



console.log('📊 Extracting structured grid (div-based)...');

console.log('📊 Extracting structured grid (UI-visible only)...');

const gridData = await this.page.evaluate(() => {

  const root = [...document.querySelectorAll('div')]
    .find(d => d.innerText.includes('Status Configuration Parameters'));

  if (!root) return { headers: [], rows: [] };

  // =====================================================
  // 1️⃣ HEADERS
  // =====================================================

  const headers = ['Parameter'];
  const passHeaders = [];

  root.querySelectorAll('span.truncate').forEach(el => {
    const txt = el.innerText.trim();

    if (
      txt &&
      txt !== 'Param' &&
      txt !== 'Parameter' &&
      !txt.includes('(')
    ) {
      passHeaders.push(txt);
    }
  });

  const uniquePasses = [...new Set(passHeaders)];

  uniquePasses.forEach(pass => {
    headers.push(`${pass} Min`);
    headers.push(`${pass} Max`);
  });

  // =====================================================
  // 2️⃣ PARAMETERS (ROWS)
  // =====================================================

  // PARAMETERS
const labels = [
  ...root.querySelectorAll(
    'span.text-gray-800.truncate'
  )
]
  .map(el => el.innerText.trim())
  .filter(Boolean);

const rows = labels.map(label => [label]);

// VISIBLE VALUE GRIDS ONLY
const allPassGrids = [
  ...root.querySelectorAll('div.grid.grid-cols-2')
].filter(grid => {

  const style = window.getComputedStyle(grid);

  const visible =
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    grid.offsetHeight > 0 &&
    grid.offsetWidth > 0;

  const inputs =
    grid.querySelectorAll('input[type="number"]');

  return visible && inputs.length === 2;
});

const passCount = uniquePasses.length;
const paramCount = labels.length;

// =====================================================
// 🧩 CORRECT PARAM → PASS MAPPING
// =====================================================

for (let r = 0; r < paramCount; r++) {

  for (let p = 0; p < passCount; p++) {

    // UI order is:
    // Param1 Pass1
    // Param1 Pass2
    // Param2 Pass1
    // Param2 Pass2

    const gridIndex =
      (r * passCount) + p;

    const grid =
      allPassGrids[gridIndex];

    const inputs = grid
      ? grid.querySelectorAll(
          'input[type="number"]'
        )
      : [];

    rows[r].push(
      inputs[0]?.value?.trim() || '',
      inputs[1]?.value?.trim() || ''
    );
  }
}


  return { headers, rows };
});



// 🔹 Normalize headers (split Min/Max automatically)
const structuredHeaders = [];

gridData.headers.forEach(header => {
  const clean = header.replace(/\s+/g, ' ').trim();

  if (/min.*max/i.test(clean)) {
    const base = clean.replace(/min.*max/i, '').trim();
    structuredHeaders.push(`${base} Min`);
    structuredHeaders.push(`${base} Max`);
  } else {
    structuredHeaders.push(clean);
  }
});
console.log("grid data: ",gridData)

// Add headers exactly as structured
tableSheet.addRow(gridData.headers);
tableSheet.getRow(1).font = { bold: true };

// Add rows
gridData.rows.forEach(row => {
  tableSheet.addRow(row);
});

// Freeze header
tableSheet.views = [{ state: 'frozen', ySplit: 1 }];

// Auto width
tableSheet.columns.forEach(column => {
  let maxLength = 12;
  column.eachCell({ includeEmpty: true }, cell => {
    const len = cell.value ? cell.value.toString().length : 10;
    if (len > maxLength) maxLength = len;
  });
  column.width = Math.min(maxLength + 2, 40);
});


  // =====================================================
  // SAVE FILE
  // =====================================================

  const filename = `StatusConfig_${projectName}_In${slopeIn}_Out${slopeOut}_${Date.now()}.xlsx`;
  const filepath = path.join(this.exportDir, filename);


  await workbook.xlsx.writeFile(filepath);

  console.log(`📊 Excel saved: ${filepath}`);

  return filepath;
}
async extractWeldDetails() {
  const details = {};

  async function getFieldValue(page, labelText) {
    const label = page.locator('label', { hasText: labelText }).first();

    if (!(await label.count())) return '';

    // Find the closest parent container
    const container = label.locator('xpath=ancestor::*[1]');

    // Look for combobox button inside same container
    const combo = container.locator('button[role="combobox"]');

    if (await combo.count()) {
      const value = await combo.locator('span').first().innerText();
      return value.trim();
    }

    // Look for input field
    const input = container.locator('input');
    if (await input.count()) {
      return (await input.inputValue()).trim();
    }

    // Fallback: get first text element inside container excluding label
    const valueElement = container.locator('xpath=.//*[not(self::label)]').first();
    if (await valueElement.count()) {
      return (await valueElement.innerText()).trim();
    }

    return '';
  }

  details['Job Number'] = await getFieldValue(this.page, 'Job Number');
  details['Status Calculation Method'] = await getFieldValue(this.page, 'Status Calculation Method');
  details['Status Calculation Level'] = await getFieldValue(this.page, 'Calculation Level');

  const slopeIn = await this.page
    .locator('text=In:')
    .locator('xpath=following::input[1]')
    .inputValue()
    .catch(() => '');

  const slopeOut = await this.page
    .locator('text=Out:')
    .locator('xpath=following::input[1]')
    .inputValue()
    .catch(() => '');

  details['Slope Time'] = `In: ${slopeIn} | Out: ${slopeOut}`;

  return details;
}


}

module.exports = StatusConfigPass;
