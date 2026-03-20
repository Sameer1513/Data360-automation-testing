const { LoginPage } = require('./LoginPageLocators.page');
// const { ProjectsPage } = require('./ProjectsPage');
// const { CreateProjectPage } = require('./CreateProjectPage');
// const { OverviewPage } = require('./OverviewPage');

class POManager {
    constructor(page) {
        this.page = page;
        this.loginPage = new LoginPage(this.page);
        this.projectsPage = new ProjectsPage(this.page);
        this.createProjectPage = new CreateProjectPage(this.page);
        this.overviewPage = new OverviewPage(this.page);
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
}

module.exports = { POManager };

