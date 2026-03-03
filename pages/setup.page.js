const fs = require('fs');
const path = require('path');

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/Combinations.json'), 'utf-8')
);

class SetupPage {
  constructor(page) {
    this.page = page;
  }
getProjectConfig(projectName) {
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
    console.log(`🔍 Searching and selecting project for setup: ${projectName}`);
    const searchInput = this.page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill(projectName);
    await this.page.keyboard.press('Enter');

    // This updated logic clicks the project container directly, which is more robust
    // and consistent with other parts of the test suite.
    const projectTile = this.page.getByText(
      new RegExp(`^${projectName}$`, 'i')
    ).first();
    await projectTile.waitFor({ state: 'visible' });
    await projectTile.click();
    await this.page.waitForLoadState('networkidle');

    // 2. NAVIGATION
    await this.page.getByRole('tab', { name: 'Setup' }).click();
    

    const incomingPipes = project.setupConfig.pipes;
    const pipeCountInput = this.page.locator('input[placeholder="Enter number of pipe sizes"]');
    
    // 3. ENTER PIPE COUNT
    await pipeCountInput.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await pipeCountInput.type(incomingPipes.length.toString(), { delay: 100 });

    // Wait for header to confirm UI update
    await this.page.locator('text=Pipe Size Details').waitFor({ state: 'visible', timeout: 10000 });

    // 4. FILL ALL ROWS
    // 4. FILL ALL ROWS
    for (let i = 0; i < incomingPipes.length; i++) {
        const pipeLabel = `Pipe ${i + 1}`;
        console.log(`🔍 Processing: ${pipeLabel}`);

        const pipeContainer = this.page.locator('div')
            .filter({ hasText: new RegExp(`^${pipeLabel}$`) })
            .first()
            .locator('xpath=./ancestor::div[contains(@class, "ant-card") or contains(@class, "border")][1]');
        
        await pipeContainer.waitFor({ state: 'visible' });
        await this.fillPipeRow(pipeContainer, incomingPipes[i], i);
    }

    // 5. SAVE WITH RETRY
    console.log("💾 Attempting to Save...");
    const saveButton = this.page.getByRole('button', { name: 'Save' });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    await this.page.waitForLoadState('networkidle');
    console.log("✅ Setup Saved Successfully");
  } // <--- THIS WAS MISSING. Closes performSetup.



async fillPipeRow(container, pipe, index) {
    // 1. Basic Details
    await container.getByPlaceholder('Enter pipe size').fill(pipe.pipeSize);
    await container.getByPlaceholder('Enter wall thickness').fill(pipe.wallThickness);
    await container.getByPlaceholder('Enter number of pipes').fill(pipe.pipeCount);
    await container.getByPlaceholder('Enter pipe length').fill(pipe.pipeLength);

    // 2. Manufacturer Dropdown with Search Visibility Logic
    const manufacturers = Array.isArray(pipe.manufacturer) ? pipe.manufacturer : [pipe.manufacturer];
    
    for (let i = 0; i < manufacturers.length; i++) {
        const name = manufacturers[i];
        
        // Open dropdown only if search is not already visible
        const searchInput = this.page.locator('input[placeholder="Search..."]').last();
        if (!(await searchInput.isVisible())) {
            await container.getByText('Select manufacturer').click();
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

    // Reset UI focus by clicking the Pipe Header to clear transparent overlays
    const pipeHeader = container.locator('h5', { hasText: `Pipe ${index + 1}` });
    await pipeHeader.click({ force: true });

    // 4. WPS ENTRY WITH RETRY
    const wpsList = Array.isArray(pipe.wps) ? pipe.wps : [pipe.wps];
    const placeholderText = "Enter WPS Number 1"; 
    const firstWpsInput = container.getByPlaceholder(placeholderText);

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
            await firstWpsInput.fill(String(wpsList[0]));
            
            // Verify if the value was actually entered
            const val = await firstWpsInput.inputValue();
            if (val === String(wpsList[0])) {
                wpsFilled = true;
                break;
            }
        } catch (e) {
            console.log(`⚠️ WPS Entry attempt ${attempt + 1} failed, retrying focus...`);
            await pipeHeader.click({ force: true });
            await this.page.waitForTimeout(500);
        }
    }

    if (!wpsFilled) console.error(`❌ Failed to fill WPS for Pipe ${index + 1}`);
    else console.log(`✅ Pipe ${index + 1} WPS filled.`);
}
}




module.exports = SetupPage;