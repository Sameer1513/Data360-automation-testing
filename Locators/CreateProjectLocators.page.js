module.exports = {
    // Main Buttons
    createProjectBtn: (page) => page.getByRole('button', { name: 'Create Project' }),
    submitBtn: (page) => page.getByRole('button', { name: 'Submit Project' }),

    // Inputs
    projectNameInput: (page) => page.getByPlaceholder('Enter project name'),
    projectNumberInput: (page) => page.getByPlaceholder('Enter project number'),

    // Loaders & Toasts
    loader: (page) => page.locator('text=Loading projects data...'),
    projectDataLoader: (page) => page.locator('text=Loading project data...'),
    toastCloseBtn: (page) => page.locator('.Toastify__close-button'),

    // Dropdowns (Dynamic)
    dropdownByLabel: (page, labelText) => page.locator('div').filter({ hasText: labelText }).last(),
    dropdownOption: (page, value) => page.locator('div').filter({ hasText: new RegExp(`^${value}$`, 'i') }).last(),

    // Date Pickers
    dateContainer: (page, labelText) => page.locator('div').filter({ hasText: new RegExp(`^${labelText}`) }).last(),
    dateInput: (container) => container.locator('input'),
    visiblePanels: (page) => page.locator('.ant-picker-panel:visible'),
    pickerHeader: (panel) => panel.locator('.ant-picker-header-view'),
    prevYearBtn: (panel) => panel.locator('.ant-picker-header-super-prev-btn'),
    nextYearBtn: (panel) => panel.locator('.ant-picker-header-super-next-btn'),
    prevMonthBtn: (panel) => panel.locator('.ant-picker-header-prev-btn'),
    nextMonthBtn: (panel) => panel.locator('.ant-picker-header-next-btn'),
    dayCell: (panel, day) => panel.locator('.ant-picker-cell-in-view').filter({ hasText: new RegExp(`^${day}$`) }).first(),

    // Checkboxes & Radios
    checkboxByLabel: (page, label) => page.getByLabel(label),
    machineLabel: (page, machine) => page.locator(`label:has-text("${machine}")`),

    // Project Selection
    searchInput: (page) => page.locator('input[placeholder*="Search"]').first(),
    projectTile: (page, projectName) => page.getByText(new RegExp(`^${projectName}$`, 'i')).first(),

    // Device Assignment
    devicesTab: (page) => page.getByRole('tab', { name: 'Devices' }),
    laptopIdInput: (page) => page.getByPlaceholder(/Laptop ID/i),
    saveBtn: (page) => page.getByRole('button', { name: 'Save' }),
};