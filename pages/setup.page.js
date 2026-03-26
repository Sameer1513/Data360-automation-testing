const fs = require('fs');
const path = require('path');
const locators = require('../Locators/SetupLocators.page');
const CommonHelper = require('../Helper/CommonHelper');
const { expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper.js');

class SetupPage {
  constructor(page) {
    this.page = page;
    this.helper = new CommonHelper(page);
    this.configPath = path.join(__dirname, '../config/Combinations.json');
  }
getProjectConfig(projectName) {
    const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    // 1. Check if it's a simple single-project mode
    if (config.mode === "single") {
        return config.singleProject;
    }
    
    // 2. Search in the multiProject array for the specific project name
    let project = config.multiProject.find(p => p.projectName === projectName);
    
    // 3. Fallback: Search in multiBrowser array if not found in multiProject
    if (!project && config.multiBrowser) {
        project = config.multiBrowser.find(p => p.projectName === projectName);
    }
    
    return project;
}


 async performSetup(projectName) {
    const project = this.getProjectConfig(projectName);
    if (!project || !project.setupConfig) return;

    // 1. OPEN PROJECT
    await this.helper.selectProject(projectName);

    // 2. NAVIGATION
    await locators.setupTab(this.page).click();
    

    const incomingPipes = project.setupConfig.pipes;
    const pipeCountInput = locators.pipeCountInput(this.page);
    
    // 3. ENTER PIPE COUNT
    await pipeCountInput.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await pipeCountInput.type(incomingPipes.length.toString(), { delay: 100 });

    // Wait for header to confirm UI update
    await locators.pipeDetailsHeader(this.page).waitFor({ state: 'visible', timeout: 10000 });

    // 4. FILL ALL ROWS
    // 4. FILL ALL ROWS
    for (let i = 0; i < incomingPipes.length; i++) {
        const pipeLabel = `Pipe ${i + 1}`;
        console.log(`🔍 Processing: ${pipeLabel}`);

        const pipeContainer = locators.pipeContainer(this.page, pipeLabel);
        
        await pipeContainer.waitFor({ state: 'visible' });
        await this.fillPipeRow(pipeContainer, incomingPipes[i], i);
    }

    // 5. SAVE WITH RETRY
    console.log("💾 Attempting to Save...");
    const saveButton = locators.saveBtn(this.page);
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for the success message to appear.
    const successToast = locators.successToast(this.page);
    let isSaved = false;
    try {
        await successToast.waitFor({ state: 'visible', timeout: 15000 });
        isSaved = true;
        console.log("✅ Setup Saved Successfully");
    } catch(e) { console.log("⚠️ Save toast missed or not visible"); }
    
    // Optional: wait for it to disappear to avoid interfering with next steps.
    if(isSaved) await successToast.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    assertion.log(
        `Setup Configuration: ${projectName}`,
        isSaved ? 'Success Toast Appeared' : 'Success Toast Not Detected',
        'Setup Saved Successfully',
        isSaved ? 'PASS' : 'FAIL'
    );
  } // <--- THIS WAS MISSING. Closes performSetup.



async fillPipeRow(container, pipe, index) {
    // 1. Basic Details
    await locators.pipeSizeInput(container).fill(pipe.pipeSize);
    await locators.wallThicknessInput(container).fill(pipe.wallThickness);
    await locators.pipeCountRowInput(container).fill(pipe.pipeCount);
    await locators.pipeLengthInput(container).fill(pipe.pipeLength);

    // 2. Manufacturer Dropdown with Search Visibility Logic
    const manufacturers = Array.isArray(pipe.manufacturer) ? pipe.manufacturer : [pipe.manufacturer];
    
    for (let i = 0; i < manufacturers.length; i++) {
        // DEVELOPER NOTE: This loop handles manufacturer selection. The current implementation
        // types a name, hits Enter, and then clears the input for the next name. This pattern
        // assumes the UI does not support true multi-select via checkboxes or tags. If the UI
        // changes to a standard multi-select component, this logic will need to be updated to
        // click each option without clearing the input.
        const name = manufacturers[i];
        
        // Open dropdown only if search is not already visible
        const searchInput = locators.manufacturerSearch(this.page);
        if (!(await searchInput.isVisible())) {
            await locators.manufacturerPlaceholder(container).click();
        }

        await searchInput.waitFor({ state: 'visible', timeout: 3000 });
        await searchInput.fill(name);
        await this.page.waitForTimeout(500);
        await this.page.keyboard.press('Enter');
        
        if (i < manufacturers.length - 1) {
            await this.page.keyboard.press('Control+A');
            await this.page.keyboard.press('Backspace');
        }
    }

    // 3. FORCE DISMISS DROPDOWN
    // We press Escape twice to ensure any nested dropdown layers are gone
    await this.page.keyboard.press('Escape');
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);

    // Reset UI focus by clicking the Pipe Size Input (Safe) instead of Header (which might collapse the row)
    await locators.pipeSizeInput(container).click({ force: true });

    // 4. WPS ENTRY WITH RETRY
    const wpsList = Array.isArray(pipe.wps) ? pipe.wps : [pipe.wps];
    const placeholderText = "Job Number 1"; 
    const firstWpsInput = locators.wpsInput(container, placeholderText);

    let wpsFilled = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            // Scroll specifically to move the field away from the sticky header
            await firstWpsInput.evaluate((el) => {
                const scroller = el.closest('[role="tabpanel"].overflow-auto') || window;
                const offset = el.getBoundingClientRect().top;
                scroller.scrollBy(0, offset - 200); // Buffer of 200px from top
            });

            await firstWpsInput.waitFor({ state: 'visible', timeout: 2000 });
            await firstWpsInput.click({ force: true });
            await firstWpsInput.type(String(wpsList[0]), { delay: 100 });
            
            // Verify if the value was actually entered
            const val = await firstWpsInput.inputValue();
            if (val === String(wpsList[0])) {
                wpsFilled = true;
                break;
            }
        } catch (e) {
            // The original code failed here because 'pipeHeader' is not defined in this scope.
            console.log(`⚠️ WPS Entry attempt ${attempt + 1} failed, retrying focus. Error: ${e.message}`);
            await locators.pipeSizeInput(container).click({ force: true }); // FIX: Click a stable element to reset focus.
            await this.page.waitForTimeout(500);
        }
    }

    if (!wpsFilled) console.error(`❌ Failed to fill WPS for Pipe ${index + 1}`);
    else console.log(`✅ Pipe ${index + 1} WPS filled.`);
}
}




module.exports = SetupPage;