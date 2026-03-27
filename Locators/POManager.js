const { LoginPage } = require('./LoginPageLocators.page');

const { ProjectsPage } = require('./ProjectsPage');
const { CreateProjectPage } = require('./CreateProjectPage');
const { OverviewPage } = require('./OverviewPage');
const { PipelineSetupPage } = require('./PipelineSetupPage');
const { ProjectDetailsPage } = require('./ProjectDetailsPage');
const { FabricationSetupPage } = require('./FabricationSetupPage');
const { OthersSetupPage } = require('./OthersSetupPage');

class POManager {
    constructor(page) {
        this.page = page;
        this.loginPage = new LoginPage(this.page);
        this.projectsPage = new ProjectsPage(this.page);
        this.createProjectPage = new CreateProjectPage(this.page);
        this.overviewPage = new OverviewPage(this.page);
        this.pipelineSetupPage = new PipelineSetupPage(this.page);
        this.projectDetailsPage = new ProjectDetailsPage(this.page);
        this.fabricationSetupPage = new FabricationSetupPage(this.page);
        this.othersSetupPage = new OthersSetupPage(this.page);
    }

    getLoginPage() {
        return this.loginPage;
    }

    getProjectsPage() {
        return this.projectsPage;
    }

    getCreateProjectPage() {
        return this.createProjectPage;
    }

    getOverviewPage() {
        return this.overviewPage;
    }

    getPipelineSetupPage() {
        return this.pipelineSetupPage;
    }

    getProjectDetailsPage() {
        return this.projectDetailsPage;
    }

    getFabricationSetupPage() {
        return this.fabricationSetupPage;
    }

    getOthersSetupPage() {
        return this.othersSetupPage;
    }
}

module.exports = { POManager };

