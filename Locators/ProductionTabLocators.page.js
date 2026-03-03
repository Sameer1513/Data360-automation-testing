module.exports = {
    // Table Elements
    tableRows: (page) => page.locator('table tbody tr'),
    tableHeaders: (page) => page.locator('table thead th'),
    scroller: (page) => page.locator('div.relative.overflow-auto, [role="region"]').first(),
    
    // Search & Filter
    searchInput: (page) => page.locator('input[placeholder*="Search"], .search-bar input').first(),
    clearSearchBtn: (page) => page.locator('button:has(svg.lucide-x), .clear-search').first(),
    
    // Tabs
    tabByName: (page, name) => page.getByRole('tab', { name: name }),
    tabContent: (page) => page.locator('table tbody tr'),
    
    // Navigation
    backBtn: (page) => page.locator('button:has(svg.lucide-arrow-left), button[aria-label="Back"]').first(),
    
    // Icons/Buttons inside rows
    eyeBtn: (row, colIndex) => row.locator(`td:nth-child(${colIndex}) button, td:nth-child(${colIndex}) svg.lucide-eye`).first(),
    eyeBtnGeneric: (row) => row.locator('button:has(svg.lucide-eye), svg.lucide-eye').first(),
    
    // Cell Icons (Selectors)
    thumbsUp: 'svg.lucide-thumbs-up',
    thumbsDown: 'svg.lucide-thumbs-down',
    alertCircle: 'svg.lucide-alert-circle',
    minus: 'svg.lucide-minus',
    xIcon: 'svg.lucide-x',
};