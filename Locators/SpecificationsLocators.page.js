module.exports = {
    // Add this to your module.exports in SpecificationsLocators.js
specificationsTab: (page) => 
    page.locator('role=tab[name="Specifications"]')
    .or(page.locator('text=Specifications'))
    .or(page.locator('xpath=//button[contains(., "Specifications")]')),

projectLink: (page, projectName) => 
    page.locator(`text=${projectName}`).first(),

         downloadTemplateBtn: (page) => 
        page.locator('button:has-text("Download Template")')
        .or(page.locator('button:has(.lucide-download)')),

    // 1. "Upload Specifications" Button (Main Page)
    uploadSpecsBtn: (page) => 
        page.locator('button[aria-label="Upload Specifications"]')
        .or(page.locator('button:has(.lucide-upload)'))
        .or(page.locator('button:has-text("Upload Specifications")'))
        .or(page.locator('xpath=//button[.//text()[contains(., "Upload Specifications")]]')),
        // The Cancel button inside the upload modal
    
    cancelUploadBtn: (page) => 
        page.locator('button:has-text("Cancel")')
        .or(page.locator('xpath=//button[contains(., "Cancel")]')),

    // 2. "Add Specification" Button (Main Page)
    addSpecBtn: (page) => 
        page.locator('button[aria-label="Add Specification"]')
        .or(page.locator('button:has(.lucide-plus)'))
        .or(page.locator('button:has-text("Add Specification")'))
        .or(page.locator('xpath=//button[contains(., "Add Specification")]')),

    // 3. Step 1: Excel Template Input (Hidden)
    excelUploadInput: (page) => 
        page.locator('input[type="file"][aria-label="Upload Excel Template"]') // Using Type & Aria-Label
        .or(page.locator('input[accept=".xlsx,.xls"]'))
        .or(page.locator('input[title="Upload Excel Template"]')) // Using Title attribute
        .or(page.locator('xpath=//h3[contains(text(),"Step 1")]/following::input[@type="file"][1]')),

    // 4. Step 2: Documents Input (Hidden & Multiple)
    docUploadInput: (page) => 
        page.locator('input[type="file"][multiple]') // Using Type & Multiple attribute
        .or(page.locator('input[aria-label="Upload Documents"]'))
        .or(page.locator('input[accept*="pdf"]'))
        .or(page.locator('xpath=//h3[contains(text(),"Step 2")]/following::input[@type="file"][1]')),

    // 5. "Upload All" Submit Button
    uploadAllBtn: (page) => 
        page.locator('button:has-text("Upload All")')
        .or(page.locator('xpath=//button[contains(., "Upload All")]'))
        .or(page.locator('xpath=//button[normalize-space()="Upload All"]')),

    // 6. Manual Add Modal: Dropdowns (Using Roles and IDs where possible)
    projectTypeDropdown: (page) => 
        page.locator('button[role="combobox"]').nth(0)
        .or(page.locator('button[aria-controls^="radix-"]')) // IDs in Radix UI often start with radix-
        .or(page.locator('xpath=//label[contains(text(),"Type of Project")]/following-sibling::button')),

    pipeDropdown: (page) => 
        page.locator('button[role="combobox"]').nth(1)
        .or(page.locator('xpath=//label[contains(text(),"Pipe")]/following-sibling::button')),

    specTypeDropdown: (page) => 
        page.locator('button[role="combobox"]').nth(2)
        .or(page.locator('xpath=//label[contains(text(),"Specification Type")]/following-sibling::button')),

    // 7. Manual Add Modal: File Input
    addNewSpecFileInput: (page) => 
        page.locator('div[role="dialog"] input[type="file"]')
        .or(page.locator('input[aria-label="Upload Documents"]'))
        .or(page.locator('xpath=//p[contains(text(), "specification documents")]/following::input[@type="file"][1]')),

    // 8. Final Submit in "Add New Specification" Modal
    submitNewSpecBtn: (page) => 
        page.locator('button[type="submit"]') // Standard type for forms
        .or(page.locator('button:has-text("Add Specification")').last())
        .or(page.locator('xpath=//div[@role="dialog"]//button[contains(., "Add Specification")]')),

    // 9. Notifications (Toasts)
    successToast: (page) => 
        page.locator('div[role="status"]') // Standard role for toasts
        .or(page.locator('xpath=//div[contains(@class, "bg-green") or contains(@class, "success")]'))
        .or(page.locator('text=/successfully/i')),
        // The warning message that prevents doc upload
    uploadWarning: (page) => page.locator('text=Please upload an Excel template first'),
    
    // The list where filenames appear after selection
    fileListContainer: (page) => page.locator('.space-y-2') // Adjust based on your actual CSS class
};