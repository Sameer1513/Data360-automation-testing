const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const {
    autoScroll
} = require('../utils/scroll.util');

const { expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper.js');
const { sanitizeExcelSheetName, sanitizeFileSegment, sanitizeFolderName } = require('../Helper/excelNaming.util.js');

class StatusConfigPass {
    constructor(page) {
        this.page = page;
        this.baseExportDir = path.join(process.cwd(), 'exports');
    }

    async applyCalculationMethod(method) {
        if (!method) return;

        const dropdown = this.page
            .locator('label:has-text("Status Calculation Method")')
            .locator('xpath=following::button[@role="combobox"][1]');

        await dropdown.waitFor({ state: 'visible', timeout: 15000 });

        // Read current selected value (skip re-setting if already correct)
        let current = '';
        try {
            current = (await dropdown.locator('span').first().innerText()).trim();
        } catch (e) {
            // ignore; we'll try setting anyway
        }

        if (current && current.toLowerCase().trim() === method.toLowerCase().trim()) {
            console.log(`ℹ️ Status Calculation Method already set: ${current}`);
            return;
        }

        console.log(`⚙️ Setting Status Calculation Method → ${method}`);
        await dropdown.click();

        const option = this.page.locator(`div[role="option"]:has-text("${method}")`);
        await option.waitFor({ state: 'visible', timeout: 10000 });
        await option.click();

        console.log(`✅ Selected ${method}`);

        const saveBtn = this.page.getByRole('button', { name: /Save/i });
        await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
        await saveBtn.click();

        console.log("💾 Status Calculation Method saved");
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1500);
    }
 
    /**
     * @param {string} [projectName] — UI export folder: `exports/<projectName>/` (falls back to legacy `StatusConfig UI` if omitted)
     */
    async initializeExportDir(projectName) {
        if (!fs.existsSync(this.baseExportDir)) {
            fs.mkdirSync(this.baseExportDir, { recursive: true });
        }

        const folder = projectName ? sanitizeFolderName(projectName) : 'StatusConfig UI';
        this.exportDir = path.join(this.baseExportDir, folder);

        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }
 
    async navigateToStatusConfig() {
        console.log('🔁 Navigating to Status Configuration...');
 
        await this.page.getByRole('tab', {
            name: 'Production'
        }).click();
        await this.page.getByRole('button', {
            name: 'Status Configuration'
        }).click();
 
        await this.page.locator('div')
            .filter({
                hasText: /^In:$/
            })
            .locator('input')
            .waitFor({
                timeout: 15000
            });
 
        console.log('✅ Status Configuration Loaded');
    }
 
    async run(projectName, slopeIn, slopeOut, calculationMethod = null) {
        await this.navigateToStatusConfig();
 
        // If config asks for a specific calculation method, ensure UI matches it
        await this.applyCalculationMethod(calculationMethod);

        console.log('🔎 Extracting Weld Details...');
        const weldDetails = await this.extractWeldDetails();
 
        console.log('⏳ Waiting for Status Config table...');
        await this.page.waitForSelector(
            'span.text-gray-800.truncate', {
                timeout: 20000
            }
        );
 
        const scroller = this.page.locator('div.overflow-auto').first();
 
        if (await scroller.count()) {
            await autoScroll(scroller);
            await scroller.evaluate(el => {
                el.scrollLeft = el.scrollWidth;
            });
        }
 
        console.log('📊 Extracting structured grid...');
 
        const gridData = await this.page.evaluate(() => {
 
            const root = [...document.querySelectorAll('div')]
                .find(d => d.innerText.includes('Status Configuration Parameters'));
 
            if (!root) return {
                headers: [],
                rows: []
            };
 
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
 
            const labels = [
                    ...root.querySelectorAll('span.text-gray-800.truncate')
                ]
                .map(el => el.innerText.trim())
                .filter(Boolean);
 
            const rows = labels.map(label => [label]);
 
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
 
            for (let r = 0; r < paramCount; r++) {
                for (let p = 0; p < passCount; p++) {
                    const gridIndex = (r * passCount) + p;
                    const grid = allPassGrids[gridIndex];
                    const inputs = grid ?
                        grid.querySelectorAll('input[type="number"]') :
                        [];
 
                    rows[r].push(
                        inputs[0]?.value?.trim() || '',
                        inputs[1]?.value?.trim() || ''
                    );
                }
            }
 
            return {
                headers,
                rows
            };
        });
 
        console.log("✅ UI Data Extracted");
       
        await this.initializeExportDir(projectName);

        const filePath = await this.writeToExcel(projectName, weldDetails, gridData);
 
        console.log(`StatusConfigPass filePath generated: ${filePath}`);
        console.log(`StatusConfigPass returning object with filePath: ${filePath}`);
 
        assertion.log(
            `Status Config Extraction: ${projectName}`, 
            `File Generated: ${path.basename(filePath)}`, 
            'Status Config UI Data Extracted', 
            'PASS'
        );

        return {
            weldDetails,
            gridData,
            filePath
        };
    }
 
    async extractWeldDetails() {
        const details = {};
 
        async function getFieldValue(page, labelText) {
            const label = page.locator('label', {
                hasText: labelText
            }).first();
 
            if (!(await label.count())) return '';
 
            const container = label.locator('xpath=ancestor::*[1]');
 
            const combo = container.locator('button[role="combobox"]');
 
            if (await combo.count()) {
                const value = await combo.locator('span').first().innerText();
                return value.trim();
            }
 
            const input = container.locator('input');
            if (await input.count()) {
                return (await input.inputValue()).trim();
            }
 
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
 
    async goBackToProduction() {
        console.log("⬅ Returning to Production tab...");
 
        const backArrow = this.page
            .locator('svg.lucide-arrow-left')
            .locator('xpath=..');
 
        await backArrow.waitFor({ state: 'visible', timeout: 15000 });
 
        await backArrow.click();
 
        console.log("🔁 Clicked back arrow");
 
        await this.page.getByRole('tab', { name: /Production/i })
            .waitFor({ state: 'visible', timeout: 15000 });
 
        console.log("✅ Successfully returned to Production tab");
    }
 
    async writeToExcel(projectName, weldDetails, gridData) {
        const jobRaw = weldDetails['Job Number'];
        const hasJob = jobRaw != null && String(jobRaw).trim() !== '';
        const sheetName = sanitizeExcelSheetName(hasJob ? jobRaw : null);
        const fileBase = hasJob
            ? `${sanitizeFileSegment(jobRaw)}_StatusConfig_UI`
            : `${sanitizeFileSegment(projectName, projectName)}_StatusConfig_UI`;

        const filePath = path.join(this.exportDir, `${fileBase}.xlsx`);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(sheetName);
 
        let rowIndex = 1;
 
        // Write Weld Details
        sheet.getCell(`A${rowIndex}`).value = "Weld Details";
        rowIndex += 2;
 
        for (const key in weldDetails) {
            sheet.getCell(`A${rowIndex}`).value = key;
            sheet.getCell(`B${rowIndex}`).value = weldDetails[key];
            rowIndex++;
        }
 
        rowIndex += 2;
 
        // Write Table Headers
        sheet.addRow(gridData.headers);
 
        // Write Table Rows
        gridData.rows.forEach(row => {
            sheet.addRow(row);
        });
 
        await workbook.xlsx.writeFile(filePath);
 
        console.log(`📄 Status Config UI Excel generated: ${filePath}`);
        return filePath;
    }
}
 
module.exports = StatusConfigPass;
