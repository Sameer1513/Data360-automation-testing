class DeviceAssigningPage {
  constructor(page) {
    this.page = page;

    // Sidebar & Navigation
    this.sidebarMenu = page.locator('.ant-layout-sider');
    this.devicesMenuBtn = page.getByRole('link', { name: 'Devices' });

    // Device Management UI
    this.deviceSearchInput = page.getByPlaceholder('Search devices...');
    this.assignProjectBtn = page.getByRole('button', { name: 'Assign Project' });
    
    // Project Selection Dropdown inside Device Card
    this.projectSearchInput = page.getByPlaceholder('Assign to Project...');
    
    // Loaders
    this.loader = page.locator('text=Loading devices...');
  }

  async navigateToDevices() {
    // Open sidebar if collapsed and click Devices
    await this.page.locator('.ant-layout-sider-trigger').click().catch(() => {}); 
    await this.devicesMenuBtn.click();
    await this.page.waitForURL(/.*\/devices/);
    await this.loader.waitFor({ state: 'hidden' });
  }

  /**
   * Main logic to assign the project to the captured device ID
   */
  async assignProjectToDevice(deviceId, projectName) {
    await this.navigateToDevices();

    console.log(`🔍 Searching for Device ID: ${deviceId}`);
    await this.deviceSearchInput.fill(deviceId);
    await this.page.waitForTimeout(1000); // Wait for list to filter

    // Locate the specific card for this Device ID
    const deviceCard = this.page.locator('.ant-card', { hasText: deviceId });
    await deviceCard.scrollIntoViewIfNeeded();
    await deviceCard.waitFor({ state: 'visible' });

    // 1️⃣ Select the Checkbox on the Device Card
    // Using your logic: find the checkbox inside this specific card to avoid bubbling
    const checkbox = deviceCard.locator('[role="checkbox"], input[type="checkbox"]').first();
    await checkbox.evaluate(el => el.scrollIntoView());
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.evaluate(el => el.click());
    console.log(`✔ Device ${deviceId} selected via checkbox.`);

    // 2️⃣ Select Project from the dropdown
    console.log(`📂 Selecting Project: ${projectName}`);
    const projectDropdown = deviceCard.getByPlaceholder('Assign to Project...');
    await projectDropdown.click();
    
    // Type and select the exact project from the list
    await projectDropdown.fill(projectName);
    const projectOption = this.page.locator('.ant-select-item-option-content')
                                   .filter({ hasText: new RegExp(`^${projectName}$`, 'i') })
                                   .first();
    await projectOption.waitFor({ state: 'visible' });
    await projectOption.click();

    // 3️⃣ Click the Global Assign Project Button
    await this.assignProjectBtn.waitFor({ state: 'visible' });
    await this.assignProjectBtn.click();

    // Verification
    await this.page.getByText(/successfully assigned|assigned successfully/i).waitFor({ state: 'visible' });
    console.log(`✅ Project "${projectName}" assigned to Device "${deviceId}".`);
  }
}

module.exports = DeviceAssigningPage;