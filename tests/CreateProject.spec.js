const { test, expect } = require('@playwright/test');
const { POManager } = require('../Locators/POManager');
const loginTestData = require('../test-data/loginTestData.json');
const createProjectTestData = require('../test-data/createProjectTestData.json');
const ProjectTileAssertion = require('../Assertions/ProjectTileAssertion');
const { cleanupProjectByFirstTile } = require('../utils/projectCleanup.util');

test.describe('Create Project - Playwright', () => {
    let page;
    let poManager;
    let loginPage;
    let projectsPage;

    const editProjectScenarios = createProjectTestData.editProjectScenarios || [];

    function dateFromOffsetDays(offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + Number(offsetDays || 0));
        return d;
    }

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        poManager = new POManager(page);
        loginPage = poManager.getLoginPage();

        await loginPage.goTo();
        await expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        const email = loginTestData.validUser.email;
        const password = loginTestData.validUser.password;

        projectsPage = await loginPage.loginApplication(email, password);
        await expect(await projectsPage.isProjectsPageDisplayed()).toBeTruthy();
    });

    test.afterEach(async () => {
        await page.close();
    });

    test('verifyMandatoryFieldValidationMessagesWhenFieldsMissing', async () => {
        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        const actualWarnings = await createProjectPage.getMandatoryFieldWarningMessages();
        const expectedWarnings = createProjectTestData.mandatoryWarnings;

        const sortedActual = [...actualWarnings].sort();
        const sortedExpected = [...expectedWarnings].sort();
        expect(sortedActual).toEqual(sortedExpected);
    });

    test('verifySubmitButtonDisabledUntilAllMandatoryFieldsAreFilled', async () => {
        const v = createProjectTestData.submitButtonValidation;
        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        await createProjectPage.enterProjectName(v.projectName);
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        await createProjectPage.enterProjectNumber(v.projectNumber);
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        await createProjectPage.selectLocation(v.location);
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        await createProjectPage.selectCustomer(v.customer);
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        const start = dateFromOffsetDays(v.startOffsetDays);
        const end = dateFromOffsetDays(v.endOffsetDays);

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        await createProjectPage.selectProjectStatus(v.status);
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        await createProjectPage.selectProjectType(v.type);
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeFalsy();

        await createProjectPage.selectPipelineFeature(
            v.pipeline.requiredFeatureToEnableSubmit
        );
        expect(await createProjectPage.isSubmitButtonEnabled()).toBeTruthy();
    });

    test('createPipelineProjectWithWeldingMachines', async () => {
        const { name, number, location, customer, status, type, pipeline } =
            createProjectTestData.pipelineProject;

        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        await createProjectPage.enterProjectName(name);
        await createProjectPage.enterProjectNumber(number);
        await createProjectPage.selectLocation(location);
        await createProjectPage.selectCustomer(customer);

        const start = new Date();
        start.setDate(start.getDate() - 1);
        const end = new Date();

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);

        await createProjectPage.selectProjectStatus(status);
        await createProjectPage.selectProjectType(type);
        for (const f of pipeline.features || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of pipeline.machines || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();

        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const expectedStartText = createProjectPage.formatDateForUI(start);
        const expectedEndText = createProjectPage.formatDateForUI(end);

        await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
            name,
            number,
            location,
            customer,
            // Status mismatch is a known UI issue, so we still skip it.
            type,
            dateRange: `${expectedStartText} to ${expectedEndText}`,
        });

        await cleanupProjectByFirstTile(projectsPageAfterSubmit, name);
    });

    test('searchLocationAndSelectFromDropdown', async () => {
        const d = createProjectTestData.searchAndSelectLocationProject;
        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        const start = dateFromOffsetDays(d.startOffsetDays);
        const end = dateFromOffsetDays(d.endOffsetDays);

        await createProjectPage.enterProjectName(d.name);
        await createProjectPage.enterProjectNumber(d.number);
        await createProjectPage.searchAndSelectLocation(
            d.locationSearch.query,
            d.locationSearch.option
        );
        expect(await createProjectPage.getSelectedLocationText()).toContain(
            d.locationSearch.option
        );

        await createProjectPage.selectCustomer(d.customer);
        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(d.status);
        await createProjectPage.selectProjectType(d.type);
        for (const f of (d.pipeline && d.pipeline.features) || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of (d.pipeline && d.pipeline.machines) || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();
        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const expectedStartText = createProjectPage.formatDateForUI(start);
        const expectedEndText = createProjectPage.formatDateForUI(end);

        try {
            await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
                name: d.name,
                number: d.number,
                location: d.locationSearch.option,
                customer: d.customer,
                dateRange: `${expectedStartText} to ${expectedEndText}`,
            });
        } finally {
            await cleanupProjectByFirstTile(projectsPageAfterSubmit, d.name);
        }
    });

    test('searchCustomerAndSelectFromDropdown', async () => {
        const d = createProjectTestData.searchAndSelectCustomerProject;
        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        const start = dateFromOffsetDays(d.startOffsetDays);
        const end = dateFromOffsetDays(d.endOffsetDays);

        await createProjectPage.enterProjectName(d.name);
        await createProjectPage.enterProjectNumber(d.number);
        await createProjectPage.selectLocation(d.location);
        await createProjectPage.searchAndSelectCustomer(
            d.customerSearch.query,
            d.customerSearch.option
        );
        expect(await createProjectPage.getSelectedCustomerText()).toContain(
            d.customerSearch.option
        );

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(d.status);
        await createProjectPage.selectProjectType(d.type);
        for (const f of (d.pipeline && d.pipeline.features) || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of (d.pipeline && d.pipeline.machines) || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();
        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const expectedStartText = createProjectPage.formatDateForUI(start);
        const expectedEndText = createProjectPage.formatDateForUI(end);

        try {
            await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
                name: d.name,
                number: d.number,
                location: d.location,
                customer: d.customerSearch.option,
                dateRange: `${expectedStartText} to ${expectedEndText}`,
            });
        } finally {
            await cleanupProjectByFirstTile(projectsPageAfterSubmit, d.name);
        }
    });

    test('addNewLocationFromDropdownAndCreateProject', async () => {
        const d = createProjectTestData.addNewLocationProject;
        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        const start = dateFromOffsetDays(d.startOffsetDays);
        const end = dateFromOffsetDays(d.endOffsetDays);
        const newLocation = `${d.newLocationPrefix}${Date.now()}`;
        const expectedLocation = newLocation.toUpperCase();

        await createProjectPage.enterProjectName(d.name);
        await createProjectPage.enterProjectNumber(d.number);
        await createProjectPage.addNewLocationFromDropdown(newLocation);
        expect(await createProjectPage.getSelectedLocationText()).toContain(expectedLocation);

        await createProjectPage.selectCustomer(d.customer);
        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(d.status);
        await createProjectPage.selectProjectType(d.type);
        for (const f of (d.pipeline && d.pipeline.features) || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of (d.pipeline && d.pipeline.machines) || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();
        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const expectedStartText = createProjectPage.formatDateForUI(start);
        const expectedEndText = createProjectPage.formatDateForUI(end);

        try {
            await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
                name: d.name,
                number: d.number,
                location: expectedLocation,
                customer: d.customer,
                dateRange: `${expectedStartText} to ${expectedEndText}`,
            });
        } finally {
            await cleanupProjectByFirstTile(projectsPageAfterSubmit, d.name);
        }
    });

    test('addNewCustomerFromDropdownAndCreateProject', async () => {
        const d = createProjectTestData.addNewCustomerProject;
        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        const start = dateFromOffsetDays(d.startOffsetDays);
        const end = dateFromOffsetDays(d.endOffsetDays);
        const newCustomer = `${d.newCustomerPrefix}${Date.now()}`;

        await createProjectPage.enterProjectName(d.name);
        await createProjectPage.enterProjectNumber(d.number);
        await createProjectPage.selectLocation(d.location);
        await createProjectPage.addNewCustomerFromDropdown(newCustomer);
        expect(await createProjectPage.getSelectedCustomerText()).toContain(newCustomer);

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(d.status);
        await createProjectPage.selectProjectType(d.type);
        for (const f of (d.pipeline && d.pipeline.features) || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of (d.pipeline && d.pipeline.machines) || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();
        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const expectedStartText = createProjectPage.formatDateForUI(start);
        const expectedEndText = createProjectPage.formatDateForUI(end);

        try {
            await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
                name: d.name,
                number: d.number,
                location: d.location,
                customer: newCustomer,
                dateRange: `${expectedStartText} to ${expectedEndText}`,
            });
        } finally {
            await cleanupProjectByFirstTile(projectsPageAfterSubmit, d.name);
        }
    });

    test('statusOnProjectTileShouldMatchSelectedStatusAfterCreation', async () => {
        const { name, number, location, customer, status, type, pipeline } =
            createProjectTestData.statusAssertionProject;
        const expectedProjectName = name;
        const expectedProjectNumber = number;
        const expectedLocation = location;
        const expectedCustomer = customer;
        const expectedStatus = status;
        const expectedProjectType = type;

        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        const start = new Date();
        start.setDate(start.getDate() - 1);
        const end = new Date();

        await createProjectPage.enterProjectName(expectedProjectName);
        await createProjectPage.enterProjectNumber(expectedProjectNumber);
        await createProjectPage.selectLocation(expectedLocation);
        await createProjectPage.selectCustomer(expectedCustomer);
        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(expectedStatus);
        await createProjectPage.selectProjectType(expectedProjectType);
        for (const f of pipeline.features || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of pipeline.machines || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();
        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        try {
            await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
                name: expectedProjectName,
                number: expectedProjectNumber,
                location: expectedLocation,
                customer: expectedCustomer,
                status: expectedStatus,
            });
        } finally {
            await cleanupProjectByFirstTile(projectsPageAfterSubmit, expectedProjectName);
        }
    });

    test('createFabricationProjectWithWeldingMachines', async () => {
        const { name, number, location, customer, status, type, fabrication } =
            createProjectTestData.fabricationProject;

        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        await createProjectPage.enterProjectName(name);
        await createProjectPage.enterProjectNumber(number);
        await createProjectPage.selectLocation(location);
        await createProjectPage.selectCustomer(customer);

        const start = new Date();
        start.setDate(start.getDate() - 2);
        const end = new Date();
        end.setDate(end.getDate() - 1);

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(status);
        await createProjectPage.selectProjectType(type);
        for (const opt of fabrication.options || []) {
            await createProjectPage.selectFabricationOption(opt.name);
            for (const feat of opt.features || []) {
                await createProjectPage.selectFabricationFeature(opt.name, feat);
            }
            for (const machine of opt.machines || []) {
                await createProjectPage.selectFabricationMachine(opt.name, machine);
            }
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();

        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const fabStartText = createProjectPage.formatDateForUI(start);
        const fabEndText = createProjectPage.formatDateForUI(end);

        await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
            name,
            number,
            location,
            customer,
            type,
            dateRange: `${fabStartText} to ${fabEndText}`,
        });

        await cleanupProjectByFirstTile(projectsPageAfterSubmit, name);
    });

    test('createOthersProjectWithWeldingMachines', async () => {
        const { name, number, location, customer, status, type, others } =
            createProjectTestData.othersProject;

        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        await createProjectPage.enterProjectName(name);
        await createProjectPage.enterProjectNumber(number);
        await createProjectPage.selectLocation(location);
        await createProjectPage.selectCustomer(customer);

        const start = new Date();
        start.setDate(start.getDate() - 3);
        const end = new Date();
        end.setDate(end.getDate() - 1);

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(status);
        await createProjectPage.selectProjectType(type);
        for (const f of others.features || []) {
            await createProjectPage.selectOthersFeature(f);
        }
        for (const m of others.machines || []) {
            await createProjectPage.selectOthersWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();

        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const othStartText = createProjectPage.formatDateForUI(start);
        const othEndText = createProjectPage.formatDateForUI(end);

        await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
            name,
            number,
            location,
            customer,
            type,
            dateRange: `${othStartText} to ${othEndText}`,
        });

        await cleanupProjectByFirstTile(projectsPageAfterSubmit, name);
    });

    test('createProjectWithAllProjectTypes', async () => {
        test.setTimeout(120000);
        const allTypes = createProjectTestData.allTypesProject;
        const expectedProjectTypes = allTypes.types;

        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        await createProjectPage.enterProjectName(allTypes.name);
        await createProjectPage.enterProjectNumber(allTypes.number);
        await createProjectPage.selectLocation(allTypes.location);
        await createProjectPage.selectCustomer(allTypes.customer);

        const start = new Date();
        start.setDate(start.getDate() - 1);
        const end = new Date();

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(allTypes.status);

        for (const t of allTypes.types || []) {
            await createProjectPage.selectProjectType(t);
        }
        for (const f of (allTypes.pipeline && allTypes.pipeline.features) || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of (allTypes.pipeline && allTypes.pipeline.machines) || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }
        for (const opt of (allTypes.fabrication && allTypes.fabrication.options) || []) {
            await createProjectPage.selectFabricationOption(opt.name);
            for (const feat of opt.features || []) {
                await createProjectPage.selectFabricationFeature(opt.name, feat);
            }
            for (const machine of opt.machines || []) {
                await createProjectPage.selectFabricationMachine(opt.name, machine);
            }
        }
        for (const f of (allTypes.others && allTypes.others.features) || []) {
            await createProjectPage.selectOthersFeature(f);
        }
        for (const m of (allTypes.others && allTypes.others.machines) || []) {
            await createProjectPage.selectOthersWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();

        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const expectedStartText = createProjectPage.formatDateForUI(start);
        const expectedEndText = createProjectPage.formatDateForUI(end);

        await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterSubmit, {
            name: allTypes.name,
            number: allTypes.number,
            location: allTypes.location,
            customer: allTypes.customer,
            dateRange: `${expectedStartText} to ${expectedEndText}`,
            types: expectedProjectTypes,
        });

        await cleanupProjectByFirstTile(projectsPageAfterSubmit, allTypes.name);
    });

    for (const scenario of editProjectScenarios) {
        test(`createAndEditProject - ${scenario.scenarioName}`, async () => {
            test.setTimeout(120000);
            const initial = scenario.initial;
            const edited = scenario.edited;

            const createProjectPage = await projectsPage.clickCreateProject();
            expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

            await createProjectPage.enterProjectName(initial.name);
            await createProjectPage.enterProjectNumber(initial.number);
            await createProjectPage.selectLocation(initial.location);
            await createProjectPage.selectCustomer(initial.customer);

            const initialStart = dateFromOffsetDays(initial.startOffsetDays);
            const initialEnd = dateFromOffsetDays(initial.endOffsetDays);

            await createProjectPage.selectStartDate(initialStart);
            await createProjectPage.selectEndDate(initialEnd);
            await createProjectPage.selectProjectStatus(initial.status);

            // Create phase: fully driven by dataset
            for (const t of initial.types || []) {
                await createProjectPage.selectProjectType(t);
            }

            const initialPipeline = initial.pipeline || {};
            for (const f of initialPipeline.features || []) {
                await createProjectPage.selectPipelineFeature(f);
            }
            for (const m of initialPipeline.machines || []) {
                await createProjectPage.selectPipelineWeldingMachine(m);
            }

            const projectsPageAfterCreate = await createProjectPage.submitProject();
            expect(await projectsPageAfterCreate.isProjectsPageDisplayed()).toBeTruthy();

            const initialStartText = createProjectPage.formatDateForUI(initialStart);
            const initialEndText = createProjectPage.formatDateForUI(initialEnd);

            await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterCreate, {
                name: initial.name,
                number: initial.number,
                location: initial.location,
                customer: initial.customer,
                dateRange: `${initialStartText} to ${initialEndText}`,
                types: initial.types,
            });

            // Newest created project is expected in the first tile; verify and click it.
            const firstName = await projectsPageAfterCreate.getFirstProjectName();
            expect(firstName).toBe(initial.name);
            const overviewPage = await projectsPageAfterCreate.clickFirstProjectName();
            expect(await overviewPage.isOverviewPageDisplayed()).toBeTruthy();

            const editProjectPage = await overviewPage.clickEditProject();
            expect(await editProjectPage.isEditProjectFormDisplayed()).toBeTruthy();
            await page.waitForTimeout(500);

            await editProjectPage.selectLocation(edited.location);
            await editProjectPage.selectCustomer(edited.customer);

            const editedStart = dateFromOffsetDays(edited.startOffsetDays);
            const editedEnd = dateFromOffsetDays(edited.endOffsetDays);
            await editProjectPage.selectStartDate(editedStart);
            await editProjectPage.selectEndDate(editedEnd);
            await editProjectPage.selectProjectStatus(edited.status);

            for (const t of edited.uncheckTypes || []) {
                await editProjectPage.uncheckProjectType(t);
            }
            for (const t of edited.checkTypes || []) {
                await editProjectPage.selectProjectType(t);
            }

            for (const f of edited.othersFeatures || []) {
                await editProjectPage.selectOthersFeature(f);
            }
            for (const m of edited.othersMachines || []) {
                await editProjectPage.selectOthersWeldingMachine(m);
            }

            const fab = edited.fabrication || {};
            for (const opt of fab.options || []) {
                await editProjectPage.selectFabricationOption(opt.name);
                for (const f of opt.features || []) {
                    await editProjectPage.selectFabricationFeature(opt.name, f);
                }
                for (const m of opt.machines || []) {
                    await editProjectPage.selectFabricationMachine(opt.name, m);
                }
            }

            const overviewPageAfterUpdate = await editProjectPage.updateProject();
            expect(await overviewPageAfterUpdate.isOverviewPageDisplayed()).toBeTruthy();
            await overviewPageAfterUpdate.waitForProgressToBe(edited.status);

            const projectsPageAfterEdit = await overviewPageAfterUpdate.navigateBackToProjects();
            expect(await projectsPageAfterEdit.isProjectsPageDisplayed()).toBeTruthy();

            // Ensure the newest/edited project is actually the first tile before asserting.
            await expect
                .poll(async () => await projectsPageAfterEdit.getFirstProjectNumber(), {
                    timeout: 30000,
                })
                .toBe(`#${initial.number}`);
            await projectsPageAfterEdit.waitForFirstProjectStatusToBe(edited.status);

            const editedStartText = editProjectPage.formatDateForUI(editedStart);
            const editedEndText = editProjectPage.formatDateForUI(editedEnd);

            try {
                await ProjectTileAssertion.expectMatchesFirstTile(projectsPageAfterEdit, {
                    name: initial.name,
                    number: initial.number,
                    location: edited.location,
                    customer: edited.customer,
                    status: edited.status,
                    dateRange: `${editedStartText} to ${editedEndText}`,
                    types: edited.types,
                });
            } finally {
                await cleanupProjectByFirstTile(projectsPageAfterEdit, initial.name);
            }
        });
    }

    test('deleteProjectSelectionAndClearSelection', async () => {
        const del = createProjectTestData.deleteProjectTest;
        const expectedProjectName = del.name;
        const expectedProjectNumber = del.number;
        const expectedLocation = del.location;
        const expectedCustomer = del.customer;
        const expectedStatus = del.status;
        const expectedProjectType = del.type;

        const createProjectPage = await projectsPage.clickCreateProject();
        expect(await createProjectPage.isCreateProjectFormDisplayed()).toBeTruthy();

        await createProjectPage.enterProjectName(expectedProjectName);
        await createProjectPage.enterProjectNumber(expectedProjectNumber);
        await createProjectPage.selectLocation(expectedLocation);
        await createProjectPage.selectCustomer(expectedCustomer);

        const start = new Date();
        start.setDate(start.getDate() - 1);
        const end = new Date();

        await createProjectPage.selectStartDate(start);
        await createProjectPage.selectEndDate(end);
        await createProjectPage.selectProjectStatus(expectedStatus);
        await createProjectPage.selectProjectType(expectedProjectType);
        for (const f of (del.pipeline && del.pipeline.features) || []) {
            await createProjectPage.selectPipelineFeature(f);
        }
        for (const m of (del.pipeline && del.pipeline.machines) || []) {
            await createProjectPage.selectPipelineWeldingMachine(m);
        }

        const projectsPageAfterSubmit = await createProjectPage.submitProject();
        expect(await projectsPageAfterSubmit.isProjectsPageDisplayed()).toBeTruthy();

        const actualProjectName = await projectsPageAfterSubmit.getFirstProjectName();
        const actualProjectNumber = await projectsPageAfterSubmit.getFirstProjectNumber();

        expect(actualProjectName).toBe(expectedProjectName);
        expect(actualProjectNumber).toBe(`#${expectedProjectNumber}`);

        if (actualProjectName === expectedProjectName) {
            await projectsPageAfterSubmit.clickFirstProjectCheckbox();
            await page.waitForTimeout(500);

            expect(
                await projectsPageAfterSubmit.isClearSelectionButtonDisplayed()
            ).toBeTruthy();
            expect(
                await projectsPageAfterSubmit.isDeleteSelectedButtonDisplayed()
            ).toBeTruthy();

            await projectsPageAfterSubmit.clickClearSelectionButton();
            await page.waitForTimeout(500);

            const checkboxDataState =
                await projectsPageAfterSubmit.getFirstProjectCheckboxDataState();
            expect(checkboxDataState).not.toBe('checked');
            expect(
                !checkboxDataState ||
                    checkboxDataState === 'false' ||
                    checkboxDataState === 'unchecked'
            ).toBeTruthy();

            await projectsPageAfterSubmit.clickFirstProjectCheckbox();
            await page.waitForTimeout(500);

            await projectsPageAfterSubmit.clickDeleteSelectedButton();
            await page.waitForTimeout(1000);

            expect(await projectsPageAfterSubmit.isDeleteDialogDisplayed()).toBeTruthy();

            await projectsPageAfterSubmit.toggleHardDeleteSwitch();

            const warningMessage =
                await projectsPageAfterSubmit.getHardDeleteWarningMessage();
            for (const piece of del.hardDeleteWarningContains || []) {
                expect(warningMessage).toContain(piece);
            }

            const deleteDialogProjectName =
                await projectsPageAfterSubmit.getDeleteDialogProjectName();
            const deleteDialogProjectNumber =
                await projectsPageAfterSubmit.getDeleteDialogProjectNumber();
            expect(deleteDialogProjectName).toBe(expectedProjectName);
            expect(deleteDialogProjectNumber).toBe(`#${expectedProjectNumber}`);

            await projectsPageAfterSubmit.clickHardDeleteButton();
            await page.waitForTimeout(2000);

            await projectsPageAfterSubmit.scrollToTop();
            await page.waitForTimeout(1000);
            const firstTileProjectNameAfterDelete =
                await projectsPageAfterSubmit.getFirstProjectName();
            expect(firstTileProjectNameAfterDelete).not.toBe(expectedProjectName);
        } else {
            throw new Error(
                'Created project name does not match the first tile project name. Cannot proceed with delete test.'
            );
        }
    });
});

