const { test, expect } = require('@playwright/test');
const { POManager } = require('../Locators/POManager');
const createProjectPayload = require('../test-data/setupProjectPayload.json');
const pipelineSetupTestData = require('../test-data/pipelineSetupTestData.json');
const loginTestData = require('../test-data/loginTestData.json');
const fabricationSetupTestData = require('../test-data/fabricationSetupTestData.json');
const othersSetupTestData = require('../test-data/othersSetupTestData.json');
const {
  assertPipelineRetainedValues,
  assertPipelineMandatoryValidationErrors,
  assertPipelinePipeByIndexRetainedValues,
  assertFabricationRetainedValues,
  assertFabricationValidationErrorsForSubtype,
  assertOthersPipeByIndexRetainedValues,
  assertOthersMandatoryValidationErrors,
} = require('../Assertions/SetupPageAssertions');

async function loginAndOpenProject(poManager, projectTitle) {
  const loginPage = poManager.getLoginPage();
  await loginPage.goTo();
  const email = loginTestData.validUser.email;
  const password = loginTestData.validUser.password;
  await loginPage.loginApplication(email, password);

  const searchInput = poManager.page.getByPlaceholder('Search projects by name, number, location, or customer.').first();
  await searchInput.fill(projectTitle);
  await poManager.page.keyboard.press('Enter');

  const projectsPage = poManager.getProjectsPage();
  await projectsPage.clickFirstProjectName();
}

async function openProjectSetup(poManager, projectTitle) {
  await loginAndOpenProject(poManager, projectTitle);
  const projectDetailsPage = poManager.getProjectDetailsPage();
  await projectDetailsPage.goToSetupTab();
  return projectDetailsPage;
}

