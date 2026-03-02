module.exports = {
    // Navigation / Sidebar
    sidebarTrigger: (page) => page.locator('button:has(svg.lucide-menu)')
        .or(page.locator('.ant-layout-sider-trigger'))
        .or(page.locator('header button').first()),

    devicesMenuBtn: (page) => page.locator('a[href*="/devices"]')
        .or(page.getByRole('link', { name: 'Devices' })),

    projectsMenuBtn: (page) => page.locator('a[href*="/projects"], [href*="/Projects"]').first()
        .or(page.getByRole('link', { name: /Projects/i })),

    // Page Actions
    refreshBtn: (page) => page.getByRole('button', { name: /Refresh/i })
        .or(page.locator('button:has-text("Refresh")')),

    deviceSearchInput: (page) => page.locator('input[placeholder="Search devices..."]')
        .or(page.locator('input.flex.h-10.w-full.pl-10')),

    // Project Dropdown (Radix UI)
    projectDropdown: (page) => page.locator('button[role="combobox"]:has-text("Assign to Project")')
        .or(page.getByRole('combobox').filter({ hasText: 'Assign to Project' }))
        .or(page.locator('button').filter({ hasText: 'Assign to Project...' })),

    dropdownList: (page) => page.locator('[role="listbox"], .ant-select-dropdown'),

    projectOption: (page, projectName) => page.getByRole('option', { name: projectName, exact: false })
        .or(page.locator(`[role="option"]:has-text("${projectName}")`))
        .or(page.locator(`.ant-select-item-option-content:has-text("${projectName}")`)),

    // Assignment Flow Buttons
    assignProjectBtn: (page) => page.getByRole('button', { name: 'Assign Project', exact: true })
        .or(page.locator('button:has-text("Assign Project")')),

    confirmAssignmentBtn: (page) => page.getByRole('button', { name: /Confirm Assignment/i })
        .or(page.locator('button:has-text("Confirm Assignment")')),

    // Success Verification
    successMessage: (page) => page.locator('.ant-message-success')
        .or(page.locator('text=/successfully/i'))
};