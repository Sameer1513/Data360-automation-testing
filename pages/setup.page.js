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
//   getProjectConfig(projectName) {
//     if (config.mode === "single") return config.singleProject;
//     return config.multiProject.find(p => p.projectName === projectName);
//   }

 async performSetup(projectName) {
    const project = this.getProjectConfig(projectName);
    if (!project || !project.setupConfig) return;

    // 1. OPEN PROJECT
    await this.page.getByPlaceholder('Search Project').fill(projectName);
    await this.page.getByText(projectName, { exact: true }).first().click();
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
    for (let i = 0; i < incomingPipes.length; i++) {
        const pipeLabel = `Pipe ${i + 1}`;
        console.log(`🔍 Actively searching for: ${pipeLabel}`);

        const pipeContainer = this.page.locator('div')
            .filter({ hasText: new RegExp(`^${pipeLabel}$`) })
            .first()
            .locator('xpath=./ancestor::div[contains(@class, "ant-card") or contains(@class, "border")][1]');
        
        await pipeContainer.waitFor({ state: 'visible' });
        await this.fillPipeRow(pipeContainer, incomingPipes[i]);
    }

    // 5. SAVE
    await this.page.getByRole('button', { name: 'Save' }).click();
  } // <--- THIS WAS MISSING. Closes performSetup.

async fillPipeRow(container, pipe) {
    // 1. Basic Details using exact placeholders
    await container.getByPlaceholder('Enter pipe size').fill(pipe.pipeSize);
    await container.getByPlaceholder('Enter wall thickness').fill(pipe.wallThickness);
    await container.getByPlaceholder('Enter number of pipes').fill(pipe.pipeCount);
    await container.getByPlaceholder('Enter pipe length').fill(pipe.pipeLength);

    // 2. Manufacturer Dropdown Logic
 // 1. Open the Manufacturer dropdown
    await container.getByText('Select manufacturer').click();

    const manufacturers = Array.isArray(pipe.manufacturer) ? pipe.manufacturer : [pipe.manufacturer];

    for (let i = 0; i < manufacturers.length; i++) {
        const name = manufacturers[i];
        
        // FIX: Use a simpler global selector. Sometimes the 'hidden' class check 
        // conflicts with Playwright's 'visible' check during the animation.
        const searchInput = this.page.locator('input[placeholder="Search..."]').last();
        
        // Step 1: Wait and Search
        // Increase timeout slightly and ensure we click the dropdown again if the search isn't visible
        try {
            await searchInput.waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) {
            // Fallback: If search didn't appear, click the dropdown area again
            await container.getByText('Select manufacturer').click();
            await searchInput.waitFor({ state: 'visible', timeout: 3000 });
        }

        await searchInput.click();
        await searchInput.fill(name);
        
        // Give the UI a tiny moment to filter the list
        await this.page.waitForTimeout(500);
        await this.page.keyboard.press('Enter'); 
        console.log(`✅ Selected: ${name}`);

        // Step 2: Use Conditional Operator (Restored logic)
        (i < manufacturers.length - 1) 
            ? await (async () => {
                await this.page.keyboard.press('Control+A');
                await this.page.keyboard.press('Backspace');
              })()
            : await (async () => {
                await this.page.keyboard.press('Escape');
                await container.locator('label').filter({ hasText: /^Number of WPS Number$/ }).click({ force: true });
                await container.locator('.ant-select-selection-item').filter({ hasText: name }).waitFor({ state: 'visible' });
              })();
    }
    
    // --- WPS COUNT LOGIC ---
// --- FINAL WPS LOGIC (Force Scroll & Click) ---
    const wpsList = Array.isArray(pipe.wps) ? pipe.wps : [pipe.wps];
    const targetCount = wpsList.length;

    // Step 1: Handle row expansion if JSON requires more than 1 WPS
    if (targetCount > 1) {
        const wpsCountInput = container.locator(`input[id="numberOfJobs-${index}"]`);
        
        // Explicitly scroll and click to ensure the field is "active"
        await wpsCountInput.scrollIntoViewIfNeeded();
        await wpsCountInput.click({ force: true });

        // Force React to recognize the change to generate multiple rows
        await wpsCountInput.evaluate((el, count) => {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeSetter.call(el, count);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }, targetCount);

        await this.page.keyboard.press('Tab');
        
        // Sync: Wait for the dynamic rows to actually appear in the DOM
        const lastPlaceholder = `Enter WPS Number ${targetCount}`;
        await container.getByPlaceholder(lastPlaceholder).waitFor({ 
            state: 'visible', 
            timeout: 8000 
        });
    }

    // Step 2: Fill values with forced scrolling and clicking (Handles the scrolling issue)
    for (let j = 0; j < wpsList.length; j++) {
        const placeholder = `Enter WPS Number ${j + 1}`;
        const wpsField = container.getByPlaceholder(placeholder);

        // 1. FORCED SCROLL: Move the specific field to the center of the viewport
        // This ensures the field is not hidden by the header or off-screen
        await wpsField.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
        
        // 2. Physical click to ensure the field is ready for 'fill'
        await wpsField.click({ force: true });
        
        // 3. Fill the actual value from your JSON (e.g., "abc")
        await wpsField.fill(String(wpsList[j]));
        
        console.log(`✅ Pipe ${index + 1} - Filled ${placeholder}: ${wpsList[j]}`);
    }
}
}




module.exports = SetupPage;