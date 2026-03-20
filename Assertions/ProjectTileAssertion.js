const { expect } = require('@playwright/test');

/**
 * ProjectTileAssertion
 * Centralised assertions for the first project tile in the Projects page.
 * Usage from a spec:
 *   await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, { ...expectedFields });
 */
class ProjectTileAssertion {
    /**
     * Assert that the first project tile on the Projects page
     * matches the expected values (only checks provided fields).
     */
    static async expectMatchesFirstTile(projectsPage, expected) {
        if (expected.name !== undefined) {
            expect.soft(await projectsPage.getFirstProjectName()).toBe(expected.name);
        }
        if (expected.number !== undefined) {
            expect.soft(await projectsPage.getFirstProjectNumber()).toBe(`#${expected.number}`);
        }
        if (expected.status !== undefined) {
            expect.soft(await projectsPage.getFirstProjectStatus()).toBe(expected.status);
        }
        if (expected.location !== undefined) {
            expect.soft(await projectsPage.getFirstProjectLocation()).toBe(expected.location);
        }
        if (expected.customer !== undefined) {
            expect.soft(await projectsPage.getFirstProjectCustomer()).toBe(expected.customer);
        }
        if (expected.dateRange !== undefined) {
            expect.soft(await projectsPage.getFirstProjectDateRange()).toBe(expected.dateRange);
        }
        if (expected.types !== undefined) {
            const actualTypes = await projectsPage.getFirstProjectTypes();
            const sortedActual = [...actualTypes].sort();
            const sortedExpected = [...expected.types].sort();
            expect.soft(sortedActual).toEqual(sortedExpected);
        }
    }
}

module.exports = ProjectTileAssertion;

