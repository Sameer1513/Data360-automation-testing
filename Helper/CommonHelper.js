const fs = require('fs');

class CommonHelper {
    constructor(page) {
        this.page = page;
    }

    /**
     * Resolves target weld IDs. Returns null if empty.
     */
    resolveTargetWelds(weldIds) {
        if (!weldIds || weldIds.length === 0) return null;
        return weldIds;
    }

    /**
     * Waits for the capturedDeviceId to appear in the config file.
     */
    async waitForDeviceId(configPath, timeout = 20000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const content = fs.readFileSync(configPath, 'utf-8');
                const updated = JSON.parse(content);
                if (updated.capturedDeviceId) {
                    return updated.capturedDeviceId;
                }
            } catch (e) {
                // Ignore file access errors (e.g., busy)
            }
            await new Promise(res => setTimeout(res, 1000));
        }
        throw new Error("❌ Device ID not generated within timeout.");
    }

    /**
     * Navigates to the Dashboard (if needed) and selects a project by name.
     */
    async selectProject(projectName) {
        console.log(`🔍 Searching and selecting project: ${projectName}`);
        
        // 1. Ensure we are on the Dashboard (Search Input Visible)
        const searchInput = this.page.locator('input[placeholder*="Search"]').first();
        
        // If search not visible, try navigating back to Projects via breadcrumb/header
        if (!(await searchInput.isVisible())) {
             const projectsBreadcrumb = this.page.locator('header').getByText('Projects', { exact: true });
             if (await projectsBreadcrumb.isVisible()) {
                 await projectsBreadcrumb.click();
                 await this.page.waitForLoadState('networkidle');
             }
        }

        await searchInput.waitFor({ state: 'visible' });
        await searchInput.click({ clickCount: 3 }); // Clear existing text
        await this.page.keyboard.press('Backspace');
        await searchInput.fill(projectName);
        await this.page.keyboard.press('Enter');

        const projectTile = this.page.getByText(new RegExp(`^${projectName}$`, 'i')).first();
        await projectTile.waitFor({ state: 'visible' });
        await projectTile.click();
    }
}

module.exports = CommonHelper;