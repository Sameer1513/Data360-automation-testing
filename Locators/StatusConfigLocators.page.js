module.exports = {
    productionTab: (page) => page.getByRole('tab', { name: 'Production' }),
    statusConfigBtn: (page) => page.getByRole('button', { name: 'Status Configuration' }),
    
    inInput: (page) => page.locator('div').filter({ hasText: /^In:$/ }).locator('input'),
    outInput: (page) => page.locator('div').filter({ hasText: /^Out:$/ }).locator('input'),
    
    saveBtn: (page) => page.getByRole('button', { name: 'Save' }),
    successToast: (page) => page.locator('text=Status Configuration saved successfully!'),
    backBtn: (page) => page.locator('button:has(svg.lucide-arrow-left), button[aria-label="Back"]').first(),
    tableRows: (page) => page.locator('table tbody tr'),
};