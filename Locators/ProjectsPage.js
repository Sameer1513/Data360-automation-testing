class ProjectsPage {
    constructor(page) {
        this.page = page;

        // Header
        this.projectsHeader = page.locator('//h1[contains(text(),"Projects")]');

        // Create Project button
        this.createProjectButton = page.locator(
            '//button[contains(@class,"bg-gradient-to-r") and contains(text(),"Create Project")]'
        );

        // Ant notification toast overlay
        this.notificationToast = page.locator('div.ant-notification-notice');

        // Load more projects button
        this.loadMoreProjectsButton = page.locator(
            '//button[contains(normalize-space(),"Load More Projects")]'
        );

        // First project tile locators
        this.firstProjectName = page.locator(
            '(//h3[@class="text-lg font-semibold text-[#4a6da7] mb-1"])[1]'
        );
        this.firstProjectNumber = page.locator(
            '(//p[@class="text-gray-500 text-sm"])[1]'
        );
        this.firstProjectStatus = page.locator(
            '(//div[@class="flex justify-between items-start"]/span)[1]'
        );
        this.firstProjectLocation = page.locator('(//span[@class="text-sm"])[1]');
        this.firstProjectCustomer = page.locator('(//span[@class="text-sm"])[2]');
        this.firstProjectDateRange = page.locator('(//span[@class="text-sm"])[3]');
        this.firstProjectType = page.locator(
            '(' +
                '//span[contains(@class,"inline-flex") and contains(@class,"text-xs") and contains(@class,"font-medium") ' +
                'and (contains(@class,"bg-blue-100") or contains(@class,"bg-purple-100") or contains(@class,"bg-lime-100"))' +
            '])[1]'
        );
        this.firstProjectTypesContainer = page.locator(
            '(//div[@class="mt-3 flex flex-wrap gap-1"])[1]'
        );

        // Delete-project related
        this.clearSelectionButton = page.locator(
            '//button[normalize-space()="Clear Selection"]'
        );
        this.deleteSelectedButton = page.locator(
            '//button[contains(normalize-space(),"Delete Selected")]'
        );

        this.deleteDialog = page.locator(
            '//div[@role="dialog" and contains(@class,"fixed")]'
        );
        this.hardDeleteToggle = page.locator('//button[@role="switch"]');
        this.hardDeleteWarningMessage = page.locator(
            '//p[@class="text-xs text-red-700 mt-1"]'
        );
        this.deleteDialogProjectName = page.locator(
            '//p[@class="text-sm font-medium text-gray-900 truncate"]'
        );
        this.deleteDialogProjectNumber = page.locator(
            '//span[@class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded"]'
        );
        this.hardDeleteButton = page.locator(
            '//button[contains(normalize-space(),"Hard Delete") and contains(@class,"bg-gradient-to-r")]'
        );

        // Filter dropdowns
        this.filterByStatusDropdown = page.locator(
            '//span[contains(@class,"px-2") and contains(@class,"py-1") and contains(@class,"text-gray-500") and contains(@class,"truncate") and normalize-space(text())="Filter by Status"]'
        );
        this.filterByTypeDropdown = page.locator(
            '//span[contains(@class,"px-2") and contains(@class,"py-1") and contains(@class,"text-gray-500") and normalize-space(text())="Filter by Type"]'
        );
        this.filterByCustomerDropdown = page.locator(
            '//span[contains(@class,"px-2") and contains(@class,"py-1") and contains(@class,"text-gray-500") and normalize-space(text())="Filter by Customer"]'
        );
        this.radixPopperContentWrapper = page.locator(
            '//div[@data-radix-popper-content-wrapper]'
        );
    }

    // --------------------- Basic page checks ---------------------

    async isProjectsPageDisplayed() {
        try {
            await this.projectsHeader.first().waitFor({ state: 'visible', timeout: 15000 });
            return await this.projectsHeader.first().isVisible();
        } catch {
            return false;
        }
    }

    async getProjectsHeaderText() {
        try {
            const text = await this.projectsHeader.first().textContent();
            return text ? text.trim() : '';
        } catch {
            return '';
        }
    }

    // --------------------- Navigation helpers ---------------------

    async scrollToTop() {
        // Keep this cheap; Playwright auto-scrolls when clicking anyway.
        await this.page.evaluate(() => {
            try {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                if (document.body) document.body.scrollTop = 0;
            } catch {}
        });
    }

    // --------------------- Create Project ---------------------

    async clickCreateProject() {
        // Wait briefly for any toast overlay to disappear
        const deadline = Date.now() + 1500;
        while (Date.now() < deadline) {
            if ((await this.notificationToast.count()) === 0) break;
            await this.page.waitForTimeout(100);
        }

        await this.createProjectButton.scrollIntoViewIfNeeded();
        await this.createProjectButton.click();

        const { CreateProjectPage } = require('./CreateProjectPage');
        return new CreateProjectPage(this.page);
    }

    // --------------------- First project tile helpers ---------------------

    async getFirstProjectName() {
        await this.scrollToTop();
        await this.firstProjectName.first().waitFor({ state: 'visible', timeout: 30000 });
        const title = await this.firstProjectName.first().getAttribute('title');
        if (title && title.trim()) return title.trim();
        const text = await this.firstProjectName.first().textContent();
        return text ? text.trim() : '';
    }

    async getFirstProjectNumber() {
        await this.scrollToTop();
        await this.firstProjectNumber.first().waitFor({ state: 'visible', timeout: 10000 });
        const text = await this.firstProjectNumber.first().textContent();
        return text ? text.trim() : '';
    }

    async getFirstProjectStatus() {
        await this.scrollToTop();
        const text = await this.firstProjectStatus.first().textContent();
        return text ? text.trim() : '';
    }

    async getFirstProjectLocation() {
        await this.scrollToTop();
        const text = await this.firstProjectLocation.first().textContent();
        return text ? text.trim() : '';
    }

    async getFirstProjectCustomer() {
        await this.scrollToTop();
        const text = await this.firstProjectCustomer.first().textContent();
        return text ? text.trim() : '';
    }

    async getFirstProjectDateRange() {
        await this.scrollToTop();
        const text = await this.firstProjectDateRange.first().textContent();
        return text ? text.trim() : '';
    }

    async getFirstProjectType() {
        await this.scrollToTop();
        const text = await this.firstProjectType.first().textContent();
        return text ? text.trim() : '';
    }

    async waitForFirstProjectLocationToBe(expectedLocation) {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            try {
                const current = await this.getFirstProjectLocation();
                if (
                    current &&
                    expectedLocation &&
                    expectedLocation.toLowerCase().trim() === current.toLowerCase().trim()
                ) {
                    return;
                }
            } catch {
                // ignore transient
            }
            await this.page.waitForTimeout(200);
        }
    }

    async waitForFirstProjectStatusToBe(expectedStatus) {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            try {
                const current = await this.getFirstProjectStatus();
                if (
                    current &&
                    expectedStatus &&
                    expectedStatus.toLowerCase().trim() === current.toLowerCase().trim()
                ) {
                    return;
                }
            } catch {
                // ignore transient
            }
            await this.page.waitForTimeout(250);
        }
    }

    async getFirstProjectTypes() {
        await this.scrollToTop();
        await this.firstProjectTypesContainer.first().waitFor({
            state: 'visible',
            timeout: 10000,
        });
        const badges = this.firstProjectTypesContainer.first().locator('span');
        const texts = await badges.allTextContents();
        return texts.map(t => t.trim()).filter(Boolean);
    }

    async clickFirstProjectName() {
        await this.scrollToTop();
        await this.firstProjectName.first().waitFor({ state: 'visible', timeout: 10000 });
        await this.firstProjectName.first().scrollIntoViewIfNeeded();
        await this.firstProjectName.first().click();

        const { OverviewPage } = require('./OverviewPage');
        return new OverviewPage(this.page);
    }

    async clickProjectByName(projectName) {
        const locator = this.page.locator(
            '//h3[contains(@class,"text-lg") and contains(@class,"font-semibold") and ' +
                '(@title=$name or normalize-space(text())=$name or contains(normalize-space(text()),$name))'
        , { hasText: projectName });

        const deadline = Date.now() + 30000;
        let clicks = 0;

        while (Date.now() < deadline) {
            if (await locator.first().isVisible().catch(() => false)) {
                await locator.first().scrollIntoViewIfNeeded();
                await locator.first().click();
                const { OverviewPage } = require('./OverviewPage');
                return new OverviewPage(this.page);
            }

            if (!(await this.loadMoreProjectsButton.first().isVisible().catch(() => false))) {
                break;
            }

            await this.loadMoreProjectsButton.first().scrollIntoViewIfNeeded();
            await this.loadMoreProjectsButton.first().click();
            clicks += 1;
            await this.page.waitForTimeout(650);
        }

        throw new Error(
            `Project with name not found within timeout: ${projectName} (Load More clicks=${clicks})`
        );
    }

    async clickProjectByNumber(projectNumberWithHash) {
        const numberLocator = this.page.locator(
            '//p[contains(@class,"text-gray-500") and normalize-space(text())=$num]',
            { num: projectNumberWithHash }
        );

        const deadline = Date.now() + 30000;
        let clicks = 0;

        while (Date.now() < deadline) {
            if (await numberLocator.first().isVisible().catch(() => false)) {
                const cardName = numberLocator.first().locator(
                    './ancestor::div[contains(@class,"p-5") or contains(@class,"rounded")][1]//h3'
                );
                await cardName.first().scrollIntoViewIfNeeded();
                await cardName.first().click();
                const { OverviewPage } = require('./OverviewPage');
                return new OverviewPage(this.page);
            }

            if (!(await this.loadMoreProjectsButton.first().isVisible().catch(() => false))) {
                break;
            }

            await this.loadMoreProjectsButton.first().scrollIntoViewIfNeeded();
            await this.loadMoreProjectsButton.first().click();
            clicks += 1;
            await this.page.waitForTimeout(650);
        }

        throw new Error(
            `Project with number not found within timeout: ${projectNumberWithHash} (Load More clicks=${clicks})`
        );
    }

    // --------------------- Delete project helpers ---------------------

    async getFirstProjectCheckbox() {
        await this.scrollToTop();
        await this.firstProjectName.first().waitFor({ state: 'visible', timeout: 30000 });

        // IMPORTANT: There is also a "Select All Projects" checkbox on this page.
        // Scope the checkbox to the first project tile container to avoid selecting all.
        return this.firstProjectName
            .first()
            .locator(
                'xpath=./ancestor::div[contains(@class,"rounded-lg")][1]//button[@role="checkbox"]'
            );
    }

    async clickFirstProjectCheckbox() {
        const checkbox = await this.getFirstProjectCheckbox();
        await checkbox.first().waitFor({ state: 'visible', timeout: 15000 });

        await checkbox.first().click();
    }

    async getFirstProjectCheckboxDataState() {
        const checkbox = await this.getFirstProjectCheckbox();
        return (await checkbox.first().getAttribute('data-state')) || '';
    }

    async isClearSelectionButtonDisplayed() {
        try {
            await this.clearSelectionButton.first().waitFor({
                state: 'visible',
                timeout: 3000,
            });
            return await this.clearSelectionButton.first().isVisible();
        } catch {
            return false;
        }
    }

    async isDeleteSelectedButtonDisplayed() {
        try {
            await this.deleteSelectedButton.first().waitFor({
                state: 'visible',
                timeout: 3000,
            });
            return await this.deleteSelectedButton.first().isVisible();
        } catch {
            return false;
        }
    }

    async clickClearSelectionButton() {
        await this.clearSelectionButton.first().scrollIntoViewIfNeeded();
        await this.clearSelectionButton.first().click();
    }

    async clickDeleteSelectedButton() {
        await this.deleteSelectedButton.first().scrollIntoViewIfNeeded();
        await this.deleteSelectedButton.first().click();
    }

    async isDeleteDialogDisplayed() {
        try {
            await this.deleteDialog.first().waitFor({ state: 'visible', timeout: 5000 });
            return await this.deleteDialog.first().isVisible();
        } catch {
            return false;
        }
    }

    async toggleHardDeleteSwitch() {
        await this.hardDeleteToggle.first().scrollIntoViewIfNeeded();
        await this.hardDeleteToggle.first().click();
        await this.page.waitForTimeout(300);
    }

    async getHardDeleteWarningMessage() {
        try {
            await this.hardDeleteWarningMessage.first().waitFor({
                state: 'visible',
                timeout: 5000,
            });
            const text = await this.hardDeleteWarningMessage.first().textContent();
            return text ? text.trim() : '';
        } catch {
            return '';
        }
    }

    async getDeleteDialogProjectName() {
        await this.deleteDialogProjectName.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        const text = await this.deleteDialogProjectName.first().textContent();
        return text ? text.trim() : '';
    }

    async getDeleteDialogProjectNumber() {
        await this.deleteDialogProjectNumber.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        const text = await this.deleteDialogProjectNumber.first().textContent();
        return text ? text.trim() : '';
    }

    async clickHardDeleteButton() {
        await this.hardDeleteButton.first().scrollIntoViewIfNeeded();
        await this.hardDeleteButton.first().click();
        await this.page.waitForTimeout(2000);
    }

    // --------------------- Filter dropdown helpers ---------------------

    async waitForRadixDropdownToAppear() {
        await this.radixPopperContentWrapper.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        await this.page.waitForTimeout(200);
    }

    async clickFilterByStatusDropdown() {
        await this.filterByStatusDropdown.first().scrollIntoViewIfNeeded();
        await this.filterByStatusDropdown.first().click();
        await this.waitForRadixDropdownToAppear();
    }

    async selectStatusFromFilter(statusName) {
        await this.waitForRadixDropdownToAppear();
        const wrapper = this.radixPopperContentWrapper.first();
        const target = wrapper.locator(`.//div[normalize-space()="${statusName}"]`);
        const fallback = wrapper.locator(
            `.//*[normalize-space()="${statusName}" or normalize-space(text())="${statusName}"]`
        );

        let el = target;
        if (!(await el.first().count())) {
            el = fallback;
        }

        if (!(await el.first().count())) {
            throw new Error(`Could not find element for status: ${statusName} in the filter dropdown`);
        }

        await el.first().scrollIntoViewIfNeeded();
        const role = await el.first().getAttribute('role');
        let isSelected = false;
        if (role === 'checkbox') {
            const state = await el.first().getAttribute('data-state');
            isSelected = state === 'checked';
        }

        if (!isSelected) {
            await el.first().click();
        }

        await this.page.waitForTimeout(500);
    }

    async selectMultipleStatusesFromFilter(statusNames) {
        await this.clickFilterByStatusDropdown();
        for (const statusName of statusNames) {
            if (!(await this.radixPopperContentWrapper.first().isVisible().catch(() => false))) {
                await this.clickFilterByStatusDropdown();
            }
            await this.selectStatusFromFilter(statusName);
            await this.page.waitForTimeout(300);
        }
        await this.page.waitForTimeout(500);
    }

    async getAllProjectStatuses() {
        await this.scrollToTop();
        const statusEls = this.page.locator(
            '//div[@class="flex justify-between items-start"]/span'
        );
        const texts = await statusEls.allTextContents();
        return texts.map(t => t.trim()).filter(Boolean);
    }

    async hasProjectsDisplayed() {
        await this.scrollToTop();
        const projectNames = this.page.locator(
            '//h3[@class="text-lg font-semibold text-[#4a6da7] mb-1"]'
        );
        return (await projectNames.count()) > 0;
    }

    async waitForProjectsToLoad(timeoutSeconds) {
        const deadline = Date.now() + timeoutSeconds * 1000;
        while (Date.now() < deadline) {
            if (await this.hasProjectsDisplayed()) return true;
            await this.page.waitForTimeout(500);
        }
        return false;
    }

    async getAllProjectNames() {
        await this.scrollToTop();
        const allProjectNames = this.page.locator(
            '//h3[@class="text-lg font-semibold text-[#4a6da7] mb-1"]'
        );
        await allProjectNames.first().waitFor({ state: 'visible', timeout: 10000 });
        const titles = await allProjectNames.evaluateAll(nodes =>
            nodes.map(el => {
                const t = el.getAttribute('title');
                return t && t.trim() ? t.trim() : (el.textContent || '').trim();
            })
        );
        return titles;
    }

    async isNoProjectsMessageDisplayed() {
        const msg = this.page.locator(
            '//h3[@class="text-xl font-semibold text-gray-900 mb-3 leading-tight" and normalize-space()="No Projects Match Your Filters"]'
        );
        try {
            await msg.first().waitFor({ state: 'visible', timeout: 5000 });
            return await msg.first().isVisible();
        } catch {
            return false;
        }
    }

    // Filter by Type

    async clickFilterByTypeDropdown() {
        await this.filterByTypeDropdown.first().scrollIntoViewIfNeeded();
        await this.filterByTypeDropdown.first().click();
        await this.waitForRadixDropdownToAppear();
    }

    async selectTypeFromFilter(typeName) {
        await this.waitForRadixDropdownToAppear();
        const wrapper = this.radixPopperContentWrapper.first();
        const target = wrapper.locator(`.//div[normalize-space()="${typeName}"]`);
        const fallback = wrapper.locator(
            `.//*[normalize-space()="${typeName}" or normalize-space(text())="${typeName}"]`
        );

        let el = target;
        if (!(await el.first().count())) {
            el = fallback;
        }

        if (!(await el.first().count())) {
            throw new Error(`Could not find element for type: ${typeName} in the filter dropdown`);
        }

        await el.first().scrollIntoViewIfNeeded();
        const role = await el.first().getAttribute('role');
        let isSelected = false;
        if (role === 'checkbox') {
            const state = await el.first().getAttribute('data-state');
            isSelected = state === 'checked';
        }

        if (!isSelected) {
            await el.first().click();
        }

        await this.page.waitForTimeout(500);
    }

    async selectMultipleTypesFromFilter(typeNames) {
        await this.clickFilterByTypeDropdown();
        for (const typeName of typeNames) {
            if (!(await this.radixPopperContentWrapper.first().isVisible().catch(() => false))) {
                await this.clickFilterByTypeDropdown();
            }
            await this.selectTypeFromFilter(typeName);
            await this.page.waitForTimeout(300);
        }
        await this.page.waitForTimeout(500);
    }

    async getAllProjectTypes() {
        await this.scrollToTop();
        const containers = this.page.locator('//div[@class="mt-3 flex flex-wrap gap-1"]');
        await this.page.waitForTimeout(1000);
        const allTypes = await containers.evaluateAll(nodes =>
            nodes
                .map(c =>
                    Array.from(c.querySelectorAll('span'))
                        .map(el => (el.textContent || '').trim())
                        .filter(Boolean)
                )
                .filter(arr => arr.length > 0)
        );
        return allTypes;
    }

    // Filter by Customer

    async clickFilterByCustomerDropdown() {
        await this.filterByCustomerDropdown.first().scrollIntoViewIfNeeded();
        await this.filterByCustomerDropdown.first().click();
        await this.waitForRadixDropdownToAppear();
    }

    async selectCustomerFromFilter(customerName) {
        await this.waitForRadixDropdownToAppear();
        const wrapper = this.radixPopperContentWrapper.first();
        const target = wrapper.locator(`.//div[normalize-space()="${customerName}"]`);
        const fallback = wrapper.locator(
            `.//*[normalize-space()="${customerName}" or normalize-space(text())="${customerName}"]`
        );

        let el = target;
        if (!(await el.first().count())) {
            el = fallback;
        }

        if (!(await el.first().count())) {
            throw new Error(
                `Could not find element for customer: ${customerName} in the filter dropdown`
            );
        }

        await el.first().scrollIntoViewIfNeeded();
        const role = await el.first().getAttribute('role');
        let isSelected = false;
        if (role === 'checkbox') {
            const state = await el.first().getAttribute('data-state');
            isSelected = state === 'checked';
        }

        if (!isSelected) {
            await el.first().click();
        }

        await this.page.waitForTimeout(500);
    }

    async selectMultipleCustomersFromFilter(customerNames) {
        await this.clickFilterByCustomerDropdown();
        for (const customerName of customerNames) {
            if (!(await this.radixPopperContentWrapper.first().isVisible().catch(() => false))) {
                await this.clickFilterByCustomerDropdown();
            }
            await this.selectCustomerFromFilter(customerName);
            await this.page.waitForTimeout(300);
        }
        await this.page.waitForTimeout(500);
    }

    async getAllProjectCustomers() {
        await this.scrollToTop();
        const customers = this.page.locator(
            '//div[@class="space-y-2 mt-3"]/div[2]/span'
        );
        await this.page.waitForTimeout(1000);
        const texts = await customers.allTextContents();
        return texts.map(t => t.trim()).filter(Boolean);
    }
}

module.exports = { ProjectsPage };

