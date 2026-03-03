const { expect } = require('@playwright/test');
const locators = require('../Locators/DeviceAssigningLocators.page');

class DeviceAssigningPage {
    constructor(page) {
        this.page = page;
    }

    async navigateToDevices() {
        console.log("🚀 Navigating to Devices...");

        try {
            if (this.page.url().toLowerCase().includes('/devices')) {
                console.log("✅ Already on Devices page.");
                return;
            }

            console.log("   ⏳ Checking sidebar state...");
            const devicesBtn = locators.devicesMenuBtn(this.page).first();
            const trigger = locators.sidebarTrigger(this.page);

            if (!(await devicesBtn.isVisible())) {
                if (await trigger.isVisible()) {
                    console.log("   👆 Expanding sidebar...");
                    await trigger.click({ force: true });
                    await this.page.waitForTimeout(500); 
                }
            }

            console.log("   ⏳ Waiting for 'Devices' button to become interactable...");
            await devicesBtn.waitFor({ state: 'attached', timeout: 10000 });
            await devicesBtn.click({ force: true });
            
            console.log("   ⏳ Waiting for URL to change to /devices...");
            await this.page.waitForURL(/.*\/devices/i, { timeout: 15000 });
            
            console.log("   ⏳ Waiting for the Search Input to appear...");
            const searchInput = locators.deviceSearchInput(this.page).first();
            await searchInput.waitFor({ state: 'visible', timeout: 15000 });

            console.log("✅ Reached Devices page successfully.");
            
        } catch (error) {
            console.error(`❌ Navigation failed: ${error.message}`);
            throw error;
        }
    }

    async assignProjectToDevice(deviceId, projectName) {
        await this.navigateToDevices();

        console.log(`🔍 Attempting to search for Device ID: ${deviceId}`);
        const searchInput = locators.deviceSearchInput(this.page).first();

        const maxRetries = 3;
        let deviceCard;

        // ==========================================
        // 1. 🔄 RETRY LOGIC FOR SEARCH & FILTER
        // ==========================================
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`⏳ Search Attempt ${attempt}/${maxRetries} for: ${deviceId}`);
            
