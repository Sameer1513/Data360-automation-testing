const { test, expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper');

/**
 * ProductionTabAssertion
 * Owns the 3-check production tab validation for Step 8 & 9.
 * Called from the spec with a single line: await productionTabAssertion.run(projectName, info)
 */
class ProductionTabAssertion {

    constructor(page, helper) {
        this.page   = page;
        this.helper = helper;
    }

    async run(projectName, testInfo) {
        const checks = [];

        await test.step('Search and open project', async () => {
            try {
                await this.helper.selectProject(projectName);
                checks.push({ name: 'Project Search', expected: 'Project Opens Successfully', actual: `"${projectName}" found and opened`, pass: true, detail: 'Search input used, project tile clicked' });
            } catch (e) {
                checks.push({ name: 'Project Search', expected: 'Project Opens Successfully', actual: e.message, pass: false, detail: '' });
                throw e;
            }
        });

        await test.step('Click Production tab and verify it is active', async () => {
            try {
                const productionTab = this.page.getByRole('tab', { name: /Production/i });
                await productionTab.click();
                await expect(productionTab).toHaveAttribute('aria-selected', 'true');
                checks.push({ name: 'Production Tab Active', expected: 'aria-selected = true', actual: 'aria-selected = true', pass: true, detail: 'Tab clicked and verified active' });
            } catch (e) {
                checks.push({ name: 'Production Tab Active', expected: 'aria-selected = true', actual: e.message, pass: false, detail: '' });
                throw e;
            }
        });

        await test.step('Verify weld data rows are visible in table', async () => {
            try {
                const weldRows = this.page.locator('table tbody tr');
                await weldRows.first().waitFor({ state: 'visible' });
                const count = await weldRows.count();
                expect(count, 'Production table should have at least one weld row').toBeGreaterThan(0);
                checks.push({ name: 'Weld Data Table', expected: 'At least 1 row visible', actual: `${count} row(s) loaded`, pass: true, detail: `Table has ${count} weld rows` });
            } catch (e) {
                checks.push({ name: 'Weld Data Table', expected: 'At least 1 row visible', actual: e.message, pass: false, detail: '' });
                throw e;
            }
        });

        // Log to assertion dashboard
        checks.forEach(c => assertion.log(`Step 8/9: ${c.name}`, c.actual, c.expected, c.pass ? 'PASS' : 'FAIL', c.detail, null));

        // Attach structured HTML summary
        await assertion.attachStepSummary('Step 8 & 9 — Open Project & Verify Production Tab', checks, testInfo);
    }
}

module.exports = ProductionTabAssertion;