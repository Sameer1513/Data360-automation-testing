
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { autoScroll } = require('../utils/scroll.util');

class ProductionTabWeldData {
  constructor(page) {
    this.page = page;
    this.exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
   // 🔧 ONE PLACE TO CONTROL EVERYTHING
   this.scanConfig = {
    Pass:  { view: true,  tlogs: false },
    Zone:  { view: false, tlogs: true  },
    Tilt:  { view: false, tlogs: false }
    };  
  }

  async runFlow(prodLimit = null) {
  const rows = this.page.locator('table tbody tr');
  const total = await rows.count();
  const iterations = prodLimit ? Math.min(prodLimit, total) : total;
  const prodHeaders = await this.page.locator('table thead th').allInnerTexts();

  for (let i = 0; i < iterations; i++) {
    console.log(`\n📂 PRODUCTION ROW ${i + 1}`);
    const workbook = new ExcelJS.Workbook();
    
    try {
      
      // Step 1: Click Eye on Main Table to enter Pass/Zone/Tilt
      await this.WelddataEye(i);

      // Step 2: Weld Summary (Initial Page)
      await this.generateWeldSummarySheet(workbook);
      const prodRowData = await rows.nth(i).locator('td').allInnerTexts();


     const tabsToProcess = Object.entries(this.scanConfig)
  .filter(([_, cfg]) => cfg.view || cfg.tlogs)
  .map(([tab]) => tab);

for (const tabName of tabsToProcess) {
  try {
    const cfg = this.scanConfig[tabName] || {};

    // Skip tab entirely if both view & tlogs are false (extra safety)
    if (!cfg.view && !cfg.tlogs) {
      console.log(`⏭️ ${tabName} tab skipped (both view & tlogs false)`);
      continue;
    }

    console.log(`--- Processing ${tabName} Tab ---`);
    const tab = this.page.getByRole('tab', { name: tabName });

    if (await tab.count() === 0) {
      console.log(`⏭️ ${tabName} tab not available — skipping`);
      continue;
    }

    await tab.click({ timeout: 5000 });
    await this.page.waitForSelector('table tbody tr', { state: 'visible', timeout: 5000 });

    // 🔁 Process the tab based on its flags
    await this.processTabView(workbook, tabName, prodHeaders, prodRowData);

  } catch (tabError) {
    console.warn(`⚠️  ${tabName} Tab failed:`, tabError.message);
  }
}
 

    } catch (rowError) {
      console.error(`❌ Row ${i + 1} processing failed:`, rowError.message);
      // ✅ CONTINUE to save what we have
    } finally {
      // ✅ ALWAYS SAVE - even if error occurred
      try {
        const timestamp = Date.now();
        const filename = `Production_weld_data${i + 1}_${timestamp}.xlsx`;
        const filepath = path.join(this.exportDir, filename);
        await workbook.xlsx.writeFile(filepath);
        console.log(`✅ SAVED (${Object.keys(workbook.worksheets).length} sheets):`, filename);
      } catch (saveError) {
        console.error(`❌ Failed to save Excel for Row ${i + 1}:`, saveError.message);
      }

      // Go back to main table
      try {
        await this.goBackSafe();
      } catch (backError) {
        console.warn(`⚠️  goBack failed:`, backError.message);
      }
    }
  }
}

async parseCellValue(cell) {
  return await cell.evaluate(el => {
    if (el.querySelector('svg.lucide-thumbs-up')) return 'true';
    if (el.querySelector('svg.lucide-thumbs-down')) return 'false';
    if (el.querySelector('svg.lucide-alert-circle')) return '!';
    if (el.querySelector('svg.lucide-minus')) return '-';
    if (el.querySelector('svg.lucide-x')) return 'x';
    return el.innerText.trim();
  });
}

