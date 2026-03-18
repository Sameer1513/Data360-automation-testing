const { test, expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper');

/**
 * ProductionTabAssertion
 * All production-tab assertions live here only (none in ProductionTabWeldData.page.js).
 * Same structure as LoginAssertion: test.step → checks array → assertion.log(stepName, actual, expected, status, detail, testInfo) → attachStepSummary.
 * Step 8 & 9: open project, Production tab active, weld table visible. run(projectName, test.info()).
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

        checks.push({
            name:     'Ready for Production Analysis',
            expected: 'Table loaded',
            actual:   'Table loaded',
            pass:     true,
            detail:   'ProductionTabWeldData.runFlow() can run in next step.'
        });

        await assertion.attachStepSummary('Production Scenarios', checks, testInfo);
    }

    /**
     * Attach UI Analysis step summary from runFlow results. All assertion logic here (none in page).
     * Results: [{ type: 'weld', weldId, pass, expected, actual, detail }] and
     *          [{ type: 'tab', weldId, tabName, viewOk, tlogsOk }].
     */
    async attachUIAnalysisSummary(results, testInfo) {
        if (!Array.isArray(results) || results.length === 0) return;
        const checks = [];
        for (const r of results) {
            if (r.type === 'weld') {
                checks.push({
                    name:     `Weld ${r.weldId}`,
                    expected: r.expected || 'Found',
                    actual:   r.actual ?? (r.pass ? 'Found' : 'Not found'),
                    pass:     !!r.pass,
                    detail:   r.detail || ''
                });
            } else if (r.type === 'tab') {
                checks.push({
                    name:     `Weld ${r.weldId} — ${r.tabName} tab (view)`,
                    expected: 'Present',
                    actual:   r.viewOk ? 'Present' : 'Not found',
                    pass:     !!r.viewOk,
                    detail:   r.viewOk ? 'View data loaded' : 'Tab or view data not found'
                });
                if (r.tlogsOk !== null && r.tlogsOk !== undefined) {
                    checks.push({
                        name:     `Weld ${r.weldId} — ${r.tabName} tab (tlogs)`,
                        expected: 'Present',
                        actual:   r.tlogsOk ? 'Present' : 'Not found',
                        pass:     !!r.tlogsOk,
                        detail:   r.tlogsOk ? 'Data Analysis opened' : 'Data Analysis not found'
                    });
                }
            }
        }
        await assertion.attachStepSummary('UI Analysis', checks, testInfo);
    }
}

module.exports = ProductionTabAssertion;