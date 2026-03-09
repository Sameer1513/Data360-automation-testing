const locators = require('../Locators/CreateProjectLocators.page');

class CreateProjectPage {
  constructor(page) {
    this.page = page;
  }

  // ==========================
  // Utility Functions
  // ==========================
  async waitForLoader() {
    await locators.loader(this.page).waitFor({ state: 'hidden', timeout: 30000 });
  }

  async closeToastIfVisible() {
    try {
      const btn = locators.toastCloseBtn(this.page);
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
      }
    } catch (e) { /* ignore */ }
  }

  async openCreateProject() {
    // Set zoom to 67% to ensure dropdowns and dates stay on screen
    // await this.page.evaluate(() => { document.body.style.zoom = "67%"; });
    await this.waitForLoader();
    await this.closeToastIfVisible();

    await locators.createProjectBtn(this.page).click();
    await locators.projectNameInput(this.page).waitFor({ state: 'visible' });
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
    const dropdown = locators.dropdownByLabel(this.page, labelText);

    console.log(`Dropdown Task: Finding "${value}" for ${type}`);

    try {
      await this.waitForLoader();
      await dropdown.scrollIntoViewIfNeeded();
      
      // Step 1: Click to focus the search box inside the dropdown
      await dropdown.click();

      // Step 2: Use keyboard to type (this is the most compatible way for React-Select)
      await this.page.keyboard.type(value, { delay: 10 });
      
      // Step 3: Wait for filtered results
      await this.page.waitForTimeout(100);

      // Step 4: Select the result (Case-Insensitive match)
      const option = locators.dropdownOption(this.page, value);
      await option.waitFor({ state: 'visible', timeout: 100 });
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

        const container = locators.dateContainer(this.page, labelText);

        // FIX 1: Ensure container is in view before clicking
        await container.scrollIntoViewIfNeeded();
        await locators.dateInput(container).click();

        // FIX 2: Dynamically detect the panel count
        const panels = locators.visiblePanels(this.page);
        await panels.first().waitFor();
        const panelCount = await panels.count();

        // If End Date and 2 panels exist, take the last one; otherwise, take the first.
        const activePanel = (type === "end" && panelCount > 1) 
            ? panels.last() 
            : panels.first();

        const header = locators.pickerHeader(activePanel);
        const prevYearBtn = locators.prevYearBtn(activePanel);
        const nextYearBtn = locators.nextYearBtn(activePanel);
        const prevMonthBtn = locators.prevMonthBtn(activePanel);
        const nextMonthBtn = locators.nextMonthBtn(activePanel);

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
        await locators.dayCell(activePanel, targetDay)
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
    await locators.projectDataLoader(this.page).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(1000);

    // 🔹 Standard Inputs
    await locators.projectNameInput(this.page).waitFor({ state: 'visible' });
    await locators.projectNameInput(this.page).fill(projectData.projectName);
    await locators.projectNumberInput(this.page).waitFor({ state: 'visible' });
    await locators.projectNumberInput(this.page).fill(projectData.projectNumber || "");

    // 🔹 Isolated Dropdowns (Called by key, not UI text)
    await this.selectDropdown('location', projectData.location);
    await this.selectDropdown('customer', projectData.customer);

    // 🔹 Isolated Dates (Called by key, not index)
    await this.selectDate('start', projectData.startDate);
    await this.selectDate('end', projectData.endDate);

    // 🔹 Features and Checkboxes
    if (projectData.projectStatus) {
      await locators.checkboxByLabel(this.page, projectData.projectStatus).check();
    }

    if (projectData.projectType) {
      await locators.checkboxByLabel(this.page, projectData.projectType).check();
    }

    for (const feature of projectData.pipelineFeatures || []) {
      await locators.checkboxByLabel(this.page, feature).check();
    }

    for (const machine of projectData.machines || []) {
      await locators.machineLabel(this.page, machine).click();
    }

    // 🔹 Submit and Cleanup
    await locators.submitBtn(this.page).click();
    await this.waitForLoader();
    await this.closeToastIfVisible();

    console.log(`Project "${projectData.projectName}" created successfully.`);
  }

  // ==========================
  // OPEN PROJECT (Click Select)
  // ==========================
  async selectProject(projectName) {
    await this.waitForLoader();

    console.log(`🔍 Searching for project to select: ${projectName}`);
    const searchInput = locators.searchInput(this.page);
    await searchInput.fill(projectName);
    await this.page.keyboard.press('Enter');

    // This locator is more robust as it finds the project by text and clicks the container,
    // which aligns with modern UI patterns and the logic in other parts of the test suite.
    const projectTile = locators.projectTile(this.page, projectName);

    await projectTile.waitFor({ state: 'visible', timeout: 20000 });
    await projectTile.click();
    console.log(`Project "${projectName}" opened successfully.`);
  }

  // used to assign device

async assignDevice(projectName, laptopId) {
    await this.selectProject(projectName); // Must enter project first
    await locators.devicesTab(this.page).click();
    const input = locators.laptopIdInput(this.page);
    await input.clear(); // Clear existing
    await input.fill(laptopId);
    await locators.saveBtn(this.page).click();
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