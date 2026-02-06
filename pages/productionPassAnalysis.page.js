
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { autoScroll } = require('../utils/scroll.util');

class ProductionPassAnalysisPage {
  constructor(page) {
    this.page = page;
    this.exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
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
      
      // Step 2: Click Eye on Main Table to enter Pass/Zone/Tilt
      await this.WelddataEye(i);

      // Step 1: Weld Summary (Initial Page)
      await this.generateWeldSummarySheet(workbook);
      const prodRowData = await rows.nth(i).locator('td').allInnerTexts();


      const tabs = ['Pass', 'Zone', 'Tilt'];
      for (const tabName of tabs) {
        try {
          console.log(`--- Processing ${tabName} Tab ---`);
          await this.page.getByRole('tab', { name: tabName }).click();
          await this.page.waitForSelector('table tbody tr', { state: 'visible' });
          
          await this.processTabView(workbook, tabName, prodHeaders, prodRowData);
        } catch (tabError) {
          console.warn(`⚠️  ${tabName} Tab failed:`, tabError.message);
          // ✅ CONTINUE to next tab even if one fails
        }
      }

    } catch (rowError) {
      console.error(`❌ Row ${i + 1} processing failed:`, rowError.message);
      // ✅ CONTINUE to save what we have
    } finally {
      // ✅ ALWAYS SAVE - even if error occurred
      try {
        const timestamp = Date.now();
        const filename = `Production_Row_${i + 1}_${timestamp}.xlsx`;
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
    const viewSheet = workbook.addWorksheet(`${viewName}_View`);
    const analysisSheet = workbook.addWorksheet(`${viewName}_DataAnalysis`);
    // ✅ Freeze header row BEFORE any data is written
      analysisSheet.views = [{ state: 'frozen', ySplit: 1 }];
      analysisSheet._headersWritten = false;
 

    // 1. SCROLL & CAPTURE ENTIRE VIEW TABLE
    const viewScroller = this.page.locator('div.relative.overflow-auto, [role="region"]').first();
    if (await viewScroller.isVisible()) await autoScroll(viewScroller);

   // ✅ Get ONLY the View table headers (2nd table), skip production table
// TRY multiple selectors to find the RIGHT table
let headers = [];
let attempts = 0;

// 1️⃣ Try main table first (most reliable)
try {
  headers = await this.page.locator('table:has(tbody tr)').locator('thead th').allInnerTexts();
  if (headers.length > 10) console.log(`✅ Found ${headers.length} headers`);
} catch(e) {}

// 2️⃣ Fallback to any table with data
if (headers.length < 5) {
  try {
    headers = await this.page.locator('table tbody tr:first-child td').allInnerTexts();
    // Use FIRST data row as headers if no thead found
    console.log(`✅ Used data row as headers: ${headers.length} columns`);
  } catch(e) {}
}

if (headers.length === 0) {
  // 3️⃣ LAST RESORT - hardcoded common headers
  headers = ['Sl.no', 'Status', 'Station', 'Welder ID', 'Direction', 'Action', 'Mode', 
             'Start Time', 'Duration', 'Auto?', 'Current(A)', 'Voltage(V)', 'Travel Speed', 
             'Heat Input', 'Wire Speed'];
  console.log('⚠️ Used hardcoded headers');
}

viewSheet.addRow(headers);



    const rowsLocator = this.page.locator('table tbody tr');
    const rowCount = await rowsLocator.count();

    // Store row data first so we don't lose it during navigation
    const capturedRows = [];

    for (let i = 0; i < rowCount; i++) {
      const cells = await rowsLocator.nth(i).locator('td').all();
      const rowData = [];
      for (const cell of cells) {
       rowData.push(await this.parseCellValue(cell));
       }
      if (rowData[0] && !isNaN(rowData[0].trim())) {
        viewSheet.addRow(rowData);
        capturedRows.push({ index: i, data: rowData });
      }
    }

    // 2. CLICK EYE FOR EACH VALID ROW
    for (const item of capturedRows) {
      const row = rowsLocator.nth(item.index);
      const eye = row.locator('button:has(svg.lucide-eye), svg.lucide-eye').first();

      if (await eye.count() > 0) {
        console.log(`   🔍 Row ${item.data[0]}: Opening Data Analysis`);
        await row.hover(); // Important for revealing icons
        await eye.click({ force: true });

        // Scan the deep view
        await this.scanDataAnalysis(analysisSheet, viewName, prodHeaders, prodRowData, item.data);

        // VERIFY RETURN: Wait until the tab table is visible again before next iteration
        await this.page.waitForSelector(`table tbody tr`, { state: 'visible' });
        await this.page.waitForTimeout(1000); // 1s wait as requested
      }
      // ✅ FREEZE DATA ANALYSIS HEADER (ADD HERE)

    }
  }

async scanDataAnalysis(sheet, viewName, prodHeaders, prodRowData, viewRowData) {
  sheet._headersWritten = sheet._headersWritten ?? false;


  let dataHeaders = [];
  
  // 🚨 CRITICAL: Wait for DataAnalysis page to fully load
  await this.page.waitForTimeout(2000);
  
  // 1️⃣ MOST SPECIFIC: Target DEEPEST table (DataAnalysis has more columns)
  try {
    const deepTable = this.page.locator('table tbody tr td:has-text("Pulse")').first().locator('..').locator('..').locator('..');
    dataHeaders = await deepTable.locator('thead th, tbody tr:first-child td').allInnerTexts();
    if (dataHeaders.length > 15) {
      console.log(`✅ DataAnalysis: Found ${dataHeaders.length} DEEP headers`);
    }
  } catch(e) {}

  // 2️⃣ Target table with Weld ID column (DataAnalysis specific)
  if (dataHeaders.length < 10) {
    try {
      const analysisTable = this.page.locator('table:has(td:has-text("363466"))').first();
      dataHeaders = await analysisTable.locator('thead th, tbody tr:first-child td').allInnerTexts();
      console.log(`✅ DataAnalysis: Found WeldID table (${dataHeaders.length} cols)`);
    } catch(e) {}
  }

  // 3️⃣ LAST RESORT: Most recent table
  if (dataHeaders.length < 10) {
    try {
      dataHeaders = await this.page.locator('table tbody tr:first-child td').allInnerTexts();
      console.log(`✅ DataAnalysis: Fallback first row headers (${dataHeaders.length})`);
    } catch(e) {}
  }

  if (dataHeaders.length === 0) {
    dataHeaders = ['Sl.no','Status','Weld ID','Time','Pass No','Mode','Program','Position','Distance','Travel Speed','Voltage','Current','Wire Feed Speed','Ext1','Ext2','Ext3','Ext4','Ext5','Ext6','Ext7','Ext8','Ext9'];
  }

  
 if (!sheet._headersWritten) {
  sheet.addRow(dataHeaders);   // becomes row 1
  sheet._headersWritten = true;
}

  // Scroll & capture (unchanged)
  const scroller = this.page.locator('div.relative.overflow-auto, [role="region"]').first();
  if (await scroller.isVisible()) await autoScroll(scroller);

  const rows = await this.page.locator('table tbody tr').all();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = await row.locator('td').all();
    const rowData = [];
    for (const cell of cells) {
     rowData.push(await this.parseCellValue(cell));
    }

    if (rowData[0] && !isNaN(rowData[0].trim())) sheet.addRow(rowData);
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

module.exports = ProductionPassAnalysisPage;



