class CreateProjectPage {
    constructor(page) {
        this.page = page;

        // Headers
        this.formHeader = page.locator('//h1[contains(normalize-space(),"Create New Project")]');
        this.editFormHeader = page.locator('//h1[contains(normalize-space(),"Edit Project")]');

        // Basic info
        this.projectNameField = page.locator('input[name="projectName"]');
        this.projectNumberField = page.locator('input[name="projectNumber"]');

        // Location & Customer combobox buttons (label based – works for Create & Edit)
        this.locationComboButton = page.locator(
            '//label[contains(normalize-space(),"Location")]/following::button[@role="combobox"][1]'
        );
        this.customerComboButton = page.locator(
            '//label[contains(normalize-space(),"Customer")]/following::button[@role="combobox"][1]'
        );
        this.radixPopperContentWrapper = page.locator(
            '//div[@data-radix-popper-content-wrapper]'
        );

        // Date inputs
        this.startDateInput = page.locator('(//input[@placeholder="DD-MMM-YYYY"])[1]');
        this.endDateInput = page.locator('(//input[@placeholder="DD-MMM-YYYY"])[2]');

        this.datePickerDropdown = page.locator('div.ant-picker-dropdown');

        // Project Status
        this.initiatedCheckbox = page.locator('#status-Initiated');
        this.activeCheckbox = page.locator('#status-Active');
        this.onHoldCheckbox = page.locator('#status-On\\ Hold');
        this.completedCheckbox = page.locator('#status-Completed');

        // Type of Project
        this.pipelineCheckbox = page.locator('#pipeline');
        this.fabricationCheckbox = page.locator('#fabrication');
        this.othersCheckbox = page.locator('#others');

        // Pipeline Features
        this.pipelineMaterialTraceabilityCheckbox = page.locator('#pipeline-materialTraceability');
        this.pipelinePipeFitterCheckbox = page.locator('#pipeline-pipeFitter');
        this.pipelineWeldingCheckbox = page.locator('#pipeline-welding');
        this.pipelineNDTCheckbox = page.locator('#pipeline-ndt');
        this.pipelineCoatingCheckbox = page.locator('#pipeline-coating');

        // Pipeline welding machines
        this.pipelineCrceGroupButton = page.locator('#pipeline-crce');
        this.pipelineIwmMachineCheckbox = page.locator('#pipeline-machine-IWM');
        this.pipelineP600zMachineCheckbox = page.locator('#pipeline-machine-P600Z');
        this.pipelineNonCrceGroupButton = page.locator('#pipeline-noncrce');
        this.pipelineManualMachineCheckbox = page.locator('#pipeline-machine-manual');
        this.pipelineP625MachineCheckbox = page.locator('#pipeline-machine-P625');
        this.pipelineM500MachineCheckbox = page.locator('#pipeline-machine-M500');
        this.pipelineCompetitorMachineCheckbox = page.locator('#pipeline-machine-competitor');

        // Others Features
        this.othersMaterialTraceabilityCheckbox = page.locator('#others-materialTraceability');
        this.othersPipeFitterCheckbox = page.locator('#others-pipeFitter');
        this.othersWeldingCheckbox = page.locator('#others-welding');
        this.othersNDTCheckbox = page.locator('#others-ndt');
        this.othersCoatingCheckbox = page.locator('#others-coating');

        // Others welding machines / groups
        this.othersCrceGroupButton = page.locator('#others-crce');
        this.othersIwmMachineCheckbox = page.locator('#others-machine-IWM');
        this.othersP625MachineCheckbox = page.locator('#others-machine-P625');
        this.othersP600zMachineCheckbox = page.locator('#others-machine-P600Z');
        this.othersM500MachineCheckbox = page.locator('#others-machine-M500');
        this.othersNonCrceGroupButton = page.locator('#others-noncrce');
        this.othersManualMachineCheckbox = page.locator('#others-machine-manual');
        this.othersCompetitorMachineCheckbox = page.locator('#others-machine-competitor');

        // Fabrication base type
        this.fabricationTypeCheckbox = page.locator('#fabrication');

        // Buckle Arrestor option & features
        this.fabBuckleArrestorCheckbox = page.locator('#fab-buckleArrestor');
        this.fabBuckleArrestorMaterialTraceabilityCheckbox = page.locator('#fab-buckleArrestor-materialTraceability');
        this.fabBuckleArrestorPipeFitterCheckbox = page.locator('#fab-buckleArrestor-pipeFitter');
        this.fabBuckleArrestorWeldingCheckbox = page.locator('#fab-buckleArrestor-welding');
        this.fabBuckleArrestorNdtCheckbox = page.locator('#fab-buckleArrestor-ndt');
        this.fabBuckleArrestorCoatingCheckbox = page.locator('#fab-buckleArrestor-coating');

        this.fabBuckleArrestorCrceGroupCheckbox = page.locator('#fab-buckleArrestor-crce');
        this.fabBuckleArrestorIwmCheckbox = page.locator('#fab-buckleArrestor-machine-IWM');
        this.fabBuckleArrestorP625Checkbox = page.locator('#fab-buckleArrestor-machine-P625');
        this.fabBuckleArrestorP600ZCheckbox = page.locator('#fab-buckleArrestor-machine-P600Z');
        this.fabBuckleArrestorM500Checkbox = page.locator('#fab-buckleArrestor-machine-M500');
        this.fabBuckleArrestorNonCrceGroupCheckbox = page.locator('#fab-buckleArrestor-noncrce');
        this.fabBuckleArrestorManualCheckbox = page.locator('#fab-buckleArrestor-machine-manual');
        this.fabBuckleArrestorCompetitorCheckbox = page.locator('#fab-buckleArrestor-machine-competitor');

        // Pipe in Pipe option & features
        this.fabPipeInPipeCheckbox = page.locator('#fab-pipeInPipe');
        this.fabPipeInPipeMaterialTraceabilityCheckbox = page.locator('#fab-pipeInPipe-materialTraceability');
        this.fabPipeInPipePipeFitterCheckbox = page.locator('#fab-pipeInPipe-pipeFitter');
        this.fabPipeInPipeWeldingCheckbox = page.locator('#fab-pipeInPipe-welding');
        this.fabPipeInPipeNdtCheckbox = page.locator('#fab-pipeInPipe-ndt');
        this.fabPipeInPipeCoatingCheckbox = page.locator('#fab-pipeInPipe-coating');

        this.fabPipeInPipeCrceGroupCheckbox = page.locator('#fab-pipeInPipe-crce');
        this.fabPipeInPipeIwmCheckbox = page.locator('#fab-pipeInPipe-machine-IWM');
        this.fabPipeInPipeP625Checkbox = page.locator('#fab-pipeInPipe-machine-P625');
        this.fabPipeInPipeP600ZCheckbox = page.locator('#fab-pipeInPipe-machine-P600Z');
        this.fabPipeInPipeM500Checkbox = page.locator('#fab-pipeInPipe-machine-M500');
        this.fabPipeInPipeNonCrceGroupCheckbox = page.locator('#fab-pipeInPipe-noncrce');
        this.fabPipeInPipeManualCheckbox = page.locator('#fab-pipeInPipe-machine-manual');
        this.fabPipeInPipeCompetitorCheckbox = page.locator('#fab-pipeInPipe-machine-competitor');

        // Bulkhead option & features
        this.fabBulkheadCheckbox = page.locator('#fab-bulkhead');
        this.fabBulkheadMaterialTraceabilityCheckbox = page.locator('#fab-bulkhead-materialTraceability');
        this.fabBulkheadPipeFitterCheckbox = page.locator('#fab-bulkhead-pipeFitter');
        this.fabBulkheadWeldingCheckbox = page.locator('#fab-bulkhead-welding');
        this.fabBulkheadNdtCheckbox = page.locator('#fab-bulkhead-ndt');
        this.fabBulkheadCoatingCheckbox = page.locator('#fab-bulkhead-coating');

        this.fabBulkheadCrceGroupCheckbox = page.locator('#fab-bulkhead-crce');
        this.fabBulkheadIwmCheckbox = page.locator('#fab-bulkhead-machine-IWM');
        this.fabBulkheadP625Checkbox = page.locator('#fab-bulkhead-machine-P625');
        this.fabBulkheadP600ZCheckbox = page.locator('#fab-bulkhead-machine-P600Z');
        this.fabBulkheadM500Checkbox = page.locator('#fab-bulkhead-machine-M500');
        this.fabBulkheadNonCrceGroupCheckbox = page.locator('#fab-bulkhead-noncrce');
        this.fabBulkheadManualCheckbox = page.locator('#fab-bulkhead-machine-manual');
        this.fabBulkheadCompetitorCheckbox = page.locator('#fab-bulkhead-machine-competitor');

        // Submit/Update button
        this.submitProjectButton = page.locator('button[type="submit"]');

        // Mandatory warnings tooltip items
        this.mandatoryWarningsItems = page.locator(
            'ul.list-disc.list-inside.space-y-1.text-xs li'
        );

        // Warning dialog
        this.warningDialog = page.locator(
            '//div[@role="dialog" and contains(@class,"fixed") and contains(@class,"z-50")]'
        );
        this.warningDialogMessage = page.locator(
            '//div[@role="dialog"]//p[contains(@class,"text-gray-700")]'
        );
        this.dialogCancelButton = page.locator(
            '//div[@role="dialog"]//button[contains(@class,"border") and contains(@class,"bg-background") and contains(text(),"Cancel")]'
        );
        this.dialogContinueButton = page.locator(
            '//div[@role="dialog"]//button[contains(@class,"bg-yellow-600") and contains(@class,"text-white") and contains(.,"Continue")]'
        );

        // Back button (only used in Edit Project)
        this.backButtonPrimary = page.locator(
            '//button[.//svg[contains(@class,"lucide-arrow-left")]]'
        );
        this.backButtonAlt = page.locator(
            '//button[contains(@class,"inline-flex") and .//svg[contains(@class,"arrow-left")]]'
        );
    }