            try {
                await searchInput.waitFor({ state: 'visible', timeout: 15000 });
                await searchInput.scrollIntoViewIfNeeded();
                await searchInput.click({ force: true });
                
                // Human-like Clear (Ctrl+A / Backspace)
                await this.page.keyboard.press('Control+A');
                await this.page.keyboard.press('Backspace');
                await this.page.waitForTimeout(500); 

                // Human-like Typing
                await searchInput.pressSequentially(deviceId, { delay: 150 });
                await this.page.keyboard.press('Enter');
                
                console.log("⏳ Waiting for filtered device card to appear...");

                // Locate the Card using Reference Logic
                const deviceText = this.page.getByText(deviceId).first();
                await deviceText.waitFor({ state: 'visible', timeout: 10000 });

                // Find closest ancestor that contains a checkbox
                deviceCard = deviceText.locator('xpath=ancestor::*[.//*[@role="checkbox"] or .//input[@type="checkbox"]][1]');
                await deviceCard.waitFor({ state: 'visible', timeout: 5000 });

                console.log(`✔ Found device card on attempt ${attempt}.`);
                break; // Success! Exit the retry loop.

            } catch (error) {
                console.warn(`⚠️ Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt === maxRetries) {
                    throw new Error(`❌ Exhausted retries finding Device ID: ${deviceId}`);
                }
                
                // 🛑 CLEANUP & REFRESH FALLBACK
                try {
                    await searchInput.click({ force: true });
                    await this.page.keyboard.press('Control+A');
                    await this.page.keyboard.press('Backspace');
                    await this.page.keyboard.press('Enter');
                    await this.page.waitForTimeout(1000); 
                    
                    // Click the global Refresh button to fetch latest backend data
                    console.log(`🔄 Clicking Refresh before attempt ${attempt + 1}...`);
                    const refreshBtn = locators.refreshBtn(this.page).first();
                    if (await refreshBtn.isVisible()) {
                        await refreshBtn.click({ force: true });
                        await this.page.waitForTimeout(2500); 
                    }
                } catch (cleanupError) { /* ignore cleanup errors */ }
            }
        }

        // ==========================================
        // 2. Select the Checkbox
        // ==========================================
        console.log(`✔ Selecting checkbox...`);
        const checkbox = deviceCard.locator('[role="checkbox"], input[type="checkbox"]').first();
        await checkbox.scrollIntoViewIfNeeded();
        await checkbox.evaluate(el => el.click());

        // ==========================================
        // 3. Open Project Dropdown (Combobox)
        // ==========================================
        console.log(`📂 Opening Project Dropdown...`);
        const dropdown = locators.projectDropdown(this.page).first();
        
        await dropdown.scrollIntoViewIfNeeded();
        await dropdown.waitFor({ state: 'visible', timeout: 5000 });
        await dropdown.evaluate(el => el.click()); // Bypass 'pointer-events: none'

        // Wait for list to open
        console.log(`⏳ Waiting for dropdown menu to appear...`);
        const dropdownList = locators.dropdownList(this.page);
        await dropdownList.waitFor({ state: 'visible', timeout: 5000 });

        // ==========================================
        // 4. Select the project from the portal
        // ==========================================
        console.log(`   Searching for project option: ${projectName}`);
        const option = locators.projectOption(this.page, projectName).first();
        
        await option.scrollIntoViewIfNeeded();
        await option.click({ force: true });

        // ==========================================
        // 5. Submit Assignment & Confirm Modal
        // ==========================================
        console.log(`🔘 Submitting Assignment...`);
        const submit = locators.assignProjectBtn(this.page).first();
        await submit.waitFor({ state: 'visible' });
        await submit.click();

        console.log(`🛑 Handling Confirmation Modal...`);
        const confirmBtn = locators.confirmAssignmentBtn(this.page).first();
        await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
        await confirmBtn.click();

        // ==========================================
        // 6. Assertions & Success Verification
        // ==========================================
        console.log(`⏳ Verifying success message...`);
        const successToast = locators.successMessage(this.page).first();
        await successToast.waitFor({ state: 'visible', timeout: 15000 });
        
        // 🧪 ASSERTION: Hard check that the success message appeared
        await expect(successToast).toBeVisible();
        console.log(`✅ SUCCESS: Assigned ${projectName} to ${deviceId}`);

        // Wait for the success toast to disappear before proceeding
        await successToast.waitFor({ state: 'hidden', timeout: 5000 });

        // ==========================================
        // 7. Navigate Back to Projects Dashboard
        // ==========================================
        console.log(`🔙 Navigating back to Projects page...`);
        // FIX: Use a more robust locator for the Projects link based on its href
        const projectsLink = this.page.locator('a[href="/Projects"][data-discover="true"]').first();
        const trigger = locators.sidebarTrigger(this.page);

        // Ensure sidebar is expanded to show 'Projects'
        if (!(await projectsLink.isVisible())) {
            if (await trigger.isVisible()) {
                console.log("   👆 Expanding sidebar...");
                await trigger.click({ force: true });
                await this.page.waitForTimeout(500); 
            }
        }

        console.log("   🖱️ Clicking Projects link...");
        await projectsLink.waitFor({ state: 'visible', timeout: 10000 });
        await projectsLink.scrollIntoViewIfNeeded();
        await projectsLink.click();
        
        console.log("   ⏳ Waiting for navigation to /Projects...");
        await this.page.waitForURL(/.*\/projects/i, { timeout: 15000 });
        
        // 🧪 ASSERTION: Hard check that we successfully returned to the projects URL
        await expect(this.page).toHaveURL(/.*\/projects/i);
        console.log(`✅ Successfully returned to Projects page.`);
    }
}

module.exports = DeviceAssigningPage;