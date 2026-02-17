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
  // Utility: Close toast safely
  // ==========================
  async closeToastIfVisible() {
    try {
      if (await this.toastCloseBtn.isVisible({ timeout: 2000 })) {
        await this.toastCloseBtn.click();
      }
    } catch (e) {
      // Ignore if toast not present
    }
  }

  // ==========================
  // Utility: Wait for loader
  // ==========================
  async waitForLoader() {
    await this.loader.waitFor({ state: 'hidden', timeout: 30000 });
  }

  // ==========================
  // Open Create Project Modal
  // ==========================
  async openCreateProject() {
    await this.waitForLoader();
    await this.closeToastIfVisible();

    await this.createProjectBtn.click();
    await this.projectNameInput.waitFor({ state: 'visible' });
  }

  // ==========================
  // Select React Dropdown
  // ==========================
async selectDropdown(label, value) {
    // Target the specific container by the visible label text
    const dropdown = this.page.locator('div').filter({ hasText: new RegExp(`^${label}$`) }).last();

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Ensure no global loaders are blocking interaction
        await this.waitForLoader();

        // 1. Wait for the "Loading..." text inside the specific dropdown to disappear (00:10 in video)
        const fieldLoader = dropdown.locator('text=Loading...');
        await fieldLoader.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

        // 2. Click to open
        await dropdown.click({ force: true });

        // 3. Type the value into the search input that appears
        const searchInput = this.page.locator('input[role="combobox"]');
        await searchInput.waitFor({ state: 'visible', timeout: 3000 });
        await searchInput.fill(value);
        await this.page.waitForTimeout(500); // Wait for results to filter

        // 4. Click the matching option from the list
        const option = this.page.locator('div[id*="-option"]').filter({ hasText: value }).first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();

        return; // ✅ Success
      } catch (error) {
        console.log(`Dropdown attempt ${attempt} failed for: ${value}`);
        await this.page.keyboard.press('Escape');
        if (attempt === 3) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }
  // ==========================
  // Select Date
  // ==========================
  async selectDate(index, day) {
    await this.page.getByPlaceholder('DD-MMM-YYYY').nth(index).click();
    await this.page.getByRole('gridcell', { name: day, exact: true }).first().click();
  }

  // ==========================
  // CREATE PROJECT (Main)
  // ==========================
  async createProject(projectData) {

   await this.openCreateProject();

    // 🔹 FIX: Wait for the form-specific loading to disappear (00:10 in video)
    // This prevents entering data too early
    await this.page.locator('text=Loading project data...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(1000); // Short buffer for inputs to become stable

    // 🔹 Project Name
    await this.projectNameInput.waitFor({ state: 'visible' });
    await this.projectNameInput.fill(projectData.projectName);

    // 🔹 Project Number
    await this.projectNumberInput.fill(projectData.projectNumber);

    // 🔹 Dropdowns - Using the Labels from the UI
    await this.selectDropdown("Select or enter location", projectData.location);
    await this.selectDropdown("Select or enter customer name", projectData.customer);
    // 🔹 Dates
    await this.selectDate(0, projectData.startDate);
    await this.selectDate(1, projectData.endDate);

    // 🔹 Project Status
    if (projectData.projectStatus) {
      await this.page.getByLabel(projectData.projectStatus).check();
    }

    // 🔹 Project Type
    if (projectData.projectType) {
      await this.page.getByLabel(projectData.projectType).check();
    }

    // 🔹 Pipeline Features
    for (const feature of projectData.pipelineFeatures || []) {
      await this.page.getByLabel(feature).check();
    }

    // 🔹 Sub Features (CRCE Machines etc.)
    for (const sub of projectData.subFeatures || []) {
      await this.page.getByLabel(sub).check();
    }

    // 🔹 Machines
    for (const machine of projectData.machines || []) {
      await this.page.locator(`label:has-text("${machine}")`).click();
    }

    // 🔹 Submit
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