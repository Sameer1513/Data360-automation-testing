const { test, expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper');

/**
 * ProductionTabAssertion
 * Owns the 3-check production tab validation for Step 8 & 9.
 * Same format as LoginAssertion: test.step + assertion.log + attachStepSummary.
 * Called from the spec: await productionTabAssertion.run(projectName, test.info())
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
                const actual   = `"${projectName}" found and opened`;
                const expected = 'Project Opens Successfully';
                const detail   = 'Search input used, project tile clicked';
                checks.push({ name: 'Project Search', expected, actual, pass: true, detail });
                assertion.log('Production: Project Search', actual, expected, 'PASS', detail, testInfo);
            } catch (e) {
                checks.push({ name: 'Project Search', expected: 'Project Opens Successfully', actual: e.message, pass: false, detail: '' });
                assertion.log('Production: Project Search', e.message, 'Project Opens Successfully', 'FAIL', e.message, testInfo);
                throw e;
            }
        });

        await test.step('Click Production tab and verify it is active', async () => {
            try {
                const productionTab = this.page.getByRole('tab', { name: /Production/i });
                await productionTab.click();
                await expect(productionTab).toHaveAttribute('aria-selected', 'true');
                const actual   = 'aria-selected = true';
                const expected = 'aria-selected = true';
                const detail   = 'Tab clicked and verified active';
                checks.push({ name: 'Production Tab Active', expected, actual, pass: true, detail });
                assertion.log('Production: Production Tab Active', actual, expected, 'PASS', detail, testInfo);
            } catch (e) {
                checks.push({ name: 'Production Tab Active', expected: 'aria-selected = true', actual: e.message, pass: false, detail: '' });
                assertion.log('Production: Production Tab Active', e.message, 'aria-selected = true', 'FAIL', e.message, testInfo);
                throw e;
            }
        });

        await test.step('Verify weld data rows are visible in table', async () => {
            try {
                const weldRows = this.page.locator('table tbody tr');
                await weldRows.first().waitFor({ state: 'visible' });
                const count = await weldRows.count();
                expect(count, 'Production table should have at least one weld row').toBeGreaterThan(0);
                const actual   = `${count} row(s) loaded`;
                const expected = 'At least 1 row visible';
                const detail   = `Table has ${count} weld rows`;
                checks.push({ name: 'Weld Data Table', expected, actual, pass: true, detail });
                assertion.log('Production: Weld Data Table', actual, expected, 'PASS', detail, testInfo);
            } catch (e) {
                checks.push({ name: 'Weld Data Table', expected: 'At least 1 row visible', actual: e.message, pass: false, detail: '' });
                assertion.log('Production: Weld Data Table', e.message, 'At least 1 row visible', 'FAIL', e.message, testInfo);
                throw e;
            }
        });

        // Same as LoginAssertion: structured HTML summary (Check, Expected, Actual, Details, Result)
        await assertion.attachStepSummary('Production Tab — Open Project & Verify', checks, testInfo);
    }
}

module.exports = ProductionTabAssertion;