test.describe('SetupPage - Pipeline, Fabrication and Others with Pipefitter Configuration', () => {
  test('Verify PipeLine Setup Pipe Creation with Pipefitter Configuration', async ({ page, request }) => {
    test.setTimeout(80 * 1000);
    const poManager = new POManager(page);
    const { project, pipeline, pipefitter } = pipelineSetupTestData;

    const loginPage = poManager.getLoginPage();
    await loginPage.goTo();

    const email = loginTestData.validUser.email;
    const password = loginTestData.validUser.password;
    await loginPage.loginApplication(email, password);

    await page.waitForFunction(() => {
      return !!window.localStorage.getItem('ap_idToken');
    }, null, { timeout: 15000 });

    const appIdToken = await page.evaluate(() => {
      return window.localStorage.getItem('ap_idToken');
    });

    const apiResponse = await request.post(
      'https://mgwbhc264j.execute-api.us-west-2.amazonaws.com/dev/data360/project/createProject',
      {
        headers: {
          Authorization: appIdToken,
          'Content-Type': 'application/json',
        },
        data: createProjectPayload,
      }
    );

    await expect(apiResponse.ok()).toBeTruthy();

    await page.reload({ waitUntil: 'networkidle' });
    const projectsPage = poManager.getProjectsPage();
    await expect(projectsPage.firstProjectName).toHaveAttribute('title', project.expectedTitle);

    await projectsPage.clickFirstProjectName();

    const projectDetailsPage = poManager.getProjectDetailsPage();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectPipelineSection();

    const pipelineSetupPage = poManager.getPipelineSetupPage();
    await pipelineSetupPage.setNumberOfPipeSizes(pipeline.numberOfPipeSizes);

    await pipelineSetupPage.fillPipe1Details(pipeline.pipe1);
    await pipelineSetupPage.selectManufacturersExactly(pipeline.pipe1.manufacturers);
    await pipelineSetupPage.fillPipeFitterConfiguration(pipefitter);

    await pipelineSetupPage.clickSave();

    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectPipelineSection();
    await assertPipelineRetainedValues(pipelineSetupPage, pipeline, pipefitter);
  });

  test('Verify Fabrication setup - Buckle Arrestor, Pipe In Pipe and Bulk Head Creation with Pipefitter Configuration', async ({ page }) => {
    test.setTimeout(120 * 1000);
    const poManager = new POManager(page);
    const { project, fabrication } = fabricationSetupTestData;
    const { pipefitter } = fabricationSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectFabricationSectionEnsured();

    const fabricationSetupPage = poManager.getFabricationSetupPage();
    await fabricationSetupPage.fillSubtype('Buckle Arrestor', fabrication.buckleArrestor, pipefitter);
    await fabricationSetupPage.fillSubtype('Pipe in Pipe', fabrication.pipeInPipe, pipefitter);
    await fabricationSetupPage.fillSubtype('Bulk Head', fabrication.bulkHead, pipefitter);

    await fabricationSetupPage.clickSaveAndWait();
    await expect(page.getByText('Setup Saved Successfully', { exact: false }).first()).toBeVisible();

    // Verify retained values after navigating away and back (same approach as pipeline).
    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectFabricationSectionEnsured();

    await assertFabricationRetainedValues(fabricationSetupPage, fabrication, pipefitter);
  });

  test('Verify Others setup - Single pipe with Pipefitter Configuration', async ({ page }) => {
    test.setTimeout(60 * 1000);

    const poManager = new POManager(page);
    const { project, others, pipefitter } = othersSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const othersSetupPage = poManager.getOthersSetupPage();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await othersSetupPage.fillNumberOfPipeSizes(others.numberOfPipeSizes);
    await othersSetupPage.fillPipeDetailsByIndex(0, others.pipe1);
    await othersSetupPage.fillPipeFitterConfigurationByIndex(0, pipefitter);
    await othersSetupPage.clickSaveAndWait();

    // Wait for save refresh and then navigate to Others tab again before asserting.
    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await assertOthersPipeByIndexRetainedValues(
      othersSetupPage,
      0,
      others.pipe1,
      pipefitter
    );
  });

  test('Verify Pipeline setup edit - update existing Pipefitter configuration', async ({ page }) => {
    test.setTimeout(90 * 1000);

    const poManager = new POManager(page);
    const { project, pipeline, pipelineEdit, pipefitterEdit } = pipelineSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectPipelineSection();

    const pipelineSetupPage = poManager.getPipelineSetupPage();
    await pipelineSetupPage.setNumberOfPipeSizes(pipelineEdit.numberOfPipeSizes);
    await pipelineSetupPage.fillPipe1Details(pipelineEdit.pipe1);
    await pipelineSetupPage.selectManufacturersExactly(
      pipelineEdit.pipe1.manufacturers,
      pipeline.pipe1.manufacturers
    );
    await pipelineSetupPage.fillPipeFitterConfiguration(pipefitterEdit);
    await pipelineSetupPage.clickSave();

    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectPipelineSection();
    await assertPipelineRetainedValues(
      pipelineSetupPage,
      pipelineEdit,
      pipefitterEdit,
      pipeline.pipe1.manufacturers
    );
  });

  test('Verify Pipeline setup - add Pipe 2 and Pipe 3 with multiple WPS numbers', async ({ page }) => {
    test.setTimeout(110 * 1000);

    const poManager = new POManager(page);
    const { project, pipelineMultiPipe, pipefitterPipe2, pipefitterPipe3 } = pipelineSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectPipelineSection();

    const pipelineSetupPage = poManager.getPipelineSetupPage();
    await pipelineSetupPage.incrementNumberOfPipeSizesByArrowUp(2);
    await expect(pipelineSetupPage.numberOfPipeSizes).toHaveValue(String(pipelineMultiPipe.numberOfPipeSizes));

    await pipelineSetupPage.fillPipeDetailsByIndex(1, pipelineMultiPipe.pipe2);
    await pipelineSetupPage.selectManufacturersForPipe(1, pipelineMultiPipe.pipe2.manufacturers);
    await pipelineSetupPage.fillPipeFitterConfigurationByIndex(1, pipefitterPipe2);
    await pipelineSetupPage.fillPipeDetailsByIndex(2, pipelineMultiPipe.pipe3);
    await pipelineSetupPage.selectManufacturersForPipe(2, pipelineMultiPipe.pipe3.manufacturers);
    await pipelineSetupPage.fillPipeFitterConfigurationByIndex(2, pipefitterPipe3);
    await pipelineSetupPage.clickSave();

    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectPipelineSection();

    await assertPipelinePipeByIndexRetainedValues(
      pipelineSetupPage,
      1,
      pipelineMultiPipe.pipe2,
      pipefitterPipe2
    );
    await assertPipelinePipeByIndexRetainedValues(
      pipelineSetupPage,
      2,
      pipelineMultiPipe.pipe3,
      pipefitterPipe3
    );
  });

  test('Verify Pipeline setup edit - update all pipes values with multiple WPS numbers', async ({ page }) => {
    test.setTimeout(130 * 1000);

    const poManager = new POManager(page);
    const {
      project,
      pipelineEdit,
      pipelineMultiPipe,
      pipelineMultiPipeEdit,
      pipefitterPipe1Edit,
      pipefitterPipe2Edit,
      pipefitterPipe3Edit,
    } = pipelineSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectPipelineSection();

    const pipelineSetupPage = poManager.getPipelineSetupPage();
    await pipelineSetupPage.setNumberOfPipeSizes(pipelineMultiPipeEdit.numberOfPipeSizes);
    await pipelineSetupPage.fillPipeDetailsByIndex(0, pipelineMultiPipeEdit.pipe1);
    await pipelineSetupPage.selectManufacturersForPipe(
      0,
      pipelineMultiPipeEdit.pipe1.manufacturers,
      pipelineEdit.pipe1.manufacturers
    );
    await pipelineSetupPage.fillPipeFitterConfigurationByIndex(0, pipefitterPipe1Edit);
    await pipelineSetupPage.fillPipeDetailsByIndex(1, pipelineMultiPipeEdit.pipe2);
    await pipelineSetupPage.selectManufacturersForPipe(
      1,
      pipelineMultiPipeEdit.pipe2.manufacturers,
      pipelineMultiPipe.pipe2.manufacturers
    );
    await pipelineSetupPage.fillPipeFitterConfigurationByIndex(1, pipefitterPipe2Edit);
    await pipelineSetupPage.fillPipeDetailsByIndex(2, pipelineMultiPipeEdit.pipe3);
    await pipelineSetupPage.selectManufacturersForPipe(
      2,
      pipelineMultiPipeEdit.pipe3.manufacturers,
      pipelineMultiPipe.pipe3.manufacturers
    );
    await pipelineSetupPage.fillPipeFitterConfigurationByIndex(2, pipefitterPipe3Edit);
    await pipelineSetupPage.clickSave();

    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectPipelineSection();

    await assertPipelinePipeByIndexRetainedValues(
      pipelineSetupPage,
      0,
      pipelineMultiPipeEdit.pipe1,
      pipefitterPipe1Edit,
      pipelineEdit.pipe1.manufacturers
    );
    await assertPipelinePipeByIndexRetainedValues(
      pipelineSetupPage,
      1,
      pipelineMultiPipeEdit.pipe2,
      pipefitterPipe2Edit,
      pipelineMultiPipe.pipe2.manufacturers
    );
    await assertPipelinePipeByIndexRetainedValues(
      pipelineSetupPage,
      2,
      pipelineMultiPipeEdit.pipe3,
      pipefitterPipe3Edit,
      pipelineMultiPipe.pipe3.manufacturers
    );
  });

  test('Verify Pipeline setup validation messages for mandatory empty fields', async ({ page }) => {
    test.setTimeout(90 * 1000);

    const poManager = new POManager(page);
    const { project, pipelineMultiPipeEdit } = pipelineSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectPipelineSection();

    const pipelineSetupPage = poManager.getPipelineSetupPage();
    await pipelineSetupPage.clearPipe1MandatoryFields(pipelineMultiPipeEdit.pipe1.manufacturers);
    await pipelineSetupPage.clickSaveForValidation();
    await assertPipelineMandatoryValidationErrors(pipelineSetupPage);
  });

  test('Verify Pipeline setup validation - empty Number of Job Numbers should show validation and prevent save', async ({ page }) => {
    test.setTimeout(90 * 1000);

    const poManager = new POManager(page);
    const { project } = pipelineSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectPipelineSection();

    const pipelineSetupPage = poManager.getPipelineSetupPage();
    await pipelineSetupPage.clearPipe1NumberOfJobsFieldEnsuredEmpty();
    await pipelineSetupPage.clickSaveForValidation();

    // Expected behavior: validation errors should appear and save should not succeed.
    await expect(pipelineSetupPage.pipe1ValidationBox).toBeVisible({ timeout: 3000 });
    await expect(pipelineSetupPage.saveSuccessToast).not.toBeVisible({ timeout: 3000 });
  });

  test('Verify Pipeline delete pipe - delete Pipe 1 and validate reindexing', async ({ page }) => {
    test.setTimeout(120 * 1000);

    const poManager = new POManager(page);
    const {
      project,
      pipelineMultiPipeEdit,
      pipefitterPipe1Edit,
      pipefitterPipe2Edit,
      pipefitterPipe3Edit,
    } = pipelineSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectPipelineSection();
    const pipelineSetupPage = poManager.getPipelineSetupPage();

    await expect(pipelineSetupPage.numberOfPipeSizes).toHaveValue(
      String(pipelineMultiPipeEdit.numberOfPipeSizes),
      { timeout: 15000 }
    );

    await pipelineSetupPage.openDeletePipeDialogByIndex(0);
    await pipelineSetupPage.assertDeleteDialogDetails('1', {
      wallThickness: pipelineMultiPipeEdit.pipe1.wallThickness,
      numberOfPipes: pipelineMultiPipeEdit.pipe1.numberOfPipes,
      pipeLength: pipelineMultiPipeEdit.pipe1.pipeLength,
    });
    await pipelineSetupPage.confirmDeletePipeInDialog();
    // Delete is immediate; Save can remain disabled. Wait for reindexing to reflect 2 pipes.
    await expect(pipelineSetupPage.numberOfPipeSizes).toHaveValue(
      String(pipelineMultiPipeEdit.numberOfPipeSizes - 1),
      { timeout: 15000 }
    );
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectPipelineSection();

    await assertPipelinePipeByIndexRetainedValues(
      pipelineSetupPage,
      0,
      pipelineMultiPipeEdit.pipe2,
      pipefitterPipe2Edit
    );
    await assertPipelinePipeByIndexRetainedValues(
      pipelineSetupPage,
      1,
      pipelineMultiPipeEdit.pipe3,
      pipefitterPipe3Edit
    );
  });

  test('Verify Fabrication setup edit - update all subtype values with Pipefitter configuration', async ({ page }) => {
    test.setTimeout(130 * 1000);
    const poManager = new POManager(page);
    const { project, fabrication, fabricationEdit, pipefitterEdit } = fabricationSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectFabricationSectionEnsured();

    const fabricationSetupPage = poManager.getFabricationSetupPage();

    await fabricationSetupPage.fillSubtype(
      'Buckle Arrestor',
      fabricationEdit.buckleArrestor,
      pipefitterEdit,
      fabrication.buckleArrestor.pipe1.manufacturer
    );
    await fabricationSetupPage.fillSubtype(
      'Pipe in Pipe',
      fabricationEdit.pipeInPipe,
      pipefitterEdit,
      fabrication.pipeInPipe.pipe1.manufacturer
    );
    await fabricationSetupPage.fillSubtype(
      'Bulk Head',
      fabricationEdit.bulkHead,
      pipefitterEdit,
      fabrication.bulkHead.pipe1.manufacturer
    );

    await fabricationSetupPage.clickSaveAndWait();
    await expect(page.getByText('Setup Saved Successfully', { exact: false }).first()).toBeVisible();

    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectFabricationSectionEnsured();

    await assertFabricationRetainedValues(
      fabricationSetupPage,
      fabricationEdit,
      pipefitterEdit,
      fabrication
    );
  });

  test('Verify Fabrication setup - multiple pipes with multiple WPS for all subtypes', async ({ page }) => {
    test.setTimeout(160 * 1000);
    const poManager = new POManager(page);
    const { project, fabricationMultiPipe, pipefitterMultiPipe } = fabricationSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectFabricationSectionEnsured();

    const fabricationSetupPage = poManager.getFabricationSetupPage();
    await fabricationSetupPage.fillSubtype('Buckle Arrestor', fabricationMultiPipe.buckleArrestor, pipefitterMultiPipe);
    await fabricationSetupPage.fillSubtype('Pipe in Pipe', fabricationMultiPipe.pipeInPipe, pipefitterMultiPipe);
    await fabricationSetupPage.fillSubtype('Bulk Head', fabricationMultiPipe.bulkHead, pipefitterMultiPipe);

    await fabricationSetupPage.clickSaveAndWait();
    await expect(page.getByText('Setup Saved Successfully', { exact: false }).first()).toBeVisible();

    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectFabricationSectionEnsured();
    await assertFabricationRetainedValues(fabricationSetupPage, fabricationMultiPipe, pipefitterMultiPipe);
  });

  test('Verify Fabrication setup edit - update multiple pipes values for all subtypes', async ({ page }) => {
    test.setTimeout(300 * 1000);
    const poManager = new POManager(page);
    const {
      project,
      fabricationEdit,
      fabricationMultiPipe,
      fabricationMultiPipeEdit,
      pipefitterMultiPipeEdit,
    } = fabricationSetupTestData;
    const previousFabricationMultiPipe = {
      buckleArrestor: {
        pipe1: { manufacturer: fabricationEdit.buckleArrestor.pipe1.manufacturer },
        pipe2: { manufacturer: fabricationMultiPipe.buckleArrestor.pipe2.manufacturer },
      },
      pipeInPipe: {
        pipe1: { manufacturer: fabricationEdit.pipeInPipe.pipe1.manufacturer },
        pipe2: { manufacturer: fabricationMultiPipe.pipeInPipe.pipe2.manufacturer },
        pipe3: { manufacturer: fabricationMultiPipe.pipeInPipe.pipe3.manufacturer },
      },
      bulkHead: {
        pipe1: { manufacturer: fabricationEdit.bulkHead.pipe1.manufacturer },
        pipe2: { manufacturer: fabricationMultiPipe.bulkHead.pipe2.manufacturer },
      },
    };

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    await projectDetailsPage.selectFabricationSectionEnsured();

    const fabricationSetupPage = poManager.getFabricationSetupPage();
    await fabricationSetupPage.fillSubtype(
      'Buckle Arrestor',
      fabricationMultiPipeEdit.buckleArrestor,
      pipefitterMultiPipeEdit,
      {
        pipe1: previousFabricationMultiPipe.buckleArrestor.pipe1.manufacturer,
        pipe2: previousFabricationMultiPipe.buckleArrestor.pipe2.manufacturer,
      }
    );
    await fabricationSetupPage.fillSubtype(
      'Pipe in Pipe',
      fabricationMultiPipeEdit.pipeInPipe,
      pipefitterMultiPipeEdit,
      {
        pipe1: previousFabricationMultiPipe.pipeInPipe.pipe1.manufacturer,
        pipe2: previousFabricationMultiPipe.pipeInPipe.pipe2.manufacturer,
        pipe3: previousFabricationMultiPipe.pipeInPipe.pipe3.manufacturer,
      }
    );
    await fabricationSetupPage.fillSubtype(
      'Bulk Head',
      fabricationMultiPipeEdit.bulkHead,
      pipefitterMultiPipeEdit,
      {
        pipe1: previousFabricationMultiPipe.bulkHead.pipe1.manufacturer,
        pipe2: previousFabricationMultiPipe.bulkHead.pipe2.manufacturer,
      }
    );

    await fabricationSetupPage.clickSaveAndWait();
    await expect(page.getByText('Setup Saved Successfully', { exact: false }).first()).toBeVisible();

    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectFabricationSectionEnsured();
    await assertFabricationRetainedValues(
      fabricationSetupPage,
      fabricationMultiPipeEdit,
      pipefitterMultiPipeEdit,
      previousFabricationMultiPipe
    );
  });

  test('Verify Fabrication validation messages for mandatory empty fields by subtype', async ({ page }) => {
    test.setTimeout(120 * 1000);

    const poManager = new POManager(page);
    const { project, fabricationMultiPipeEdit } = fabricationSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const fabricationSetupPage = poManager.getFabricationSetupPage();
    await projectDetailsPage.selectFabricationSectionEnsured();

    await fabricationSetupPage.clearMandatoryFieldsForValidation('Buckle Arrestor', fabricationMultiPipeEdit.buckleArrestor.pipe1.manufacturer);
    await fabricationSetupPage.clickSaveForValidation();
    await assertFabricationValidationErrorsForSubtype(fabricationSetupPage, 'Buckle Arrestor', [
      'Pipe size is required and cannot be zero',
      'Wall thickness is required and cannot be zero',
      'Number of pipes is required and cannot be zero',
      'Pipe length is required and cannot be zero',
      'Manufacturer is required',
      'Output assembly length is required and cannot be zero',
    ]);

    await fabricationSetupPage.clearMandatoryFieldsForValidation('Pipe in Pipe', fabricationMultiPipeEdit.pipeInPipe.pipe1.manufacturer);
    await fabricationSetupPage.clickSaveForValidation();
    await assertFabricationValidationErrorsForSubtype(fabricationSetupPage, 'Pipe in Pipe', [
      'Pipe size is required and cannot be zero',
      'Wall thickness is required and cannot be zero',
      'Number of pipes is required and cannot be zero',
      'Pipe length is required and cannot be zero',
      'Manufacturer is required',
    ]);

    await fabricationSetupPage.clearMandatoryFieldsForValidation('Bulk Head', fabricationMultiPipeEdit.bulkHead.pipe1.manufacturer);
    await fabricationSetupPage.clickSaveForValidation();
    await assertFabricationValidationErrorsForSubtype(fabricationSetupPage, 'Bulk Head', [
      'Pipe size is required and cannot be zero',
      'Wall thickness is required and cannot be zero',
      'Number of pipes is required and cannot be zero',
      'Pipe length is required and cannot be zero',
      'Manufacturer is required',
      'Output assembly length is required and cannot be zero',
    ]);
  });

  test('Verify Buckle Arrestor validation - empty Number of Buckle Arrestors, Assembly Name Prefix and Number of Job Numbers should prevent save', async ({ page }) => {
    test.setTimeout(120 * 1000);

    const poManager = new POManager(page);
    const { project } = fabricationSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const fabricationSetupPage = poManager.getFabricationSetupPage();
    await projectDetailsPage.selectFabricationSectionEnsured();

    await fabricationSetupPage.clearBuckleArrestorKnownMissingValidationFields();
    await fabricationSetupPage.clickSaveForValidation();

    // Expected behavior: validation errors should appear and save should not succeed.
    const validationBox = fabricationSetupPage
      .sectionRoot('Buckle Arrestor')
      .locator('div')
      .filter({ hasText: 'Validation Errors:' })
      .first();
    await expect(validationBox).toBeVisible({ timeout: 3000 });
    await expect(fabricationSetupPage.saveSuccessToast.first()).not.toBeVisible({ timeout: 3000 });
  });

  test('Verify Pipe in Pipe validation - empty Number of Forges, Expected Output Assembly Length, Assembly Name Prefix and Number of Job Numbers should prevent save', async ({ page }) => {
    test.setTimeout(120 * 1000);

    const poManager = new POManager(page);
    const { project } = fabricationSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const fabricationSetupPage = poManager.getFabricationSetupPage();
    await projectDetailsPage.selectFabricationSectionEnsured();

    await fabricationSetupPage.clearPipeInPipeKnownMissingValidationFields();
    await fabricationSetupPage.clickSaveForValidation();

    // Expected behavior: validation errors should appear and save should not succeed.
    const validationBox = fabricationSetupPage
      .sectionRoot('Pipe in Pipe')
      .locator('div')
      .filter({ hasText: 'Validation Errors:' })
      .first();
    await expect(validationBox).toBeVisible({ timeout: 3000 });
    await expect(fabricationSetupPage.saveSuccessToast.first()).not.toBeVisible({ timeout: 3000 });
  });

  test('Verify Bulk Head validation - empty Assembly Name Prefix and Number of Job Numbers should prevent save', async ({ page }) => {
    test.setTimeout(120 * 1000);

    const poManager = new POManager(page);
    const { project } = fabricationSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const fabricationSetupPage = poManager.getFabricationSetupPage();
    await projectDetailsPage.selectFabricationSectionEnsured();

    await fabricationSetupPage.clearBulkHeadKnownMissingValidationFields();
    await fabricationSetupPage.clickSaveForValidation();

    // Expected behavior: validation errors should appear and save should not succeed.
    const validationBox = fabricationSetupPage
      .sectionRoot('Bulk Head')
      .locator('div')
      .filter({ hasText: 'Validation Errors:' })
      .first();
    await expect(validationBox).toBeVisible({ timeout: 3000 });
    await expect(fabricationSetupPage.saveSuccessToast.first()).not.toBeVisible({ timeout: 3000 });
  });

  test('Verify Others setup edit - update existing values with Pipefitter configuration', async ({ page }) => {
    test.setTimeout(90 * 1000);

    const poManager = new POManager(page);
    const { project, others, othersEdit, pipefitterEdit } = othersSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const othersSetupPage = poManager.getOthersSetupPage();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await othersSetupPage.fillNumberOfPipeSizes(othersEdit.numberOfPipeSizes);
    await othersSetupPage.fillPipeDetailsByIndex(
      0,
      othersEdit.pipe1,
      others.pipe1.manufacturer
    );
    await othersSetupPage.fillPipeFitterConfigurationByIndex(0, pipefitterEdit);
    await othersSetupPage.clickSaveAndWait();

    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await assertOthersPipeByIndexRetainedValues(
      othersSetupPage,
      0,
      othersEdit.pipe1,
      pipefitterEdit,
      others.pipe1.manufacturer
    );
  });

  test('Verify Others setup - add Pipe 2 and Pipe 3 with multiple WPS numbers', async ({ page }) => {
    test.setTimeout(120 * 1000);

    const poManager = new POManager(page);
    const { project, othersMultiPipe, pipefitterMultiPipe } = othersSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const othersSetupPage = poManager.getOthersSetupPage();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await othersSetupPage.fillNumberOfPipeSizes(othersMultiPipe.numberOfPipeSizes);
    await othersSetupPage.fillPipeDetailsByIndex(1, othersMultiPipe.pipe2);
    await othersSetupPage.fillPipeFitterConfigurationByIndex(1, pipefitterMultiPipe);
    await othersSetupPage.fillPipeDetailsByIndex(2, othersMultiPipe.pipe3);
    await othersSetupPage.fillPipeFitterConfigurationByIndex(2, pipefitterMultiPipe);
    await othersSetupPage.clickSaveAndWait();

    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await assertOthersPipeByIndexRetainedValues(
      othersSetupPage,
      1,
      othersMultiPipe.pipe2,
      pipefitterMultiPipe
    );
    await assertOthersPipeByIndexRetainedValues(
      othersSetupPage,
      2,
      othersMultiPipe.pipe3,
      pipefitterMultiPipe
    );
  });

  test('Verify Others setup edit - update multiple pipes values with multiple WPS numbers', async ({ page }) => {
    test.setTimeout(140 * 1000);

    const poManager = new POManager(page);
    const {
      project,
      othersEdit,
      othersMultiPipe,
      othersMultiPipeEdit,
      pipefitterMultiPipeEdit,
    } = othersSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const othersSetupPage = poManager.getOthersSetupPage();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await othersSetupPage.fillNumberOfPipeSizes(othersMultiPipeEdit.numberOfPipeSizes);
    await othersSetupPage.fillPipeDetailsByIndex(
      0,
      othersMultiPipeEdit.pipe1,
      othersEdit.pipe1.manufacturer
    );
    await othersSetupPage.fillPipeFitterConfigurationByIndex(0, pipefitterMultiPipeEdit);
    await othersSetupPage.fillPipeDetailsByIndex(
      1,
      othersMultiPipeEdit.pipe2,
      othersMultiPipe.pipe2.manufacturer
    );
    await othersSetupPage.fillPipeFitterConfigurationByIndex(1, pipefitterMultiPipeEdit);
    await othersSetupPage.fillPipeDetailsByIndex(
      2,
      othersMultiPipeEdit.pipe3,
      othersMultiPipe.pipe3.manufacturer
    );
    await othersSetupPage.fillPipeFitterConfigurationByIndex(2, pipefitterMultiPipeEdit);
    await othersSetupPage.clickSaveAndWait();

    await page.waitForLoadState('networkidle').catch(() => {});
    await projectDetailsPage.goToOverviewTab();
    await projectDetailsPage.goToSetupTab();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await assertOthersPipeByIndexRetainedValues(
      othersSetupPage,
      0,
      othersMultiPipeEdit.pipe1,
      pipefitterMultiPipeEdit,
      othersEdit.pipe1.manufacturer
    );
    await assertOthersPipeByIndexRetainedValues(
      othersSetupPage,
      1,
      othersMultiPipeEdit.pipe2,
      pipefitterMultiPipeEdit,
      othersMultiPipe.pipe2.manufacturer
    );
    await assertOthersPipeByIndexRetainedValues(
      othersSetupPage,
      2,
      othersMultiPipeEdit.pipe3,
      pipefitterMultiPipeEdit,
      othersMultiPipe.pipe3.manufacturer
    );
  });

  test('Verify Others setup validation messages for mandatory empty fields', async ({ page }) => {
    test.setTimeout(90 * 1000);

    const poManager = new POManager(page);
    const { project, othersMultiPipeEdit } = othersSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const othersSetupPage = poManager.getOthersSetupPage();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await othersSetupPage.clearMandatoryFieldsForValidation(othersMultiPipeEdit.pipe1.manufacturer);
    await othersSetupPage.clickSaveForValidation();
    await assertOthersMandatoryValidationErrors(othersSetupPage);
  });

  test('Verify Others validation - empty Number of Job Numbers should show validation and prevent save', async ({ page }) => {
    test.setTimeout(90 * 1000);

    const poManager = new POManager(page);
    const { project } = othersSetupTestData;

    const projectDetailsPage = await openProjectSetup(poManager, project.expectedTitle);
    const othersSetupPage = poManager.getOthersSetupPage();
    await projectDetailsPage.selectOthersSectionEnsured(othersSetupPage.othersRoot);

    await othersSetupPage.clearPipe1NumberOfJobsFieldEnsuredEmpty();
    await othersSetupPage.clickSaveForValidation();

    // Expected behavior: validation errors should appear and save should not succeed.
    const validationBox = othersSetupPage.othersRoot.locator('div').filter({ hasText: 'Validation Errors:' }).first();
    await expect(validationBox).toBeVisible({ timeout: 3000 });
    await expect(othersSetupPage.saveSuccessToast.first()).not.toBeVisible({ timeout: 3000 });
  });
});
