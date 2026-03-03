module.exports = {
    // Navigation & Search
    searchInput: (page) => page.locator('input[placeholder*="Search"]').first(),
    projectTile: (page, projectName) => page.getByText(new RegExp(`^${projectName}$`, 'i')).first(),
    setupTab: (page) => page.getByRole('tab', { name: 'Setup' }),

    // Pipe Configuration
    pipeCountInput: (page) => page.locator('input[placeholder="Enter number of pipe sizes"]'),
    pipeDetailsHeader: (page) => page.locator('text=Pipe Size Details'),
    
    // Dynamic Pipe Container
    pipeContainer: (page, label) => page.locator('div')
        .filter({ hasText: new RegExp(`^${label}$`) })
        .first()
        .locator('xpath=./ancestor::div[contains(@class, "ant-card") or contains(@class, "border")][1]'),

    // Pipe Row Inputs
    pipeSizeInput: (container) => container.getByPlaceholder('Enter pipe size'),
    wallThicknessInput: (container) => container.getByPlaceholder('Enter wall thickness'),
    pipeCountRowInput: (container) => container.getByPlaceholder('Enter number of pipes'),
    pipeLengthInput: (container) => container.getByPlaceholder('Enter pipe length'),
    
    manufacturerPlaceholder: (container) => container.getByText('Select manufacturer'),
    manufacturerSearch: (page) => page.locator('input[placeholder="Search..."]').last(),
    pipeHeader: (container, index) => container.locator('h5', { hasText: `Pipe ${index + 1}` }),
    wpsInput: (container, placeholder) => container.getByPlaceholder(placeholder),

    saveBtn: (page) => page.getByRole('button', { name: 'Save' }),
};