    // ---------- Basic form visibility ----------

    async isCreateProjectFormDisplayed() {
        try {
            await this.formHeader.first().waitFor({ state: 'visible', timeout: 15000 });
            return await this.formHeader.first().isVisible();
        } catch {
            return false;
        }
    }

    async isEditProjectFormDisplayed() {
        try {
            await this.editFormHeader.first().waitFor({ state: 'visible', timeout: 15000 });
            return await this.editFormHeader.first().isVisible();
        } catch {
            return false;
        }
    }

    // ---------- Combobox helpers ----------

    async setHiddenSelectValueForCombo(comboButton, optionValue) {
        const handle = await comboButton.elementHandle();
        if (!handle) {
            throw new Error('Combobox button not found for setting hidden select value');
        }

        await handle.evaluate((el, value) => {
            const sel = el.nextElementSibling;
            if (!sel || sel.tagName !== 'SELECT') {
                throw new Error('Hidden <select> not found next to combobox button');
            }
            const opt = Array.from(sel.options).find(o => o.value === value);
            if (!opt) {
                throw new Error('Option value not found in combobox select: ' + value);
            }
            sel.value = value;
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, optionValue);
    }

    async selectLocation(locationValue) {
        await this.locationComboButton.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(200);
        await this.locationComboButton.first().click({ trial: false });
        await this.setHiddenSelectValueForCombo(this.locationComboButton.first(), locationValue);
    }

    async selectCustomer(customerValue) {
        await this.customerComboButton.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(200);
        await this.customerComboButton.first().click({ trial: false });
        await this.setHiddenSelectValueForCombo(this.customerComboButton.first(), customerValue);
    }

    // ---------- Radix searchable dropdown helpers (Location/Customer) ----------

    async waitForRadixDropdownToAppear() {
        await this.radixPopperContentWrapper.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        await this.page.waitForTimeout(150);
    }

    async typeSequentiallyInRadixSearch(searchText) {
        await this.waitForRadixDropdownToAppear();
        const wrapper = this.radixPopperContentWrapper.first();
        const input = wrapper.locator('input').first();
        await input.first().waitFor({ state: 'visible', timeout: 5000 });
        await input.first().click();
        await input.first().fill('');
        for (const ch of String(searchText || '')) {
            await input.first().type(ch, { delay: 120 });
        }
        await this.page.waitForTimeout(200);
    }

    async selectOptionFromRadixDropdown(optionText) {
        await this.waitForRadixDropdownToAppear();
        const wrapper = this.radixPopperContentWrapper.first();
        const option = wrapper
            .locator(`xpath=.//*[normalize-space()="${optionText}"]`)
            .first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.scrollIntoViewIfNeeded();
        await option.click();
        await this.page.waitForTimeout(200);
    }

    async clickAddNewLocationInDropdown() {
        await this.waitForRadixDropdownToAppear();
        const wrapper = this.radixPopperContentWrapper.first();
        const btn = wrapper.locator('xpath=.//button[normalize-space()="Add New Location"]').first();
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        await btn.click();
    }

    async clickAddNewCustomerInDropdown() {
        await this.waitForRadixDropdownToAppear();
        const wrapper = this.radixPopperContentWrapper.first();
        const btn = wrapper.locator('xpath=.//button[normalize-space()="Add New Customer"]').first();
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        await btn.click();
    }

    async addNewLocation(locationName) {
        const dialog = this.page.locator(
            'xpath=//div[@role="dialog" and @data-state="open"][.//h2[normalize-space()="Add New Location"]]'
        );
        await dialog.first().waitFor({ state: 'visible', timeout: 10000 });
        const input = dialog.locator('xpath=.//input[@placeholder="Enter location name"]').first();
        await input.fill(locationName);
        const addBtn = dialog.locator('xpath=.//button[normalize-space()="Add Location"]').first();
        await addBtn.waitFor({ state: 'visible', timeout: 5000 });
        await addBtn.click();
        await dialog.first().waitFor({ state: 'hidden', timeout: 15000 });
    }

    async addNewCustomer(customerName) {
        const dialog = this.page.locator(
            'xpath=//div[@role="dialog" and @data-state="open"][.//h2[normalize-space()="Add New Customer"]]'
        );
        await dialog.first().waitFor({ state: 'visible', timeout: 10000 });
        const input = dialog.locator('xpath=.//input[@placeholder="Enter customer name"]').first();
        await input.fill(customerName);
        const addBtn = dialog.locator('xpath=.//button[normalize-space()="Add Customer"]').first();
        await addBtn.waitFor({ state: 'visible', timeout: 5000 });
        await addBtn.click();
        await dialog.first().waitFor({ state: 'hidden', timeout: 15000 });
    }

    async addNewLocationFromDropdown(locationName) {
        await this.locationComboButton.scrollIntoViewIfNeeded();
        await this.locationComboButton.first().click({ trial: false });
        await this.clickAddNewLocationInDropdown();
        await this.addNewLocation(locationName);
    }

    async addNewCustomerFromDropdown(customerName) {
        await this.customerComboButton.scrollIntoViewIfNeeded();
        await this.customerComboButton.first().click({ trial: false });
        await this.clickAddNewCustomerInDropdown();
        await this.addNewCustomer(customerName);
    }

    async searchAndSelectLocation(searchText, optionText) {
        await this.locationComboButton.scrollIntoViewIfNeeded();
        await this.locationComboButton.first().click({ trial: false });
        await this.typeSequentiallyInRadixSearch(searchText);
        await this.selectOptionFromRadixDropdown(optionText);
    }

    async searchAndSelectCustomer(searchText, optionText) {
        await this.customerComboButton.scrollIntoViewIfNeeded();
        await this.customerComboButton.first().click({ trial: false });
        await this.typeSequentiallyInRadixSearch(searchText);
        await this.selectOptionFromRadixDropdown(optionText);
    }

    async getSelectedLocationText() {
        const text = await this.locationComboButton.first().textContent();
        return text ? text.trim() : '';
    }

    async getSelectedCustomerText() {
        const text = await this.customerComboButton.first().textContent();
        return text ? text.trim() : '';
    }

    // ---------- Date helpers ----------

    // NOTE: The Ant Design date picker already handles month/year selection.
    // For tests we only need to click the correct day cell by its label.

    async enterProjectName(projectName) {
        await this.projectNameField.fill('');
        await this.projectNameField.fill(projectName);
    }

    async enterProjectNumber(projectNumber) {
        await this.projectNumberField.fill('');
        await this.projectNumberField.fill(projectNumber);
    }

    async enterStartDate(startDate) {
        await this.startDateInput.click();
        await this.startDateInput.fill(startDate);
    }

    async enterEndDate(endDate) {
        await this.endDateInput.click();
        await this.endDateInput.fill(endDate);
    }

    async selectStartDate(date) {
        // Click the correct day by Ant's title="YYYY-MM-DD" and ensure the popup closes.
        let iso;
        if (date instanceof Date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            iso = `${y}-${m}-${d}`;
        } else {
            iso = String(date);
        }

        await this.startDateInput.click();

        const openDropdown = this.page.locator(
            'div.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'
        );
        await openDropdown.first().waitFor({ state: 'visible', timeout: 10000 });

        const cellInner = this.page.locator(
            'xpath=//div[contains(@class,"ant-picker-dropdown") and ' +
                'not(contains(@class,"ant-picker-dropdown-hidden"))]' +
                `//td[@title="${iso}" and not(contains(@class,"ant-picker-cell-disabled"))]` +
                '//div[contains(@class,"ant-picker-cell-inner")]'
        );

        await cellInner.first().waitFor({ state: 'visible', timeout: 10000 });
        await cellInner.first().click();

        // Close the picker if it stays open (common on Edit Project).
        await openDropdown.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
            await this.page.keyboard.press('Escape').catch(() => {});
            await this.page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
            await openDropdown.first().waitFor({ state: 'hidden', timeout: 5000 });
        });
    }

    async selectEndDate(date) {
        // Build ISO date string for Ant title attribute, e.g. "2026-03-17"
        let iso;
        if (date instanceof Date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            iso = `${y}-${m}-${d}`;
        } else {
            iso = String(date);
        }

        // Open the End Date picker
        await this.endDateInput.click();

        // Click the matching day cell in the visible Ant dropdown by its title
        const openDropdown = this.page.locator(
            'div.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'
        );
        await openDropdown.first().waitFor({ state: 'visible', timeout: 10000 });

        const cellInner = this.page.locator(
            'xpath=//div[contains(@class,"ant-picker-dropdown") and ' +
                'not(contains(@class,"ant-picker-dropdown-hidden"))]' +
                `//td[@title="${iso}" and not(contains(@class,"ant-picker-cell-disabled"))]` +
                '//div[contains(@class,"ant-picker-cell-inner")]'
        );

        await cellInner.first().waitFor({ state: 'visible', timeout: 10000 });
        await cellInner.first().click();

        // Close the picker if it stays open (common on Edit Project).
        await openDropdown.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
            await this.page.keyboard.press('Escape').catch(() => {});
            await this.page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
            await openDropdown.first().waitFor({ state: 'hidden', timeout: 5000 });
        });
    }

    async getStartDateValue() {
        return (await this.startDateInput.inputValue()) || '';
    }

    async getEndDateValue() {
        return (await this.endDateInput.inputValue()) || '';
    }

    formatDateForUI(date) {
        if (date instanceof Date) {
            const day = String(date.getDate()).padStart(2, '0');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mon = monthNames[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${mon}-${year}`;
        }
        // Assume already in correct UI format or ISO; we let caller control string.
        return String(date);
    }

    // ---------- Project Status ----------

    async selectProjectStatus(status) {
        const s = String(status || '').toLowerCase();
        switch (s) {
            case 'initiated':
                await this.initiatedCheckbox.click();
                break;
            case 'active':
                await this.activeCheckbox.click();
                break;
            case 'on hold':
                await this.onHoldCheckbox.click();
                break;
            case 'completed':
                await this.completedCheckbox.click();
                break;
        }
    }

    // ---------- Type of Project ----------

    async selectProjectType(projectType) {
        const t = String(projectType || '').toLowerCase();
        switch (t) {
            case 'pipeline':
                await this.pipelineCheckbox.click();
                break;
            case 'fabrication':
                await this.fabricationCheckbox.click();
                break;
            case 'others':
                await this.othersCheckbox.click();
                break;
        }
    }

    async uncheckProjectType(projectType) {
        const t = String(projectType || '').toLowerCase();
        let checkbox;
        switch (t) {
            case 'pipeline':
                checkbox = this.pipelineCheckbox;
                break;
            case 'fabrication':
                checkbox = this.fabricationCheckbox;
                break;
            case 'others':
                checkbox = this.othersCheckbox;
                break;
            default:
                return;
        }

        await checkbox.scrollIntoViewIfNeeded();
        const dataState = await checkbox.getAttribute('data-state');
        const isSelected = dataState === 'checked' || (await checkbox.isChecked().catch(() => false));

        if (isSelected) {
            await this.page.waitForTimeout(200);
            try {
                await checkbox.click();
            } catch {
                const h = await checkbox.elementHandle();
                if (h) {
                    await this.page.evaluate(el => {
                        el.scrollIntoView({ block: 'center' });
                        el.click();
                    }, h);
                }
            }
            await this.page.waitForTimeout(1000);
        }
    }

    // ---------- Warning dialog ----------

    async isWarningDialogDisplayed() {
        try {
            const dialogs = this.warningDialog;
            if (!(await dialogs.first().count())) return false;
            const state = await this.page.evaluate(() => {
                const dialogs = document.querySelectorAll('div[role="dialog"][class*="fixed"][class*="z-50"]');
                if (!dialogs.length) return 'none';
                for (const dialog of dialogs) {
                    const dataState = dialog.getAttribute('data-state');
                    const style = window.getComputedStyle(dialog);
                    const isVisible =
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0';
                    if (dataState === 'open' && isVisible) return 'open';
                }
                return 'none';
            });
            return state === 'open';
        } catch {
            return false;
        }
    }

    async getWarningDialogMessage() {
        await this.warningDialogMessage.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.warningDialogMessage.first().textContent();
        return text ? text.trim() : '';
    }

    async clickDialogCancelButton() {
        await this.dialogCancelButton.first().click();
        await this.page.waitForTimeout(300);
    }

    async clickDialogContinueButton() {
        const { ProjectsPage } = require('./ProjectsPage');
        await this.dialogContinueButton.first().click();
        await this.page.waitForTimeout(1000);
        return new ProjectsPage(this.page);
    }

    async isWarningDialogNotDisplayed() {
        try {
            await this.page.waitForTimeout(200);
            const state = await this.page.evaluate(() => {
                const dialogs = document.querySelectorAll('div[role="dialog"][class*="fixed"][class*="z-50"]');
                if (!dialogs.length) return 'none';
                for (const dialog of dialogs) {
                    const dataState = dialog.getAttribute('data-state');
                    const style = window.getComputedStyle(dialog);
                    const isVisible =
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0';
                    if (dataState === 'closed' || !isVisible) return 'closed';
                    if (dataState === 'open' && isVisible) return 'open';
                }
                return 'unknown';
            });
            return state === 'none' || state === 'closed';
        } catch {
            return true;
        }
    }

    // ---------- Navigation helpers ----------

    async scrollToTop() {
        await this.page.evaluate(() => window.scrollTo(0, 0));
    }

    async clickBackButton() {
        await this.scrollToTop();

        const clicked = await this.page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const svg = btn.querySelector('svg.lucide-arrow-left, svg[class*="arrow-left"]');
                if (svg) {
                    btn.click();
                    return true;
                }
            }
            return false;
        });

        if (!clicked) {
            let backButton = this.backButtonPrimary.first();
            if (!(await backButton.count())) {
                backButton = this.backButtonAlt.first();
            }
            if (!(await backButton.count())) {
                throw new Error('Could not find back button with any method');
            }
            await backButton.click();
        }

        const { ProjectsPage } = require('./ProjectsPage');
        await this.page.waitForTimeout(500);
        return new ProjectsPage(this.page);
    }

    // ---------- Pipeline features ----------

    async selectPipelineFeature(feature) {
        const f = String(feature || '').toLowerCase();
        switch (f) {
            case 'material traceability':
                await this.pipelineMaterialTraceabilityCheckbox.click();
                break;
            case 'pipefitter':
                await this.pipelinePipeFitterCheckbox.click();
                break;
            case 'welding':
                await this.pipelineWeldingCheckbox.click();
                break;
            case 'ndt':
                await this.pipelineNDTCheckbox.click();
                break;
            case 'coating':
                await this.pipelineCoatingCheckbox.click();
                break;
        }
    }

    // ---------- Others features ----------

    async selectOthersFeature(feature) {
        const f = String(feature || '').toLowerCase();
        switch (f) {
            case 'material traceability':
                await this.othersMaterialTraceabilityCheckbox.click();
                break;
            case 'pipefitter':
                await this.othersPipeFitterCheckbox.click();
                break;
            case 'welding':
                await this.othersWeldingCheckbox.click();
                break;
            case 'ndt':
                await this.othersNDTCheckbox.click();
                break;
            case 'coating':
                await this.othersCoatingCheckbox.click();
                break;
        }
    }

    // ---------- Others welding machines ----------

    async selectOthersWeldingMachine(machine) {
        const m = String(machine || '').toLowerCase();
        switch (m) {
            case 'crce machines':
                await this.othersCrceGroupButton.click();
                break;
            case 'iwm':
                await this.othersIwmMachineCheckbox.click();
                break;
            case 'p-625':
                await this.othersP625MachineCheckbox.click();
                break;
            case 'p-600z':
                await this.othersP600zMachineCheckbox.click();
                break;
            case 'm-500':
                await this.othersM500MachineCheckbox.click();
                break;
            case 'non-crce machines':
                await this.othersNonCrceGroupButton.click();
                break;
            case 'manual':
                await this.othersManualMachineCheckbox.click();
                break;
            case 'competitor machine':
                await this.othersCompetitorMachineCheckbox.click();
                break;
        }
    }

    // ---------- Pipeline welding machines ----------

    async selectPipelineWeldingMachine(machine) {
        const m = String(machine || '').toLowerCase();
        switch (m) {
            case 'crce machines':
                await this.pipelineCrceGroupButton.click();
                break;
            case 'iwm':
                await this.pipelineIwmMachineCheckbox.click();
                break;
            case 'p-600z':
                await this.pipelineP600zMachineCheckbox.click();
                break;
            case 'non-crce machines':
                await this.pipelineNonCrceGroupButton.click();
                break;
            case 'manual':
                await this.pipelineManualMachineCheckbox.click();
                break;
            case 'p-625':
                await this.pipelineP625MachineCheckbox.click();
                break;
            case 'm-500':
                await this.pipelineM500MachineCheckbox.click();
                break;
            case 'competitor machine':
                await this.pipelineCompetitorMachineCheckbox.click();
                break;
        }
    }

    // ---------- Fabrication helpers ----------

    async selectFabricationOption(option) {
        const opt = String(option || '').toLowerCase().trim().replace(/\s+/g, ' ');
        switch (opt) {
            case 'buckle arrestor':
                await this.fabBuckleArrestorCheckbox.click();
                break;
            case 'pipe in pipe':
                await this.fabPipeInPipeCheckbox.click();
                break;
            case 'bulkhead':
            case 'bulk head':
                await this.fabBulkheadCheckbox.click();
                break;
        }
    }

    async selectFabricationFeature(option, feature) {
        const opt = String(option || '').toLowerCase().trim().replace(/\s+/g, ' ');
        const feat = String(feature || '').toLowerCase();

        switch (opt) {
            case 'buckle arrestor':
                switch (feat) {
                    case 'material traceability':
                        await this.fabBuckleArrestorMaterialTraceabilityCheckbox.click();
                        break;
                    case 'pipefitter':
                        await this.fabBuckleArrestorPipeFitterCheckbox.click();
                        break;
                    case 'welding':
                        await this.fabBuckleArrestorWeldingCheckbox.click();
                        break;
                    case 'ndt':
                        await this.fabBuckleArrestorNdtCheckbox.click();
                        break;
                    case 'coating':
                        await this.fabBuckleArrestorCoatingCheckbox.click();
                        break;
                }
                break;

            case 'pipe in pipe':
                switch (feat) {
                    case 'material traceability':
                        await this.fabPipeInPipeMaterialTraceabilityCheckbox.click();
                        break;
                    case 'pipefitter':
                        await this.fabPipeInPipePipeFitterCheckbox.click();
                        break;
                    case 'welding':
                        await this.fabPipeInPipeWeldingCheckbox.click();
                        break;
                    case 'ndt':
                        await this.fabPipeInPipeNdtCheckbox.click();
                        break;
                    case 'coating':
                        await this.fabPipeInPipeCoatingCheckbox.click();
                        break;
                }
                break;

            case 'bulkhead':
            case 'bulk head':
                switch (feat) {
                    case 'material traceability':
                        await this.fabBulkheadMaterialTraceabilityCheckbox.click();
                        break;
                    case 'pipefitter':
                        await this.fabBulkheadPipeFitterCheckbox.click();
                        break;
                    case 'welding':
                        await this.fabBulkheadWeldingCheckbox.click();
                        break;
                    case 'ndt':
                        await this.fabBulkheadNdtCheckbox.click();
                        break;
                    case 'coating':
                        await this.fabBulkheadCoatingCheckbox.click();
                        break;
                }
                break;
        }
    }

    async selectFabricationMachine(option, machine) {
        const opt = String(option || '').toLowerCase().trim().replace(/\s+/g, ' ');
        const m = String(machine || '').toLowerCase();

        switch (opt) {
            case 'buckle arrestor':
                switch (m) {
                    case 'crce machines':
                        await this.fabBuckleArrestorCrceGroupCheckbox.click();
                        break;
                    case 'iwm':
                        await this.fabBuckleArrestorIwmCheckbox.click();
                        break;
                    case 'p-625':
                        await this.fabBuckleArrestorP625Checkbox.click();
                        break;
                    case 'p-600z':
                        await this.fabBuckleArrestorP600ZCheckbox.click();
                        break;
                    case 'm-500':
                        await this.fabBuckleArrestorM500Checkbox.click();
                        break;
                    case 'non-crce machines':
                        await this.fabBuckleArrestorNonCrceGroupCheckbox.click();
                        break;
                    case 'manual':
                        await this.fabBuckleArrestorManualCheckbox.click();
                        break;
                    case 'competitor machine':
                        await this.fabBuckleArrestorCompetitorCheckbox.click();
                        break;
                }
                break;

            case 'pipe in pipe':
                switch (m) {
                    case 'crce machines':
                        await this.fabPipeInPipeCrceGroupCheckbox.click();
                        break;
                    case 'iwm':
                        await this.fabPipeInPipeIwmCheckbox.click();
                        break;
                    case 'p-625':
                        await this.fabPipeInPipeP625Checkbox.click();
                        break;
                    case 'p-600z':
                        await this.fabPipeInPipeP600ZCheckbox.click();
                        break;
                    case 'm-500':
                        await this.fabPipeInPipeM500Checkbox.click();
                        break;
                    case 'non-crce machines':
                        await this.fabPipeInPipeNonCrceGroupCheckbox.click();
                        break;
                    case 'manual':
                        await this.fabPipeInPipeManualCheckbox.click();
                        break;
                    case 'competitor machine':
                        await this.fabPipeInPipeCompetitorCheckbox.click();
                        break;
                }
                break;

            case 'bulkhead':
            case 'bulk head':
                switch (m) {
                    case 'crce machines':
                        await this.fabBulkheadCrceGroupCheckbox.click();
                        break;
                    case 'iwm':
                        await this.fabBulkheadIwmCheckbox.click();
                        break;
                    case 'p-625':
                        await this.fabBulkheadP625Checkbox.click();
                        break;
                    case 'p-600z':
                        await this.fabBulkheadP600ZCheckbox.click();
                        break;
                    case 'm-500':
                        await this.fabBulkheadM500Checkbox.click();
                        break;
                    case 'non-crce machines':
                        await this.fabBulkheadNonCrceGroupCheckbox.click();
                        break;
                    case 'manual':
                        await this.fabBulkheadManualCheckbox.click();
                        break;
                    case 'competitor machine':
                        await this.fabBulkheadCompetitorCheckbox.click();
                        break;
                }
                break;
        }
    }

    // ---------- Submit / Update ----------

    async isSubmitButtonEnabled() {
        const disabledAttr = await this.submitProjectButton.getAttribute('disabled');
        const enabledFlag = await this.submitProjectButton.isEnabled().catch(() => false);
        return enabledFlag && (!disabledAttr || disabledAttr === '');
    }

    async waitForSubmitButtonToBeEnabled() {
        try {
            if (await this.isSubmitButtonEnabled()) return;
        } catch {
            // ignore
        }

        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            try {
                if (await this.isSubmitButtonEnabled()) return;
            } catch {
                // ignore transient issues
            }
            await this.page.waitForTimeout(150);
        }
        throw new Error('Submit/Update Project button did not become enabled within timeout');
    }

    async getMandatoryFieldWarningMessages() {
        // The validation list is rendered under the disabled submit button.
        // We don't need to hover/click the button (overlays intercept pointer events).
        await this.mandatoryWarningsItems.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        const texts = await this.mandatoryWarningsItems.allTextContents();
        return texts.map(t => t.trim()).filter(Boolean);
    }

    async getMandatoryFieldWarningMessagesSafe() {
        try {
            const texts = await this.mandatoryWarningsItems.allTextContents();
            return texts.map(t => t.trim()).filter(Boolean);
        } catch {
            return [];
        }
    }

    async submitProject() {
        const { ProjectsPage } = require('./ProjectsPage');
        await this.submitProjectButton.scrollIntoViewIfNeeded();
        await this.submitProjectButton.click();

        // App sometimes shows "Submitting..." and stays on the form while the backend processes.
        // Waiting for the form header to disappear is unreliable (it may stay mounted).
        // Instead wait for a positive signal that we're back on the Projects page.
        const projectsHeader = this.page.locator('//h1[contains(text(),"Projects")]');
        await projectsHeader.first().waitFor({ state: 'visible', timeout: 90000 });
        return new ProjectsPage(this.page);
    }

    async updateProject() {
        const { OverviewPage } = require('./OverviewPage');
        await this.submitProjectButton.scrollIntoViewIfNeeded();
        await this.submitProjectButton.click();
        await this.page.waitForLoadState('networkidle');
        return new OverviewPage(this.page);
    }
}

module.exports = { CreateProjectPage };