 async processTabView(workbook, viewName, prodHeaders, prodRowData) {
  const cfg = this.scanConfig[viewName] || {};

  // ✅ Only create sheets that are enabled
  const viewSheet = cfg.view ? workbook.addWorksheet(`${viewName}_View`) : null;
  const analysisSheet = cfg.tlogs ? workbook.addWorksheet(`${viewName}_tlogs_data`) : null;

  if (analysisSheet) {
    analysisSheet.views = [{ state: 'frozen', ySplit: 1 }];
    analysisSheet._headersWritten = false;
  }

  // 1️⃣ Scroll the table for full data
  const viewScroller = this.page.locator('div.relative.overflow-auto, [role="region"]').first();
  if (await viewScroller.isVisible()) await autoScroll(viewScroller);

  // 2️⃣ Get headers (keep original logic)
  let headers = [];
  try {
    headers = await this.page.locator('table:has(tbody tr)').locator('thead th').allInnerTexts();
    if (headers.length > 10) console.log(`✅ Found ${headers.length} headers`);
  } catch(e) {}

  if (headers.length < 5) {
    try {
      headers = await this.page.locator('table tbody tr:first-child td').allInnerTexts();
      console.log(`✅ Used data row as headers: ${headers.length} columns`);
    } catch(e) {}
  }

  if (headers.length === 0) {
    headers = ['Sl.no', 'Status', 'Station', 'Welder ID', 'Direction', 'Action', 'Mode', 
               'Start Time', 'Duration', 'Auto?', 'Current(A)', 'Voltage(V)', 'Travel Speed', 
               'Heat Input', 'Wire Speed'];
    console.log('⚠️ Used hardcoded headers');
  }

  // 3️⃣ Only write headers to viewSheet if view enabled
  if (viewSheet) viewSheet.addRow(headers);

  const rowsLocator = this.page.locator('table tbody tr');
  const rowCount = await rowsLocator.count();
  const capturedRows = [];

  // 4️⃣ Capture rows for viewSheet and/or analysis
  for (let i = 0; i < rowCount; i++) {
    const cells = await rowsLocator.nth(i).locator('td').all();
    const rowData = [];
    for (const cell of cells) rowData.push(await this.parseCellValue(cell));

    if (rowData[0] && !isNaN(rowData[0].trim())) {
      if (viewSheet) viewSheet.addRow(rowData);  // view sheet
      if (analysisSheet) capturedRows.push({ index: i, data: rowData }); // only if tlogs enabled
    }
  }

  // 5️⃣ Click eye-icon only if tlogs is enabled
  if (analysisSheet) {
    for (const item of capturedRows) {
      const row = rowsLocator.nth(item.index);
      const eye = row.locator('button:has(svg.lucide-eye), svg.lucide-eye').first();
      if (await eye.count() > 0) {
        console.log(`   🔍 Row ${item.data[0]}: Opening Data Analysis`);
        await row.hover();
        await eye.click({ force: true });
        await this.scanDataAnalysis(analysisSheet, viewName, prodHeaders, prodRowData, item.data);
        await this.page.waitForSelector(`table tbody tr`, { state: 'visible' });
        await this.page.waitForTimeout(1000);
      }
    }
  }
}



async scanDataAnalysis(sheet, viewName, prodHeaders, prodRowData, viewRowData) {
  sheet._headersWritten = sheet._headersWritten ?? false;

  let dataHeaders = [];
  
  // 🚨 CRITICAL: Wait for DataAnalysis page to fully load
  await this.page.waitForTimeout(2000);
  
  // 1️⃣ MODIFIED TARGETING: Find the wide table (Data Analysis) 
  // without using fixed text like "Pulse" or IDs
  try {
    // We look for a table that has many columns (typical for Data Analysis)
    const tables = await this.page.locator('table').all();
    let deepTable;

    for (const table of tables) {
      const colCount = await table.locator('tr:first-child td, tr:first-child th').count();
      if (colCount > 10) { // Data Analysis always has many columns
        deepTable = table;
        break;
      }
    }

    if (deepTable) {
      dataHeaders = await deepTable.locator('thead th').allInnerTexts();
      if (dataHeaders.length > 15) {
        console.log(`✅ DataAnalysis: Found ${dataHeaders.length} headers`);
      }
    }
  } catch(e) {
    console.log("Error finding table: ", e);
  }

  // 2️⃣ (Rest of your original logic unchanged)
  if (dataHeaders.length < 10) {
    try {
      // Fallback to first row headers if previous step failed
      dataHeaders = await this.page.locator('table tbody tr:first-child td').allInnerTexts();
      console.log(`✅ DataAnalysis: Fallback headers (${dataHeaders.length})`);
    } catch(e) {}
  }

  if (dataHeaders.length === 0) {
    dataHeaders = ['Sl.no','Status','Weld ID','Time','Pass No','Mode','Program','Position','Distance','Travel Speed','Voltage','Current','Wire Feed Speed','Ext1','Ext2','Ext3','Ext4','Ext5','Ext6','Ext7','Ext8','Ext9'];
  }

  if (!sheet._headersWritten) {
    sheet.addRow(dataHeaders);   // becomes row 1
    sheet._headersWritten = true;
  }

  // Scroll & capture (Keeping your logic exactly)
  const scroller = this.page.locator('div.relative.overflow-auto, [role="region"]').first();
  if (await scroller.isVisible()) {
     // You can keep your autoScroll(scroller) call here
     await scroller.evaluate(el => el.scrollTop = el.scrollHeight);
  }

  // Identify the table again for row extraction to match your logic
  const tables = await this.page.locator('table').all();
  let analysisTable;
  for (const t of tables) {
      if (await t.locator('tr:first-child td').count() > 10) {
          analysisTable = t;
          break;
      }
  }
  const target = analysisTable || this.page.locator('table').first();

  const rows = await target.locator('tbody tr').all();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = await row.locator('td').all();
    const rowData = [];
    for (const cell of cells) {
      rowData.push(await this.parseCellValue(cell));
    }

    if (rowData[0] && !isNaN(rowData[0].trim())) {
        sheet.addRow(rowData);
    }
  }

  await this.goBackSafe();
}
    

  async goBackSafe() {
    const backBtn = this.page.locator('button:has(svg.lucide-arrow-left), button[aria-label="Back"]').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await this.page.waitForLoadState('networkidle');
    }
  }

  async WelddataEye(index) {
    const weldDataCol = await this.getColumnIndexByName('Weld Data');
    const row = this.page.locator('table tbody tr').nth(index);
    await row.locator(`td:nth-child(${weldDataCol}) button`).first().click();
    await this.page.waitForSelector('button[role="tab"]', { state: 'visible' });
  }

  async getColumnIndexByName(name) {
    const headers = this.page.locator('table thead th');
    for (let i = 0; i < (await headers.count()); i++) {
      const txt = await headers.nth(i).innerText();
      if (txt.toLowerCase().includes(name.toLowerCase())) return i + 1;
    }
    throw new Error(`Column "${name}" not found`);
  }

  async generateWeldSummarySheet(workbook) {
  const sheet = workbook.addWorksheet('WeldSummary');

  const headers = await this.page.locator('table thead th').allInnerTexts();
  sheet.addRow(headers);

  const rows = await this.page.locator('table tbody tr').all();

  for (const row of rows) {
    const cells = await row.locator('td').all();
    const rowData = [];

    for (const cell of cells) {
      rowData.push(await this.parseCellValue(cell));
    }

    sheet.addRow(rowData);
  }
}
}

module.exports = ProductionTabWeldData;



