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
    if (config.mode === "single") return config.singleProject;
    return config.multiProject.find(p => p.projectName === projectName);
  }

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
 

const wpsList = Array.isArray(pipe.wps) ? pipe.wps : [pipe.wps];
const targetCount = wpsList.length.toString();

// 🔍 Stable locator (avoid fragile label matching)
const wpsCountInput = container.locator('input').filter({
  has: container.locator('text=Number of WPS Number')
}).first();

// 1️⃣ Ensure focus + kill dropdown interference
await this.page.keyboard.press('Escape');
await wpsCountInput.scrollIntoViewIfNeeded();
await wpsCountInput.click({ force: true });

// 2️⃣ Read current value
let currentValue = await wpsCountInput.inputValue();

// 3️⃣ Force change ONLY if needed
if (currentValue !== targetCount) {
  // Clear safely
  await wpsCountInput.press('Control+A');
  await wpsCountInput.press('Backspace');

  // 🔥 AntD trigger trick (force rerender)
  if (currentValue === targetCount || currentValue === '1') {
    await wpsCountInput.type('0', { delay: 50 });
    await wpsCountInput.blur();
    await this.page.waitForTimeout(300);

    await wpsCountInput.click();
    await wpsCountInput.press('Control+A');
  }

  // Type final value (NOT fill)
  await wpsCountInput.type(targetCount, { delay: 80 });

  // Trigger change properly
  await wpsCountInput.blur();
}

// 4️⃣ Wait for dynamic fields (NO timeout hacks)
await this.page.waitForFunction(
  (count) => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.filter(i => i.placeholder?.includes('Enter WPS Number')).length >= count;
  },
  targetCount,
  { timeout: 8000 }
);

// 5️⃣ Fill WPS values reliably
for (let j = 0; j < wpsList.length; j++) {
  const placeholder = `Enter WPS Number ${j + 1}`;
  const wpsField = container.getByPlaceholder(placeholder);

  await wpsField.waitFor({ state: 'visible' });
  await wpsField.scrollIntoViewIfNeeded();

  await wpsField.click({ force: true });

  // Clear + type (important for controlled inputs)
  await wpsField.press('Control+A');
  await wpsField.press('Backspace');
  await wpsField.type(String(wpsList[j]), { delay: 50 });

  // Optional blur for stability
  await wpsField.blur();

  console.log(`✅ Filled ${placeholder}: ${wpsList[j]}`);
}
}
}

module.exports = SetupPage;