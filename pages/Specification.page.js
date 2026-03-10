const path = require('path');
const fs = require('fs');
const locators = require('../Locators/SpecificationsLocators.page');
const { test, expect } = require('@playwright/test');

class SpecificationsPage {
    constructor(page) {
        this.page = page;
        // Updated to your specific absolute path for reliability
        this.inputDir = "C:\\projects\\playwright-e2e\\SpecificationInput";
    }

    /**
     * Helper Function: Returns the full absolute path for a file.
     */
    async getFilePath(fileName) {
        const fullPath = path.join(this.inputDir, fileName);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error(`❌ File Not Found: "${fileName}" at ${fullPath}`);
        }
        return fullPath;
    }

    async navigateToSpecifications(projectName) {
        await test.step(`Maps to Specifications: ${projectName}`, async () => {
            console.log(` Navigating to Specifications Tab for: ${projectName}`);
            // Assumes we are already inside the project view (from Setup step)

            // 3. Select Specifications Tab
            const specTab = this.page.getByRole('tab', { name: 'Specifications' });
            await specTab.waitFor({ state: 'visible' });
            await specTab.click();
            
            // Wait for UI to settle
            await this.page.waitForLoadState('networkidle');
            console.log(`📂 Navigation complete for ${projectName} -> Specifications Tab`);
        });
    }

    async uploadSpecifications(data, actionType = 'cancel') {
        await test.step("Upload Specification Flow", async () => {
            // 1. CLICK DOWNLOAD FIRST (Optional Template Check)
            const downloadBtn = locators.downloadTemplateBtn(this.page);
            await downloadBtn.waitFor({ state: 'visible' });
            await downloadBtn.click();
            console.log("📥 Template download triggered.");

            // 2. OPEN THE UPLOAD MODAL
            const uploadBtn = locators.uploadSpecsBtn(this.page);
            await uploadBtn.waitFor({ state: 'visible' });
            await uploadBtn.click();
            console.log("🔓 Upload Modal opened.");

            // 3. STEP 1: UPLOAD EXCEL TEMPLATE
            const templatePath = await this.getFilePath(data.excelTemplate);
            const excelInput = locators.excelUploadInput(this.page);
            
            await excelInput.waitFor({ state: 'attached' }); 
            await excelInput.setInputFiles(templatePath);
            
            // CRITICAL: Wait for UI to process Step 1 before Step 2 unlocks
            await expect(this.page.locator(`text=${data.excelTemplate}`)).toBeVisible();
            await expect(this.page.locator('text=Please upload an Excel template first')).toBeHidden({ timeout: 10000 });
            console.log("✅ Step 1: Excel Template attached.");

            // 4. STEP 2: HANDLE MULTIPLE DOCUMENTS
            const docPaths = [];
            for (const file of data.documents) {
                docPaths.push(await this.getFilePath(file));
            }
            
            const docInput = locators.docUploadInput(this.page);
            await docInput.waitFor({ state: 'attached' }); 
            await docInput.setInputFiles(docPaths);

            // Verify all documents are listed
            for (const file of data.documents) {
                await expect(this.page.locator(`text=${file}`)).toBeVisible();
            }
            console.log(`✅ Step 2: ${data.documents.length} documents attached.`);

            // 5. CONDITIONAL ACTION (Cancel vs Upload)
            if (actionType === 'cancel') {
                console.log("🔄 Action: Clicking Cancel");
                await locators.cancelUploadBtn(this.page).click();
                await expect(uploadBtn).toBeVisible(); 
            } 
            else {
                console.log("🚀 Action: Clicking Upload All");
                await locators.uploadAllBtn(this.page).click();
                
                // Assert success message
                await expect(locators.successToast(this.page)).toBeVisible({ timeout: 15000 });
            }
        });
    }
async addNewSpecificationManual(specData, actionType = 'cancel') {
        await test.step(`Add New Specification Manually - Action: ${actionType}`, async () => {
            await locators.addSpecBtn(this.page).click();
            
            // Wait for modal to appear
            await expect(this.page.getByRole('dialog')).toBeVisible();

            // Select Dropdowns
            await locators.projectTypeDropdown(this.page).click();
            await this.page.getByRole('option', { name: specData.projectType }).click();

            // await locators.pipeDropdown(this.page).click();
            // await this.page.getByRole('option', { name: specData.pipe }).click();
            // Click the dropdown to open it
            await locators.pipeDropdown(this.page).click();
            
            // Ignore the JSON text and just click the very first option that appears
            await this.page.getByRole('option').first().click();

            await locators.specTypeDropdown(this.page).click();
            await this.page.getByRole('option', { name: specData.specType }).click();

            // Handle Manual Entry File Upload
            const filePaths = [];
            for (const file of specData.files) {
                filePaths.push(await this.getFilePath(file));
            }
            await locators.addNewSpecFileInput(this.page).setInputFiles(filePaths);

            // CONDITIONAL ACTION (Cancel vs Add)
            if (actionType === 'cancel') {
                console.log("🔄 Action: Clicking Cancel in Add Modal");
                // Using a direct locator for the Cancel button in this modal
                await this.page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
                
                // Verify modal closed
                await expect(this.page.getByRole('dialog')).toBeHidden();
            } else {
                console.log("🚀 Action: Clicking Add Specification");
                await locators.submitNewSpecBtn(this.page).click();
                
                // Wait for modal to close indicating success
                await expect(locators.submitNewSpecBtn(this.page)).toBeHidden({ timeout: 10000 });
                console.log("✅ Manual Specification added.");
            }
        });
    }
   

}

module.exports = SpecificationsPage;