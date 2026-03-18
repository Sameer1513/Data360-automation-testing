const ExcelJS = require('exceljs');
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { autoScroll } = require('../utils/scroll.util');
const ProductionTabWeldDataLocators = require('../Locators/ProductionTabWeldDataLocators.page');




class ProductionTabWeldData {
  constructor(page, scanConfig) {
    this.page = page;
    this.locators = new ProductionTabWeldDataLocators(page);
    this.exportDir = path.join(process.cwd(), 'exports', 'ProductionData');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
    // 🔧 ONE PLACE TO CONTROL EVERYTHING
    this.scanConfig = scanConfig;
  }


    async runFlow(weldIds = [], prodLimit = null, projectName = 'Default') {
    const workbook = new ExcelJS.Workbook();
    const timestamp = Date.now();
    const filename = `Production_Report_${projectName}_${timestamp}.xlsx`;
    const filepath = path.join(this.exportDir, filename);
    const results = [];

    // If no IDs provided, find all Weld IDs currently visible in the table
    let targets = Array.isArray(weldIds) ? weldIds : (weldIds ? [weldIds] : []);
    if (targets.length === 0) {
      console.log("⏳ Scrolling to load production data...");

      // 1. Find the table scroller and scroll down/up to trigger the network
      const scroller = this.locators.tableScroller();
      if (await scroller.isVisible()) {
        await scroller.evaluate(el => el.scrollTop = 200);
        await this.page.waitForTimeout(500);
        await scroller.evaluate(el => el.scrollTop = 0);
      }

      // 2. WAIT for any cell to have text (Dynamic wait instead of fixed time)
      const idColIndex = await this.getColumnIndexByName('Weld ID');
      const firstDataCell = this.locators.firstDataCellByColIndex(idColIndex);

      // This waits as long as needed for the network to finish
      await firstDataCell.waitFor({ state: 'visible', timeout: 30000 });

      // 3. Capture all IDs currently in view
      const idCells = await this.locators.allCellsByColIndex(idColIndex).allInnerTexts();
      targets = idCells.map(id => id.trim()).filter(id => id.length > 0);

      console.log(`✅ Captured ${targets.length} welds after scroll: ${targets.join(', ')}`);
    }

    for (let i = 0; i < targets.length; i++) {
      const currentWeld = targets[i];
      console.log(`\n🚀 PROCESSING WELD: ${currentWeld || 'Default/Manual Row ' + (i + 1)}`);

      try {
        await test.step(`Processing Weld: ${currentWeld || 'Row ' + (i + 1)}`, async () => {
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

            const prodHeaders = await this.locators.prodTableHeaders().allInnerTexts();
            const rows = this.locators.tableBodyRows();
            const prodRowData = await rows.nth(0).locator('td').allInnerTexts();

            const tabsToProcess = Object.entries(this.scanConfig)
              .filter(([_, cfg]) => cfg.view || cfg.tlogs)
              .map(([tab]) => tab);

            for (const tabName of tabsToProcess) {
              const tabResult = await this.processTabByName(workbook, tabName, prodHeaders, prodRowData, currentWeld);
              if (tabResult) results.push({ type: 'tab', weldId: currentWeld || `Row ${i + 1}`, tabName, ...tabResult });
            }

            expect("Processing Successful").toBe("Processing Successful");
            results.push({ type: 'weld', weldId: currentWeld || `Row ${i + 1}`, pass: true, expected: 'Found', actual: 'Found', detail: 'Detail View, tabs processed' });
          } catch (error) {
            console.error(`❌ Failed processing ${currentWeld}:`, error.message);
            results.push({ type: 'weld', weldId: currentWeld || `Row ${i + 1}`, pass: false, expected: 'Found', actual: error.message, detail: error.message });
            expect(error.message, `Weld ${currentWeld} Processing`).toBe("Processing Successful");
          }
        });
      } finally {
        // Clear search to reset table for next iteration
        await this.goBackSafe();

        // ✅ FIX: Now clear the search bar on the main table
        if (currentWeld) {
          await this.clearSearch();
        }

        // Save progress after every weld
        await workbook.xlsx.writeFile(filepath);
      }

      if (prodLimit && i + 1 >= prodLimit) break;
    }
    console.log(`\n final report saved: ${filepath}`);
    return { filepath, results };
  }

  async searchAndFilterWeld(weldId) {
    const idStr = String(weldId).trim();
    const searchInput = this.locators.searchInput();

    // 1. Precise Clear and Search
    await searchInput.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await searchInput.fill(idStr);
    await this.page.keyboard.press('Enter');

    // 2. Locate the "Weld ID" and "Weld Data" column indices
    const weldIdCol = await this.getColumnIndexByName('Weld ID');
    const weldDataCol = await this.getColumnIndexByName('Weld Data');

    // 3. TARGET THE EXACT ROW
    const targetRow = this.locators.rowByWeldId(idStr, weldIdCol);

    try {
      // Wait for the exact row to appear (Reactive wait)
      await targetRow.waitFor({ state: 'visible', timeout: 15000 });

      // 4. CLICK THE EYE ICON IN THE CORRECT ROW
      const eyeButton = this.locators.eyeButtonInRowByCol(targetRow, weldDataCol);

      await targetRow.scrollIntoViewIfNeeded();
      await eyeButton.click();

      // Wait for tabs to appear to confirm we entered the detail view
      await this.page.waitForSelector(this.locators.tabSelector(), { state: 'visible' });
      console.log(`🎯 Successfully entered Detail View for Weld ID: ${idStr}`);

    } catch (e) {
      // Check if the table is empty (search returned no results)
      if (await this.locators.noWeldDataText().isVisible()) {
        throw new Error(`❌ Search for Weld ID "${idStr}" returned no results (Table says 'No weld data available').`);
      }
      throw new Error(`❌ Exact Weld ID ${idStr} not found or eye button missing.`);
    }
  }

  async clearSearch() {
    const clearBtn = this.locators.clearButton();

    // Use a shorter timeout and force the click if necessary
    if (await clearBtn.isVisible()) {
      try {
        await clearBtn.click({ timeout: 5000 });
      } catch (e) {
        // If clicking the "X" fails, fallback to manual clear
        const input = this.locators.searchFallbackInput();
        await input.click();
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.keyboard.press('Enter');
      }
    } else {
      await this.locators.searchFallbackInput().fill('');
      await this.page.keyboard.press('Enter');
    }
    await this.page.waitForTimeout(1000); // Wait for table to reset
  }

  async parseCellValue(cell) {
    return await cell.evaluate(el => {

      const text = el.innerText.trim();

      // icon detection
      if (el.querySelector('svg.lucide-thumbs-up')) return { value: 'true' };
      if (el.querySelector('svg.lucide-thumbs-down')) return { value: 'false' };
      if (el.querySelector('svg.lucide-alert-circle')) return { value: '!' };
      if (el.querySelector('svg.lucide-minus')) return { value: '-' };
      if (el.querySelector('svg.lucide-x')) return { value: 'x' };

      let bgColor = null;

      const elements = el.querySelectorAll('*');

      elements.forEach(child => {
        const style = window.getComputedStyle(child);
        const bg = style.backgroundColor;

        if (
          bg &&
          bg !== 'rgba(0, 0, 0, 0)' &&
          bg !== 'transparent' &&
          !bg.includes('249, 250, 251') &&  // ignore grey
          !bg.includes('243, 244, 246')
        ) {
          bgColor = bg; // keep updating → deepest element wins
        }
      });

      return {
        value: text,
        bgColor
      };
    });
  }

  async processTabByName(workbook, tabName, prodHeaders, prodRowData, currentWeldId) {
    const cfg = this.scanConfig[tabName] || {};
    try {
      console.log(`--- Processing ${tabName} Tab ---`);
      const tab = this.locators.tab(tabName);
      if (await tab.count() === 0) return { viewOk: false, tlogsOk: cfg.tlogs ? false : null };
      await tab.click({ timeout: 5000 });
      await this.page.waitForSelector('table tbody tr', { state: 'visible', timeout: 5000 });
      return await this.processTabView(workbook, tabName, prodHeaders, prodRowData, currentWeldId);
    } catch (err) {
      console.warn(`⚠️ ${tabName} Tab failed:`, err.message);
      return { viewOk: false, tlogsOk: cfg.tlogs ? false : null };
    }
  }

  // 🔥 NEW: Bulk extraction helper to speed up table scraping
  async extractTableData(tableLocator, startIndex = 0) {
    return await tableLocator.evaluate((table, startIdx) => {
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        return cells.slice(startIdx).map(cell => {
          const text = cell.innerText.trim();

          // icon detection
          if (cell.querySelector('svg.lucide-thumbs-up')) return { value: 'true' };
          if (cell.querySelector('svg.lucide-thumbs-down')) return { value: 'false' };
          if (cell.querySelector('svg.lucide-alert-circle')) return { value: '!' };
          if (cell.querySelector('svg.lucide-minus')) return { value: '-' };
          if (cell.querySelector('svg.lucide-x')) return { value: 'x' };

          let bgColor = null;
          const elements = cell.querySelectorAll('*');
          elements.forEach(child => {
            const style = window.getComputedStyle(child);
            const bg = style.backgroundColor;
            if (
              bg &&
              bg !== 'rgba(0, 0, 0, 0)' &&
              bg !== 'transparent' &&
              !bg.includes('249, 250, 251') &&  // ignore grey
              !bg.includes('243, 244, 246')
            ) {
              bgColor = bg;
            }
          });

          return {
            value: text,
            bgColor
          };
        });
      });
    }, startIndex);
  }

  async processTabView(workbook, viewName, prodHeaders, prodRowData, currentWeldId) {
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
    const viewScroller = this.locators.tableScroller();
    if (await viewScroller.isVisible()) await autoScroll(viewScroller);

    const activeTable = this.locators.activeTable();

    // 🌟 DYNAMIC CHECKBOX DETECTION 🌟
    const firstTh = activeTable.locator('thead th').first();
    let startIndex = 0;
    if (await firstTh.isVisible() && await firstTh.locator('button[role="checkbox"], input[type="checkbox"]').count() > 0) {
      startIndex = 1; // Skip the checkbox column
    }

    // 1. Get Headers using the dynamic startIndex
    let headers = [];
    try {
      const thElements = activeTable.locator('thead th');
      const thCount = await thElements.count();
      for (let i = startIndex; i < thCount; i++) {
        const text = await thElements.nth(i).innerText();
        if (text.trim().length > 0) headers.push(text.trim());
      }
    } catch (e) {}

    if (headers.length === 0) {
      headers = ['Sl.no', 'Status', 'Station', 'Welder ID', 'Direction', 'Action', 'Mode',
        'Start Time', 'Duration', 'Auto?', 'Current(A)', 'Voltage(V)', 'Travel Speed',
        'Heat Input', 'Wire Speed'];
    }

    if (viewSheet && !viewSheet._headersWritten) {
      viewSheet.addRow(['Weld ID', ...headers]);
      viewSheet._headersWritten = true;
    }

    // 2. Capture Rows using the dynamic startIndex
    const rowsLocator = activeTable.locator('tbody tr');
    const capturedRows = [];

    // ⚡ OPTIMIZED: Extract all rows in one go instead of iterating with locators
    const allRowsData = await this.extractTableData(activeTable, startIndex);

    allRowsData.forEach((rowData, i) => {
      // Keep rows with data (removed strict isNaN so Pass rows aren't deleted)
      if (rowData.length >= 3 && rowData.some(d => (typeof d === 'object' ? d.value : d).trim() !== '')) {
        const rowWithId = [currentWeldId, ...rowData];
        if (viewSheet) this.addRowWithColor(viewSheet, rowWithId);
        if (analysisSheet) capturedRows.push({ index: i, data: rowWithId });
      }
    });

    // 5️⃣ Click eye-icon only if tlogs is enabled
    let tlogsOk = false;
    if (analysisSheet) {
      for (const item of capturedRows) {
        const row = rowsLocator.nth(item.index);
        const eye = this.locators.eyeButtonInRow(row);
        if (await eye.count() > 0) {
          console.log(`   🔍 Row ${item.data[0]}: Opening Data Analysis`);
          await row.hover();
          await eye.click({ force: true });
          const headerCount = await this.scanDataAnalysis(analysisSheet, viewName, prodHeaders, prodRowData, item.data, currentWeldId).catch(() => 0);
          if (headerCount > 0) tlogsOk = true;
          await this.page.waitForSelector(`table tbody tr`, { state: 'visible' });
          await this.page.waitForTimeout(1000);
        }
      }
    }
    return { viewOk: headers.length > 0, tlogsOk: analysisSheet ? tlogsOk : null };
  }

  addRowWithColor(sheet, rowData) {
    const values = rowData.map(c => typeof c === 'object' ? c.value : c);
    const excelRow = sheet.addRow(values);

    rowData.forEach((cell, i) => {
      if (cell && typeof cell === 'object' && cell.bgColor && cell.bgColor !== 'rgba(0, 0, 0, 0)') {
        const rgb = cell.bgColor.match(/\d+/g);
        if (!rgb) return;

        const hex =
          ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2]))
            .toString(16)
            .slice(1)
            .toUpperCase();

        excelRow.getCell(i + 1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${hex}` }
        };
      }
    });
  }

  async scanDataAnalysis(sheet, viewName, prodHeaders, prodRowData, viewRowData, currentWeldId) {
    sheet._headersWritten = sheet._headersWritten ?? false;

    let dataHeaders = [];

    // 🚨 CRITICAL: Wait for DataAnalysis page to fully load
    await this.page.waitForTimeout(2000);

    try {
      // We look for a table that has many columns (typical for Data Analysis)
      const tables = await this.locators.allTables().all();
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
    } catch (e) {
      console.log("Error finding table: ", e);
    }

    // 2️⃣ (Rest of your original logic unchanged)
    if (dataHeaders.length < 10) {
      try {
        // Fallback to first row headers if previous step failed
        dataHeaders = await this.page.locator('table tbody tr:first-child td').allInnerTexts();
        console.log(`✅ DataAnalysis: Fallback headers (${dataHeaders.length})`);
      } catch (e) {}
    }

    if (dataHeaders.length === 0) {
      dataHeaders = ['Sl.no', 'Status', 'Weld ID', 'Time', 'Pass No', 'Mode', 'Program', 'Position', 'Distance', 'Travel Speed', 'Voltage', 'Current', 'Wire Feed Speed', 'Ext1', 'Ext2', 'Ext3', 'Ext4', 'Ext5', 'Ext6', 'Ext7', 'Ext8', 'Ext9'];
    }

    if (!sheet._headersWritten) {
      // We add 'Search Weld ID' as the first column header
      sheet.addRow(['Search Weld ID', ...dataHeaders]);
      sheet._headersWritten = true;
    }

    // Scroll & capture
    const scroller = this.locators.tableScroller();
    if (await scroller.isVisible()) {
      await scroller.evaluate(el => el.scrollTop = el.scrollHeight);
    }

    // Identify the table again for row extraction
    const tables = await this.locators.allTables().all();
    let analysisTable;
    for (const t of tables) {
      if (await t.locator('tr:first-child td').count() > 10) {
        analysisTable = t;
        break;
      }
    }
    const target = analysisTable || this.locators.firstTable();

    // ⚡ OPTIMIZED: Extract all rows in one go
    const allRowsData = await this.extractTableData(target, 0);

    allRowsData.forEach(rowData => {
      const firstVal = typeof rowData[0] === 'object' ? rowData[0].value : rowData[0];
      if (firstVal && !isNaN(firstVal.trim())) {
        this.addRowWithColor(sheet, [currentWeldId, ...rowData]);
      }
    });

    await this.goBackSafe();
    return dataHeaders.length;
  }

  async goBackSafe() {
    const backBtn = this.locators.backButton();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await this.page.waitForLoadState('networkidle');
    }
  }

  async WelddataEye(index) {
    const weldDataCol = await this.getColumnIndexByName('Weld Data');
    const row = this.locators.tableBodyRows().nth(index);

    // Scroll the specific row into view so the click doesn't miss
    await row.scrollIntoViewIfNeeded();

    const eyeButton = this.locators.weldDataEyeButton(row, weldDataCol);
    await eyeButton.waitFor({ state: 'visible' });
    await eyeButton.click();

    await this.page.waitForSelector(this.locators.tabSelector(), { state: 'visible' });
  }

  async getColumnIndexByName(name) {
    const headers = this.locators.tableHeaders();
    for (let i = 0; i < (await headers.count()); i++) {
      const txt = await headers.nth(i).innerText();
      if (txt.toLowerCase().includes(name.toLowerCase())) return i + 1;
    }
    throw new Error(`Column "${name}" not found`);
  }

  async generateWeldSummarySheet(workbook, currentWeldId) {
    let sheet = workbook.getWorksheet('WeldSummary');

    if (!sheet) {
      sheet = workbook.addWorksheet('WeldSummary');
      const headers = await this.locators.firstTable().locator('thead th').allInnerTexts();
      sheet.addRow(headers);
    }

    // After search filter, the first row is the weld we want
    const row = this.locators.firstDataRow();

    if (await row.count() > 0) {
      const cells = await row.locator('td').all();
      const rowData = [];

      for (const cell of cells) {
        rowData.push(await this.parseCellValue(cell));
      }

      this.addRowWithColor(sheet, rowData);

    } else {
      console.warn(`⚠️ Summary row for ${currentWeldId} not found.`);
    }
  }
}

module.exports = ProductionTabWeldData;