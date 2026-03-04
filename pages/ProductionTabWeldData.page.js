
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { autoScroll } = require('../utils/scroll.util');




class ProductionTabWeldData {
  constructor(page,scanConfig) {
    this.page = page;
    this.exportDir = path.join(process.cwd(), 'exports', 'ProductionData');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
   // 🔧 ONE PLACE TO CONTROL EVERYTHING
     this.scanConfig = scanConfig;
  }
  

async runFlow(weldIds = [], prodLimit = null,projectName='Default') {
  // Initialize one workbook for all data
  const workbook = new ExcelJS.Workbook();
  const timestamp = Date.now();
  // const filename = `Production_Report_${timestamp}.xlsx`;
  const filename = `Production_Report_${projectName}_${timestamp}.xlsx`;
  const filepath = path.join(this.exportDir, filename);

 // If no IDs provided, find all Weld IDs currently visible in the table
  let targets = Array.isArray(weldIds) ? weldIds : (weldIds ? [weldIds] : []);
if (targets.length === 0) {
    console.log("⏳ Scrolling to load production data...");
    
    // 1. Find the table scroller and scroll down/up to trigger the network
    const scroller = this.page.locator('div.relative.overflow-auto, [role="region"]').first();
    if (await scroller.isVisible()) {
        await scroller.evaluate(el => el.scrollTop = 200);
        await this.page.waitForTimeout(500);
        await scroller.evaluate(el => el.scrollTop = 0);
    }

    // 2. WAIT for any cell to have text (Dynamic wait instead of fixed time)
    // This looks specifically for the Weld ID column cells to be non-empty
    const idColIndex = await this.getColumnIndexByName('Weld ID');
    const firstDataCell = this.page.locator(`table tbody tr:first-child td:nth-child(${idColIndex})`);
    
    // This waits as long as needed for the network to finish
    await firstDataCell.waitFor({ state: 'visible', timeout: 30000 });

    // 3. Capture all IDs currently in view
    const idCells = await this.page.locator(`table tbody tr td:nth-child(${idColIndex})`).allInnerTexts();
    targets = idCells.map(id => id.trim()).filter(id => id.length > 0);
    
    console.log(`✅ Captured ${targets.length} welds after scroll: ${targets.join(', ')}`);
}

  for (let i = 0; i < targets.length; i++) {
    const currentWeld = targets[i];
    console.log(`\n🚀 PROCESSING WELD: ${currentWeld || 'Default/Manual Row ' + (i + 1)}`);

    try {
      // Use the search helper if a specific ID is provided
     if (currentWeld) {
        await this.searchAndFilterWeld(currentWeld);
        // Give the UI a moment to replace the old rows with the new search results
        await this.page.waitForTimeout(1500); 
      }

      // Step 1: Enter the detail view (Weld Data eye icon)
      // If we filtered, it's usually the 1st row (index 0)
       if (!currentWeld) {
       await this.WelddataEye(i);
       }

      // Step 2: Generate Summary and process Tabs
     
    await this.generateWeldSummarySheet(workbook, currentWeld);
      
      const prodHeaders = await this.page.locator('table thead th').allInnerTexts();
      const rows = this.page.locator('table tbody tr');
      const prodRowData = await rows.nth(0).locator('td').allInnerTexts();

      const tabsToProcess = Object.entries(this.scanConfig)
        .filter(([_, cfg]) => cfg.view || cfg.tlogs)
        .map(([tab]) => tab);

      for (const tabName of tabsToProcess) {
        await this.processTabByName(workbook, tabName, prodHeaders, prodRowData,currentWeld);
      }

    } catch (error) {
      console.error(`❌ Failed processing ${currentWeld}:`, error.message);
    } finally {
      // Clear search to reset table for next iteration
      await this.goBackSafe();
      
      // ✅ FIX: Now clear the search bar on the main table
      if (currentWeld) {
        await this.clearSearch();
        // await this.page.waitForTimeout(1000);
      }

      // Save progress after every weld
      await workbook.xlsx.writeFile(filepath);
    }
    
    if (prodLimit && i + 1 >= prodLimit) break;
  }
  console.log(`\n final report saved: ${filepath}`);
}

async searchAndFilterWeld(weldId) {
    const idStr = String(weldId).trim();
    const searchInput = this.page.locator('input[placeholder*="Search"], .search-bar input').first();

    // 1. Precise Clear and Search
    await searchInput.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await searchInput.fill(idStr);
    await this.page.keyboard.press('Enter');

    // 2. Locate the "Weld ID" and "Weld Data" column indices
    const weldIdCol = await this.getColumnIndexByName('Weld ID');
    const weldDataCol = await this.getColumnIndexByName('Weld Data');

    // 3. TARGET THE EXACT ROW
    // We use a regex to ensure "13" is not confused with "3"
    const targetRow = this.page.locator('table tbody tr').filter({
        has: this.page.locator(`td:nth-child(${weldIdCol})`).getByText(idStr, { exact: true })
    }).first();

    try {
        // Wait for the exact row to appear (Reactive wait)
        await targetRow.waitFor({ state: 'visible', timeout: 15000 });
        
        // 4. CLICK THE EYE ICON IN THE CORRECT ROW
        const eyeButton = targetRow.locator(`td:nth-child(${weldDataCol}) button, td:nth-child(${weldDataCol}) svg.lucide-eye`).first();
        
        await targetRow.scrollIntoViewIfNeeded();
        await eyeButton.click();
        
        // Wait for tabs to appear to confirm we entered the detail view
        await this.page.waitForSelector('button[role="tab"]', { state: 'visible' });
        console.log(`🎯 Successfully entered Detail View for Weld ID: ${idStr}`);
        
    } catch (e) {
        throw new Error(`❌ Exact Weld ID ${idStr} not found or eye button missing.`);
    }
}

async clearSearch() {
  const clearBtn = this.page.locator('button:has(svg.lucide-x), .clear-search').first();
  
  // Use a shorter timeout and force the click if necessary
  if (await clearBtn.isVisible()) {
    try {
      await clearBtn.click({ timeout: 5000 });
    } catch (e) {
      // If clicking the "X" fails, fallback to manual clear
      const input = this.page.locator('input[placeholder*="Search"]').first();
      await input.click();
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.press('Backspace');
      await this.page.keyboard.press('Enter');
    }
  } else {
    await this.page.locator('input[placeholder*="Search"]').first().fill('');
    await this.page.keyboard.press('Enter');
  }
  await this.page.waitForTimeout(1000); // Wait for table to reset
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
async processTabByName(workbook, tabName, prodHeaders, prodRowData,currentWeldId) {
  try {
    console.log(`--- Processing ${tabName} Tab ---`);
    const tab = this.page.getByRole('tab', { name: tabName });

    if (await tab.count() === 0) return;

    await tab.click({ timeout: 5000 });
    await this.page.waitForSelector('table tbody tr', { state: 'visible', timeout: 5000 });

    // Reuse your existing logic for scraping the view
    await this.processTabView(workbook, tabName, prodHeaders, prodRowData,currentWeldId);
  } catch (err) {
    console.warn(`⚠️ ${tabName} Tab failed:`, err.message);
  }
}

 async processTabView(workbook, viewName, prodHeaders, prodRowData,currentWeldId) {
  const cfg = this.scanConfig[viewName] || {};
// 1. Get existing sheet OR create it only if it doesn't exist yet
let viewSheet = workbook.getWorksheet(`${viewName}_View`);
if (!viewSheet && cfg.view) {
    viewSheet = workbook.addWorksheet(`${viewName}_View`);
    viewSheet._headersWritten = false; // Flag to ensure headers only write once
}

let analysisSheet = workbook.getWorksheet(`${viewName}_tlogs_data`);
if (!analysisSheet && cfg.tlogs) {
    analysisSheet = workbook.addWorksheet(`${viewName}_tlogs_data`);
    analysisSheet._headersWritten = false;
}
  // Only set up the view and flag if this is a brand new sheet
  if (analysisSheet && analysisSheet._headersWritten === undefined) {
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
  // 3️⃣ Only write headers once for the master sheet
if (viewSheet && !viewSheet._headersWritten) {
  viewSheet.addRow(['Weld ID', ...headers]);
  viewSheet._headersWritten = true;
}

  const rowsLocator = this.page.locator('table tbody tr');
  const rowCount = await rowsLocator.count();
  const capturedRows = [];

  // 4️⃣ Capture rows for viewSheet and/or analysis
  for (let i = 0; i < rowCount; i++) {
    const cells = await rowsLocator.nth(i).locator('td').all();
    const rowData = [];
    for (const cell of cells) rowData.push(await this.parseCellValue(cell));

    if (rowData[0] && !isNaN(rowData[0].trim())) {
  const rowWithId = [currentWeldId, ...rowData];
  if (viewSheet) viewSheet.addRow(rowWithId);  // ✅ Use rowWithId
  if (analysisSheet) capturedRows.push({ index: i, data: rowWithId }); 
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
        await this.scanDataAnalysis(analysisSheet, viewName, prodHeaders, prodRowData, item.data,currentWeldId);
        await this.page.waitForSelector(`table tbody tr`, { state: 'visible' });
        await this.page.waitForTimeout(1000);
      }
    }
  }
}



async scanDataAnalysis(sheet, viewName, prodHeaders, prodRowData, viewRowData,currentWeldId) {
  sheet._headersWritten = sheet._headersWritten ?? false;

  let dataHeaders = [];
  
  // 🚨 CRITICAL: Wait for DataAnalysis page to fully load
  await this.page.waitForTimeout(2000);
  
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
  // We add 'Search Weld ID' as the first column header
  sheet.addRow(['Search Weld ID', ...dataHeaders]); 
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
    // We put the actual weld ID value as the first item in the row
    sheet.addRow([currentWeldId, ...rowData]);
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
    
    // Scroll the specific row into view so the click doesn't miss
    await row.scrollIntoViewIfNeeded(); 
    
    const eyeButton = row.locator(`td:nth-child(${weldDataCol}) button`).first();
    await eyeButton.waitFor({ state: 'visible' });
    await eyeButton.click();
    
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

async generateWeldSummarySheet(workbook, currentWeldId) { // Added parameter
  let sheet = workbook.getWorksheet('WeldSummary');
  
  if (!sheet) {
    sheet = workbook.addWorksheet('WeldSummary');
    const headers = await this.page.locator('table thead th').allInnerTexts();
    sheet.addRow(headers);
  }

  // Look for the row that specifically contains our Weld ID text
  const row = this.page.locator('table tbody tr').filter({ 
  has: this.page.locator('td'), 
  hasText: new RegExp(`^${currentWeldId}$`) // Regex for start-to-finish exact match
}).first();
  
  if (await row.isVisible()) {
    const cells = await row.locator('td').all();
    const rowData = [];
    for (const cell of cells) {
      rowData.push(await this.parseCellValue(cell));
    }
    sheet.addRow(rowData);
  } else {
    console.warn(`⚠️ Summary row for ${currentWeldId} not found.`);
  }
}
}

module.exports = ProductionTabWeldData;