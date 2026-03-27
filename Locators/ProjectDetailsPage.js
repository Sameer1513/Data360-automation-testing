class ProjectDetailsPage {
    constructor(page) {
        this.page = page;
        this.overviewTab = page.getByRole('tab', { name: 'Overview' });
        // "Setup" tab in the project details top navigation
        this.setupTab = page.getByRole('tab', { name: 'Setup' });
        // Project setup "Pipeline" section/tab inside Setup page
        this.pipelineSectionTab = page
            .locator('button, a')
            .filter({ hasText: /^Pipeline$/ })
            .first();
        this.fabricationSectionTab = page.getByRole('tab', { name: 'Fabrication' }).first();
        this.othersSectionTab = page.getByRole('tab', { name: 'Others' }).first();

        // Unsaved changes dialog that can block tab switching
        this.unsavedChangesDialog = page.getByRole('dialog', { name: /unsaved changes/i });
        this.switchTabButton = page.getByRole('button', { name: /switch tab|switch/i });
    }

    async dismissUnsavedChangesIfShown() {
        if (await this.unsavedChangesDialog.isVisible().catch(() => false)) {
            await this.switchTabButton.click();
            await this.unsavedChangesDialog.waitFor({ state: 'hidden', timeout: 30000 });
        }
    }

    async goToOverviewTab() {
        await this.overviewTab.click();
        await this.dismissUnsavedChangesIfShown();
        await this.page.waitForLoadState('networkidle');
    }

    async goToSetupTab() {
        await this.setupTab.click();
        await this.dismissUnsavedChangesIfShown();
        await this.page.waitForLoadState('networkidle');
    }

    async selectPipelineSection() {
        await this.pipelineSectionTab.click();
    }

    async selectFabricationSection() {
        await this.fabricationSectionTab.click();
        await this.dismissUnsavedChangesIfShown();
        await this.page.waitForLoadState('networkidle').catch(() => { });
    }

    async selectFabricationSectionEnsured() {
        const fabricationHeading = this.page.getByRole('heading', { name: 'Buckle Arrestor', level: 3 });

        await this.selectFabricationSection();
        try {
            await fabricationHeading.waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) {
            await this.selectFabricationSection();
            await fabricationHeading.waitFor({ state: 'visible', timeout: 3000 });
        }
        await this.page.waitForLoadState('networkidle').catch(() => { });
    }

    async selectOthersSection() {
        await this.othersSectionTab.click();
        await this.dismissUnsavedChangesIfShown();
        await this.page.waitForLoadState('networkidle').catch(() => { });
    }

    async selectOthersSectionEnsured(othersRootLocator) {
        await this.selectOthersSection();
        try {
            await othersRootLocator.waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) {
            await this.selectOthersSection();
            await othersRootLocator.waitFor({ state: 'visible', timeout: 3000 });
        }
        await this.page.waitForLoadState('networkidle').catch(() => { });
    }
}

module.exports = { ProjectDetailsPage };
