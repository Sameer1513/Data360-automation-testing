class OverviewPage {
    constructor(page) {
        this.page = page;

        this.editProjectButton = page.locator(
            '//button[contains(@class,"bg-gradient-to-r") and contains(text(),"Edit Project")]'
        );
        this.projectsLink = page.locator(
            '//span[contains(@class,"group-hover:text-[#e04530]") and contains(text(),"Projects")]'
        );

        this.projectNameValue = page.locator(
            '(//p[@class="text-base font-semibold text-gray-900 break-words truncate"][1])[1]'
        );
        this.projectNumberValue = page.locator(
            '(//p[@class="text-base font-semibold text-gray-900 break-words truncate"][1])[2]'
        );
        this.customerValue = page.locator(
            '(//p[@class="text-base font-semibold text-gray-900 break-words truncate"][1])[3]'
        );
        this.locationValue = page.locator(
            '(//p[@class="text-base font-semibold text-gray-900 break-words truncate"][1])[4]'
        );
        this.startDateValue = page.locator(
            '(//p[@class="text-base font-semibold text-gray-900 break-words truncate"][1])[5]'
        );
        this.endDateValue = page.locator(
            '(//p[@class="text-base font-semibold text-gray-900 break-words truncate"][1])[6]'
        );
        this.progressValue = page.locator(
            '(' +
                '//span[contains(@class,"inline-flex") and contains(@class,"items-center") and ' +
                'contains(@class,"gap-1.5") and contains(@class,"px-3") and contains(@class,"py-2") and ' +
                'contains(@class,"rounded-md") and contains(@class,"text-xs") and contains(@class,"font-medium")]' +
            ')[1]'
        );

        this.selectedTypesContainer = page.locator(
            '(//div[contains(@class,"flex") and contains(@class,"flex-wrap") and contains(@class,"gap-2")])[2]'
        );

        this.pipelineFeaturesHeader = page.locator(
            '//h4[contains(@class,"text-blue-800") and contains(normalize-space(),"Pipeline Features")]'
        );
        this.fabricationOptionsHeader = page.locator(
            '//h4[contains(normalize-space(),"Fabrication Options")]'
        );
        this.othersFeaturesHeader = page.locator(
            '//h4[contains(normalize-space(),"Others Features")]'
        );
    }

    async isOverviewPageDisplayed() {
        try {
            await this.editProjectButton.first().waitFor({ state: 'visible', timeout: 15000 });
            return await this.editProjectButton.first().isVisible();
        } catch {
            return false;
        }
    }

    async clickEditProject() {
        const { CreateProjectPage } = require('./CreateProjectPage');
        await this.editProjectButton.first().scrollIntoViewIfNeeded();
        await this.editProjectButton.first().click();
        return new CreateProjectPage(this.page);
    }

    async navigateBackToProjects() {
        const { ProjectsPage } = require('./ProjectsPage');
        await this.projectsLink.first().click();
        return new ProjectsPage(this.page);
    }

    async getProjectName() {
        await this.projectNameValue.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.projectNameValue.first().textContent();
        return text ? text.trim() : '';
    }

    async getProjectNumber() {
        await this.projectNumberValue.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.projectNumberValue.first().textContent();
        return text ? text.trim() : '';
    }

    async getCustomer() {
        await this.customerValue.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.customerValue.first().textContent();
        return text ? text.trim() : '';
    }

    async waitForCustomerToBe(expectedCustomer) {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            try {
                const current = await this.getCustomer();
                if (
                    expectedCustomer &&
                    current &&
                    expectedCustomer.toLowerCase().trim() === current.toLowerCase().trim()
                ) {
                    return;
                }
            } catch {
                // ignore
            }
            await this.page.waitForTimeout(200);
        }
    }

    async getLocation() {
        await this.locationValue.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.locationValue.first().textContent();
        return text ? text.trim() : '';
    }

    async waitForLocationToBe(expectedLocation) {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            try {
                const current = await this.getLocation();
                if (
                    expectedLocation &&
                    current &&
                    expectedLocation.toLowerCase().trim() === current.toLowerCase().trim()
                ) {
                    return;
                }
            } catch {
                // ignore
            }
            await this.page.waitForTimeout(200);
        }
    }

    async getStartDate() {
        await this.startDateValue.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.startDateValue.first().textContent();
        return text ? text.trim() : '';
    }

    async getEndDate() {
        await this.endDateValue.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.endDateValue.first().textContent();
        return text ? text.trim() : '';
    }

    async getProgress() {
        await this.progressValue.first().waitFor({ state: 'visible', timeout: 5000 });
        const text = await this.progressValue.first().textContent();
        return text ? text.trim() : '';
    }

    async waitForProgressToBe(expectedProgress) {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            try {
                const current = await this.getProgress();
                if (
                    current &&
                    expectedProgress &&
                    expectedProgress.toLowerCase().trim() === current.toLowerCase().trim()
                ) {
                    return;
                }
            } catch {
                // ignore transient
            }
            await this.page.waitForTimeout(300);
        }
    }

    async waitForOverviewToReflectChanges() {
        await this.page.waitForTimeout(2000);
    }

    async getSelectedProjectTypes() {
        await this.selectedTypesContainer.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        const texts = await this.selectedTypesContainer
            .first()
            .locator('.//*[normalize-space(text())!=""]')
            .allTextContents();
        const set = new Set(texts.map(t => t.trim()).filter(Boolean));
        return Array.from(set);
    }

    async isPipelineFeaturesSectionDisplayed() {
        try {
            await this.pipelineFeaturesHeader.first().waitFor({
                state: 'visible',
                timeout: 5000,
            });
            return await this.pipelineFeaturesHeader.first().isVisible();
        } catch {
            return false;
        }
    }

    async getPipelineSectionRoot() {
        await this.pipelineFeaturesHeader.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        return this.pipelineFeaturesHeader.first().locator('./following-sibling::div[1]');
    }

    async isTextPresentInPipelineSection(text) {
        try {
            const root = await this.getPipelineSectionRoot();
            const locator = root.locator(`.//*[contains(normalize-space(),"${text}")]`);
            return (await locator.count()) > 0;
        } catch {
            return false;
        }
    }

    async isFabricationOptionsSectionDisplayed() {
        try {
            await this.fabricationOptionsHeader.first().waitFor({
                state: 'visible',
                timeout: 5000,
            });
            return await this.fabricationOptionsHeader.first().isVisible();
        } catch {
            return false;
        }
    }

    async getFabricationSectionRoot() {
        await this.fabricationOptionsHeader.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        return this.fabricationOptionsHeader.first().locator(
            './ancestor::div[contains(@class,"space-y-6")][1]'
        );
    }

    async isTextPresentInFabricationSection(text) {
        try {
            const root = await this.getFabricationSectionRoot();
            const locator = root.locator(`.//*[contains(normalize-space(),"${text}")]`);
            return (await locator.count()) > 0;
        } catch {
            return false;
        }
    }

    async isFabricationOptionDisplayed(optionName) {
        try {
            const root = await this.getFabricationSectionRoot();
            const optionBlock = root.locator(
                './/div[contains(@class,"border-l-2") and contains(@class,"border-purple-200")][.//h5[normalize-space()=$name]]',
                { name: optionName }
            );
            return (await optionBlock.count()) > 0 && (await optionBlock.first().isVisible());
        } catch {
            return false;
        }
    }

    async getFabricationFeaturesForOption(optionName) {
        const root = await this.getFabricationSectionRoot();
        const optionBlock = root.locator(
            './/div[contains(@class,"border-l-2") and contains(@class,"border-purple-200")][.//h5[normalize-space()=$name]]',
            { name: optionName }
        );
        const badges = optionBlock.locator('.//div[contains(@class,"inline-block")]');
        const texts = await badges.allTextContents();
        const set = new Set(texts.map(t => t.trim()).filter(Boolean));
        return Array.from(set);
    }

    async isOthersFeaturesSectionDisplayed() {
        try {
            await this.othersFeaturesHeader.first().waitFor({
                state: 'visible',
                timeout: 5000,
            });
            return await this.othersFeaturesHeader.first().isVisible();
        } catch {
            return false;
        }
    }

    async getOthersSectionRoot() {
        await this.othersFeaturesHeader.first().waitFor({
            state: 'visible',
            timeout: 5000,
        });
        return this.othersFeaturesHeader.first().locator(
            './ancestor::div[contains(@class,"border-lime-200")][1]'
        );
    }

    async isTextPresentInOthersSection(text) {
        try {
            const root = await this.getOthersSectionRoot();
            const locator = root.locator(`.//*[contains(normalize-space(),"${text}")]`);
            return (await locator.count()) > 0;
        } catch {
            return false;
        }
    }

    async navigateToSetupPage() {
        const { SetupPage } = require('./SetupLocators.page');
        const setupTab = this.page.locator(
            "//div[contains(@class,'flex') and contains(@class,'items-center') and contains(@class,'gap-1')][.//span[contains(text(),'Setup')]]"
        );
        await setupTab.first().waitFor({ state: 'visible', timeout: 15000 });
        await setupTab.first().scrollIntoViewIfNeeded();
        await setupTab.first().click();

        const subTabs = this.page.locator(
            "//button[contains(text(),'Pipeline') or contains(text(),'Fabrication') or contains(text(),'Others')]"
        );
        await subTabs.first().waitFor({ state: 'visible', timeout: 15000 });
        await this.page.waitForTimeout(500);

        return new SetupPage(this.page);
    }

    async navigateToSpecificationsPage() {
        const { SpecificationsPage } = require('./SpecificationsPage');
        const specificationsTab = this.page.locator(
            "//button[@role='tab' and contains(@id,'specifications')]"
        );
        await specificationsTab.first().waitFor({ state: 'visible', timeout: 15000 });
        await specificationsTab.first().scrollIntoViewIfNeeded();
        await specificationsTab.first().click();

        const addSpecButton = this.page.locator(
            "//button[contains(@class,'bg-gradient-to-r') and contains(@class,'from-[#e04530]') and (contains(text(),'Add Specification') or .//*[contains(text(),'Add Specification')])]"
        );
        await addSpecButton.first().waitFor({ state: 'visible', timeout: 15000 });
        await this.page.waitForTimeout(500);

        return new SpecificationsPage(this.page);
    }

    async navigateToProductionPage() {
        const { ProductionPage } = require('./ProductionPage');
        const productionTab = this.page.locator(
            "//button[@role='tab' and contains(@id,'production')]"
        );
        await productionTab.first().waitFor({ state: 'visible', timeout: 15000 });
        await productionTab.first().scrollIntoViewIfNeeded();
        await productionTab.first().click();

        const searchInput = this.page.locator(
            "//input[contains(@placeholder,'Search weld')]"
        );
        await searchInput.first().waitFor({ state: 'visible', timeout: 15000 });
        await this.page.waitForTimeout(500);

        return new ProductionPage(this.page);
    }
}

module.exports = { OverviewPage };

