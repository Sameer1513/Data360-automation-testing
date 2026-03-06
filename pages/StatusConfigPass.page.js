const fs = require('fs');
const path = require('path');
const {
    autoScroll
} = require('../utils/scroll.util');

class StatusConfigPass {
    constructor(page) {
        this.page = page;
        this.exportDir = path.join(process.cwd(), 'exports');

        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, {
                recursive: true
            });
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

        // Confirm page load using slope input
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

    async run(projectName, slopeIn, slopeOut) {
        await this.navigateToStatusConfig();

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

        return {
            weldDetails,
            gridData
        };
    }
    async extractWeldDetails() {
        const details = {};

        async function getFieldValue(page, labelText) {
            const label = page.locator('label', {
                hasText: labelText
            }).first();

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