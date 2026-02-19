class CreateProjectPage {
  constructor(page) {
    this.page = page;

    // Buttons
    this.createProjectBtn = page.getByRole('button', { name: 'Create Project' });
    this.submitBtn = page.getByRole('button', { name: 'Submit Project' });

    // Inputs
    this.projectNameInput = page.getByPlaceholder('Enter project name');
    this.projectNumberInput = page.getByPlaceholder('Enter project number');

    // Loaders & Toast
    this.loader = page.locator('text=Loading projects data...');
    this.toastCloseBtn = page.locator('.Toastify__close-button');
  }

  // ==========================
  // Utility Functions
  // ==========================
  async waitForLoader() {
    await this.loader.waitFor({ state: 'hidden', timeout: 30000 });
  }

  async closeToastIfVisible() {
    try {
      if (await this.toastCloseBtn.isVisible({ timeout: 2000 })) {
        await this.toastCloseBtn.click();
      }
    } catch (e) { /* ignore */ }
  }

  async openCreateProject() {
    // Set zoom to 67% to ensure dropdowns and dates stay on screen
    // await this.page.evaluate(() => { document.body.style.zoom = "67%"; });
    await this.waitForLoader();
    await this.closeToastIfVisible();

    await this.createProjectBtn.click();
    await this.projectNameInput.waitFor({ state: 'visible' });
  }

  // ==========================
  // ISOLATED: Select React Dropdown
  // ==========================
  async selectDropdown(type, value) {
    // Internal mapping: Keep UI text isolated here
    const placeholders = {
      location: "Select or enter location",
      customer: "Select or enter customer name"
    };

    const labelText = placeholders[type];
    const dropdown = this.page.locator('div').filter({ hasText: labelText }).last();

    console.log(`Dropdown Task: Finding "${value}" for ${type}`);

    try {
      await this.waitForLoader();
      await dropdown.scrollIntoViewIfNeeded();
      
      // Step 1: Click to focus the search box inside the dropdown
      await dropdown.click();

      // Step 2: Use keyboard to type (this is the most compatible way for React-Select)
      await this.page.keyboard.type(value, { delay: 50 });
      
      // Step 3: Wait for filtered results
      await this.page.waitForTimeout(800);

      // Step 4: Select the result (Case-Insensitive match)
      const option = this.page.locator('div').filter({ hasText: new RegExp(`^${value}$`, 'i') }).last();
      await option.waitFor({ state: 'visible', timeout: 1000 });
      await option.click();

      await this.page.waitForTimeout(300); 
    } catch (error) {
      console.error(`Isolated Dropdown Error (${type}): ${error.message}`);
      await this.page.keyboard.press('Escape');
      throw error;
    }
  }

  // ==========================
  // ISOLATED: Select Date
async selectDate(type, dateString) {
    const dateLabels = { start: "Start Date", end: "End Date" };
    const labelText = dateLabels[type];

    const [day, month, year] = dateString.split("-");
    const targetDay = parseInt(day);
    const targetYear = parseInt(year);

    const monthMap = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
        apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
        aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
        nov: 10, november: 10, dec: 11, december: 11
    };

    const targetMonth = monthMap[month.toLowerCase()];

    try {
        await this.waitForLoader();

        const container = this.page
            .locator('div')
            .filter({ hasText: new RegExp(`^${labelText}`) })
            .last();

        // FIX 1: Ensure container is in view before clicking
        await container.scrollIntoViewIfNeeded();
        await container.locator('input').click();

        // FIX 2: Dynamically detect the panel count
        const panels = this.page.locator('.ant-picker-panel:visible');
        await panels.first().waitFor();
        const panelCount = await panels.count();

        // If End Date and 2 panels exist, take the last one; otherwise, take the first.
        const activePanel = (type === "end" && panelCount > 1) 
            ? panels.last() 
            : panels.first();

        const header = activePanel.locator('.ant-picker-header-view');
        const prevYearBtn = activePanel.locator('.ant-picker-header-super-prev-btn');
        const nextYearBtn = activePanel.locator('.ant-picker-header-super-next-btn');
        const prevMonthBtn = activePanel.locator('.ant-picker-header-prev-btn');
        const nextMonthBtn = activePanel.locator('.ant-picker-header-next-btn');

        const getState = async () => {
            const text = (await header.innerText()).toLowerCase();
            const yearMatch = text.match(/\d{4}/);
            const monthMatch = text.match(/[a-z]+/);
            return {
                year: yearMatch ? parseInt(yearMatch[0]) : null,
                month: monthMatch ? monthMap[monthMatch[0]] : null
            };
        };

        let state = await getState();
        let guard = 0;

        while (state.year !== targetYear && guard++ < 30) {
            if (state.year > targetYear) await prevYearBtn.click();
            else await nextYearBtn.click();
            await this.page.waitForTimeout(100);
            state = await getState();
        }

        guard = 0;
        while (state.month !== targetMonth && guard++ < 24) {
            if (state.month > targetMonth) await prevMonthBtn.click();
            else await nextMonthBtn.click();
            await this.page.waitForTimeout(100);
            state = await getState();
        }

        // FIX 3: Use force click to bypass the blue range-highlight overlay
        await activePanel
            .locator('.ant-picker-cell-in-view')
            .filter({ hasText: new RegExp(`^${targetDay}$`) })
            .first()
            .click({ force: true });

        // Ensure the picker closes properly
        await this.page.keyboard.press('Escape');

    } catch (error) {
        console.error("Date Selection Error:", error.message);
        await this.page.keyboard.press('Escape');
        throw error;
    }
}
  // ==========================
  // CREATE PROJECT (Main Flow)
  // ==========================
  async createProject(projectData) {
    await this.openCreateProject();

    // Wait for internal form data to load
    await this.page.locator('text=Loading project data...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(1000);

    // 🔹 Standard Inputs
    await this.projectNameInput.fill(projectData.projectName);
    await this.projectNumberInput.fill(projectData.projectNumber);

    // 🔹 Isolated Dropdowns (Called by key, not UI text)
    await this.selectDropdown('location', projectData.location);
    await this.selectDropdown('customer', projectData.customer);

    // 🔹 Isolated Dates (Called by key, not index)
    await this.selectDate('start', projectData.startDate);
    await this.selectDate('end', projectData.endDate);

    // 🔹 Features and Checkboxes
    if (projectData.projectStatus) {
      await this.page.getByLabel(projectData.projectStatus).check();
    }

    if (projectData.projectType) {
      await this.page.getByLabel(projectData.projectType).check();
    }

    for (const feature of projectData.pipelineFeatures || []) {
      await this.page.getByLabel(feature).check();
    }

    for (const machine of projectData.machines || []) {
      await this.page.locator(`label:has-text("${machine}")`).click();
    }

    // 🔹 Submit and Cleanup
    await this.submitBtn.click();
    await this.waitForLoader();
    await this.closeToastIfVisible();

    console.log(`Project "${projectData.projectName}" created successfully.`);
  }

  // ==========================
  // OPEN PROJECT (Click Select)
  // ==========================
  async selectProject(projectName) {

    await this.waitForLoader();

    const row = this.page.locator('tr', { hasText: projectName });

    await row.waitFor({ state: 'visible', timeout: 20000 });

    await row.getByRole('button', { name: 'Select' }).click();

    console.log(`Project "${projectName}" opened successfully.`);
  }

// ==========================
// DELETE ALL PROJECTS BY NAME 
// ==========================

// async deleteProjectsByName(projectName) {

//   await this.waitForLoader();

//   console.log(`🗑 Searching projects to delete: ${projectName}`);

//   // 1️⃣ Locate headings with exact project name
//   const headings = this.page.getByRole('heading', {
//     name: projectName,
//     exact: true
//   });

//   const count = await headings.count();

//   if (count === 0) {
//     console.log(`⚠ No project found with name: ${projectName}`);
//     return;
//   }

//   console.log(`🗑 Found ${count} project(s) with name "${projectName}"`);

//   // 2️⃣ Loop through each matching project card
//   for (let i = 0; i < count; i++) {

//     const heading = headings.nth(i);

//     // 🔥 Find closest ancestor that contains BOTH:
//     // - this heading
//     // - a checkbox inside it
//     const card = heading.locator(
//       'xpath=ancestor::*[.//*[@role="checkbox"] or .//input[@type="checkbox"]][1]'
//     );

//     // 🔥 Scope checkbox ONLY inside this card
//     const checkbox = card.locator('[role="checkbox"], input[type="checkbox"]').first();

//     await checkbox.scrollIntoViewIfNeeded();

//     // Use evaluate to avoid bubbling to card click handler
//     await checkbox.evaluate(el => el.click());

//     console.log(`✔ Selected project ${i + 1}`);
//   }

//   // 3️⃣ Click Delete Selected button
//   const deleteBtn = this.page.getByRole('button', { name: /Delete Selected/i });
//   await deleteBtn.waitFor({ state: 'visible' });
//   await deleteBtn.click();

//   // 4️⃣ Wait for Delete modal
//   await this.page.getByText('Delete Projects').waitFor({ state: 'visible' });

// // 5️⃣ Toggle Hard Delete
// const modal = this.page.locator('.ant-modal-content');
// await modal.waitFor({ state: 'visible' });

// // Click the switch next to "Soft Delete"
// const toggleSwitch = modal.locator('.ant-switch');

// await toggleSwitch.waitFor({ state: 'visible' });
// await toggleSwitch.click();   // Just click the switch itself

// console.log('🔁 Toggle button clicked');

// // 6️⃣ Confirm Hard Delete
// const confirmBtn = modal.getByRole('button', { name: /Hard Delete/i });
// await confirmBtn.waitFor({ state: 'visible' });
// await confirmBtn.click();

// await this.waitForLoader();
// await this.closeToastIfVisible();

// console.log(`🗑 Hard Deletion complete for: ${projectName}`);
// }

  // ==========================
  // CREATE MULTIPLE PROJECTS (Dynamic from mode)
  // ==========================
  async createProjectsFromMode(config) {

    let projectNames = [];

    if (config.mode === "singleProject") {
      projectNames = [config.singleProject.projectName];
    }

    if (config.mode === "multiProject") {
      projectNames = config.multiProject.map(p => p.projectName);
    }

    if (config.mode === "multiBrowser") {
      projectNames = config.multiBrowser.map(p => p.projectName);
    }

    // Remove duplicates
    const uniqueProjects = [...new Set(projectNames)];

    for (const name of uniqueProjects) {

      const dynamicData = {
        ...config.createProjectData,
        projectName: name
      };

      await this.createProject(dynamicData);
    }
  }
}

module.exports = CreateProjectPage;