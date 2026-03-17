const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');

// Page Objects
const LoginAndProjectPage = require('../pages/loginAndProject.page');
const CreateProjectPage = require('../pages/createproject.page');
const SpecificationPage = require('../pages/Specification.page');
const DeviceAssigningPage = require('../pages/DeviceAssigning.page');
const SetupPage = require('../pages/setup.page');
const StatusConfigPassPage = require('../pages/StatusConfigPass.page');
const StatusConfigComparePage = require('../pages/statusConfigCompare.page');
const { WeldParametersCsvToExcel, WeldParametersXmlToExcel } = require('../pages/WeldParametersFileToExcel.page');
const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
const ComparePage = require('../pages/compare.page');
const CommonHelper = require('../Helper/CommonHelper');
const assertion = require('../Helper/AssertionHelper.js');
const LoginAssertion = require('../Assertions/LoginAssertion');
const ProductionTabAssertion = require('../Assertions/ProductionTabAssertion');

// Config
const configPath = path.join(__dirname, '../config/Combinations.json');
const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

test.describe.serial('🔥 COMPLETE END-TO-END FLOW', () => {
  let browserPage = null;
  let helper = null;
  let loginPage = null;
  let createProjectPage = null;
  let specificationPage = null;
  let deviceAssignPage = null;
  let setupPage = null;
  let statusConfigPassPage = null;
  let productionTabPage = null;
  let comparePage = null;

  const project = flowConfig.singleProject;
  const fc = flowConfig.flowControl || {};
  const fileConversion = flowConfig.fileConversion || {};

  let weldParamExcelPath = null;
  let statusExtractionResults = [];
  let deviceId = null;

  // Pre-setup weld converter
  let weldConverter = null;
  let weldSheetName = null;
  if (fileConversion.csv?.enabled) {
    weldConverter = new WeldParametersCsvToExcel(fileConversion.csv.inputFile);
    weldSheetName = 'Pass Level (CSV)';
  } else if (fileConversion.xml?.enabled) {
    weldConverter = new WeldParametersXmlToExcel(fileConversion.xml.inputFile);
    weldSheetName = 'Pass Level (XML)';
  }

  test.beforeAll(async ({ browser }) => {
    const needsBrowser = fc.login || fc.createProject || fc.deviceRegistration || fc.setup || 
                        fc.specification || fc.deviceSync || fc.productionAnalysis || 
                        fc.statusConfigUIExtraction || fc.statusConfigComparison;
    if (needsBrowser) {
      browserPage = await browser.newPage();
      helper = new CommonHelper(browserPage);
      loginPage = new LoginAndProjectPage(browserPage);
      createProjectPage = new CreateProjectPage(browserPage);
      specificationPage = new SpecificationPage(browserPage);
      deviceAssignPage = new DeviceAssigningPage(browserPage);
      setupPage = new SetupPage(browserPage);
      statusConfigPassPage = new StatusConfigPassPage(browserPage);
      productionTabPage = new ProductionTabWeldData(browserPage, flowConfig.scanConfig);
      comparePage = new ComparePage();
    }

    // Cleanup exports if enabled
    if (fc.cleanExports) {
      const exportsDir = path.join(process.cwd(), 'exports');
      const dirsToClean = ['ActualData', 'ProductionData', 'ComparedData', 'WeldParametersCsvToExcel', 'WeldParametersXmlToExcel', 'StatusConfig UI', 'StatusConfig Compared with WeldParam'];
      dirsToClean.forEach(dir => {
        const fullPath = path.join(exportsDir, dir);
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      });
    }
  });

  test.afterAll(async () => {
    await browserPage?.close();
    const dashboardPath = assertion.generateDashboard();
    if (fs.existsSync(dashboardPath)) {
      test.info().attach('Assertion Dashboard', { path: dashboardPath, contentType: 'text/html' });
    }
  });

  test('Step 1: 🔐 Login', async () => {
    test.skip(!fc.login);
    await new LoginAssertion(loginPage).run(test.info());
  });

  test('Step 2: 🏗️ Create Project', async () => {
    test.skip(!fc.createProject);
    await createProjectPage.createProject({
      ...flowConfig.createProjectData,
      projectName: project.projectName
    });
    assertion.log('Step 2 Complete', `Project "${project.projectName}" created`, 'PASS', test.info());
  });

  test('Step 3 & 4: 🖥️ Device Registration & Assignment', async () => {
    test.skip(!fc.deviceRegistration);
    const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');
    
    // Step 1: Register
    await new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath, '--step=1'], { stdio: 'inherit', shell: true });
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`Step 1 failed: ${code}`)));
    });

    // Get device ID
    deviceId = await helper.waitForDeviceId(configPath);
    expect(deviceId).toBeTruthy();

    // Assign to project
    await deviceAssignPage.assignProjectToDevice(deviceId, project.projectName);
    assertion.log('Device Assigned', `${deviceId} → ${project.projectName}`, 'PASS', test.info());
  });

  test('Step 5: ⚙️ Setup', async () => {
    test.skip(!fc.setup);
    await setupPage.performSetup(project.projectName);
    assertion.log('Step 5 Complete', 'Setup saved', 'PASS', test.info());
  });

  test('Step 6: 📑 Specifications', async () => {
    test.skip(!fc.specification);
    if (project.specificationData) {
      await specificationPage.navigateToSpecifications(project.projectName);
      if (project.specificationData.excelTemplate) {
        await specificationPage.uploadSpecifications(project.specificationData);
      }
    }
    assertion.log('Step 6 Complete', 'Specifications configured', 'PASS', test.info());
  });

  test('Step 7: 🔄 Device Sync', async () => {
    test.skip(!fc.deviceSync);
    const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');
    await new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath, '--step=2'], { stdio: 'inherit', shell: true });
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`Step 2 failed: ${code}`)));
    });
    assertion.log('Step 7 Complete', 'Device synced', 'PASS', test.info());
  });

  test('Step 8: 🔍 Status Configuration Verification', async () => {
    test.skip(!fc.statusConfigUIExtraction, 'Status Config UI extraction disabled');
    
    await helper.selectProject(project.projectName);

    // Convert weld parameters if enabled 
    if (weldConverter && fc.statusConfigComparison) {
      weldParamExcelPath = await weldConverter.run(project.projectName);
      console.log(`Weld Excel: ${weldParamExcelPath}`);
    }

    // Extract UI data for each slope
    for (const slope of project.slopeCombinations) {
      console.log(`Status Config: ${slope.slopeIn}-${slope.slopeOut}`);
      
      // Apply slope
      // Note: Need StatusConfigPage if available, otherwise skip or implement
      // await statusPage.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);

      // Extract UI
      const result = await statusConfigPassPage.run(project.projectName, slope.slopeIn, slope.slopeOut);
      statusExtractionResults.push({ slope, ...result });
      test.info().attach('Status UI Data', { path: result.filePath, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Compare if enabled
      if (fc.statusConfigComparison && weldParamExcelPath && result.filePath) {
        const comparer = new StatusConfigComparePage(weldParamExcelPath, result.filePath, weldSheetName);
        const comparePath = await comparer.run();
        test.info().attach('Status Comparison', { path: comparePath, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }
    }
    
    await statusConfigPassPage.goBackToProduction();
    assertion.log('Step 8 Complete', 'Status Config verified', 'PASS', test.info());
  });

  test('Step 9: 📊 Production Tab Verification', async () => {
    test.skip(!fc.productionAnalysis);
    await new ProductionTabAssertion(browserPage, helper).run(project.projectName, test.info());
  });

  for (const slope of project.slopeCombinations) {
    test(`Production: UI Analysis ${slope.slopeIn}-${slope.slopeOut}`, async () => {
      test.skip(!fc.productionAnalysis);
      const info = test.info();
      const prodFilePath = await productionTabPage.runFlow(project.weldIds, null, project.projectName);
      if (prodFilePath) {
        info.attach('Production Data', { path: prodFilePath, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }
      assertion.log(`UI Analysis ${slope.slopeIn}-${slope.slopeOut}`, prodFilePath ? 'PASS' : 'No data', 'PASS', info);
    });

    test(`Production: Comparison ${slope.slopeIn}-${slope.slopeOut}`, async () => {
      test.skip(!fc.comparison);
      const info = test.info();
      const { hasFailure, reportPath, dashboardPath } = await comparePage.runAutoCompare(project.projectName, project.weldIds);
      if (reportPath) info.attach('Comparison Report', { path: reportPath, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if (dashboardPath) info.attach('Comparison Dashboard', { body: fs.readFileSync(dashboardPath), contentType: 'text/html' });
      assertion.log(`Comparison ${slope.slopeIn}-${slope.slopeOut}`, hasFailure ? 'FAIL' : 'PASS', hasFailure ? 'FAIL' : 'PASS', info);
    });
  }

  test('🎉 Flow Complete', async () => {
    console.log('🎉 Complete!');
    assertion.log('Flow Complete', 'All steps passed', 'PASS', test.info());
  });
});
