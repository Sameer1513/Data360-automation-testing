
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { execSync, spawn } = require('child_process');

// Page Objects
const LoginAndProjectPage = require('../pages/loginAndProject.page');
const CreateProjectPage = require('../pages/createproject.page');
const SpecificationPage = require('../pages/Specification.page');
const DeviceAssigningPage = require('../pages/DeviceAssigning.page');
const SetupPage = require('../pages/setup.page');
const StatusConfigPage = require('../pages/statusConfig.page');
const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
const ComparePage = require('../pages/compare.page');
const CommonHelper = require('../Helper/CommonHelper');

// Config
const configPath = path.join(__dirname, '../config/Combinations.json');
const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// By wrapping the entire flow in `test.describe.serial`, we ensure each `test()`
// block runs sequentially. This allows us to break the flow into logical,
// independently reported steps while preserving state (like being logged in)
// from one step to the next.
test.describe.serial('🔥 COMPLETE END-TO-END FLOW', () => {

    // --- SHARED STATE ---
    // These variables are declared here and will be shared across all tests in this file.
    let page;
    let helper, login, createPage, specPage, deviceAssign, setupPage, status, analysis, compare;

    const project = flowConfig.singleProject;
    const fc = flowConfig.flowControl || {};
    const targetWeldId = new CommonHelper(null).resolveTargetWelds(project.weldIds);

    let derivedSetup = null;
    let deviceId = null;

    // This block runs once before any tests in this file.
    test.beforeAll(async () => {
        if (fc.cleanExports) {
            const exportsDir = path.join(process.cwd(), 'exports');
            const dirsToClean = ['ActualData', 'ProductionData', 'ComparedData'];

            console.log("🧹 Cleaning up old export files...");
            for (const dir of dirsToClean) {
                const fullPath = path.join(exportsDir, dir);
                if (fs.existsSync(fullPath)) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    console.log(`   🗑️ Deleted: ${dir}`);
                }
            }
        }

        if (fc.checkSourceFile) {
            const sourceFilePath = path.join(process.cwd(), 'Input', project.sourceFile);
            expect(fs.existsSync(sourceFilePath), `❌ Source file '${project.sourceFile}' not found in Input directory.`).toBe(true);
        }

        if (fc.runExtraction) {
            const extractor = new BoltDBTxtFileTOExcel();
            console.log("⚡ Running extractor once to derive setup data (no Excel generated)...");
            const { setupData } = await extractor.run(0, 0, project.projectName, project.sourceFile, false);
            derivedSetup = setupData;
        }
    });

    // This block runs before each test. We use it to initialize the page
    // and page objects a single time, preserving the state between steps.
    test.beforeEach(async ({ browser }) => {
        if (page) return;
        page = await browser.newPage();
        helper = new CommonHelper(page);
        login = new LoginAndProjectPage(page);
        createPage = new CreateProjectPage(page);
        specPage = new SpecificationPage(page);
        deviceAssign = new DeviceAssigningPage(page);
        setupPage = new SetupPage(page);
        status = new StatusConfigPage(page);
        analysis = new ProductionTabWeldData(page, flowConfig.scanConfig);
        compare = new ComparePage();
    });

    test.afterAll(async () => {
        await page?.close();
    });

    // --- INDIVIDUAL TEST BLOCKS ---
    // Each `test()` block below represents a distinct step in the flow.
    // It will have its own entry and pass/fail status in the final report.

    test('Step 1: 🔐 Login', async () => {
        test.skip(!fc.login, "Login is disabled in flowControl.");
        await login.loginAndOpenProject();
    });

    test('Step 2: 🏗️ Create Project', async () => {
        test.skip(!fc.createProject, "Create Project is disabled in flowControl.");
        await createPage.createProject({
            ...flowConfig.createProjectData,
            projectName: project.projectName
        });
    });

    test('Step 3 & 4: 🖥️ Device Registration & Assignment', async () => {
        const isDeviceRegConfigured = flowConfig.deviceRegistration && flowConfig.deviceRegistration.enabled !== false;
        const isMultiBrowser = flowConfig.mode === 'multiBrowser';
        const shouldRegisterDevice = isDeviceRegConfigured && !isMultiBrowser && fc.deviceRegistration;
        test.skip(!shouldRegisterDevice, "Device Registration is disabled in flowControl or config.");

        const resetConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        delete resetConfig.capturedDeviceId;
        fs.writeFileSync(configPath, JSON.stringify(resetConfig, null, 2));

        const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');

        await test.step('Run Device Register (Step 1)', async () => {
            await new Promise((resolve, reject) => {
                const child = spawn('node', [scriptPath, '--step=1'], { stdio: 'inherit', shell: true });
                child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Step 1 failed with exit code ${code}`)));
                child.on('error', (err) => reject(err));
            });
        });

        deviceId = await test.step('Wait for Device ID', async () => {
            const id = await helper.waitForDeviceId(configPath);
            expect(id, 'Device ID should be generated').toBeTruthy();
            return id;
        });

        await test.step('Assign Device to Project', async () => {
            await deviceAssign.assignProjectToDevice(deviceId, project.projectName);
        });
    });

    test('Step 5: ⚙️ Perform Project Setup', async () => {
        test.skip(!fc.setup, "Setup is disabled in flowControl.");
        if (derivedSetup) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (cfg.singleProject?.setupConfig?.pipes?.[0]) {
                const p = cfg.singleProject.setupConfig.pipes[0];
                if (derivedSetup.pipeSize) p.pipeSize = String(derivedSetup.pipeSize);
                if (derivedSetup.wallThickness) p.wallThickness = String(derivedSetup.wallThickness);
                if (derivedSetup.wps) p.wps = [String(derivedSetup.wps)];
                fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
            }
        }
        await setupPage.performSetup(project.projectName);
    });

    test('Step 6: 📑 Configure Specifications', async () => {
        test.skip(!fc.specification, "Specification is disabled in flowControl.");
        if (!project.specificationData) {
            console.log("⚠️ No specificationData found in config for this project. Skipping.");
            return;
        }
        await specPage.navigateToSpecifications(project.projectName);
        if (project.specificationData.excelTemplate) {
            await specPage.uploadSpecifications(project.specificationData);
        }
        if (project.specificationData.newSpecification) {
            await specPage.addNewSpecificationManual(project.specificationData.newSpecification);
        }
    });

    test('Step 7: 🖥️ Run Device Sync', async () => {
        const isDeviceRegConfigured = flowConfig.deviceRegistration && flowConfig.deviceRegistration.enabled !== false;
        const isMultiBrowser = flowConfig.mode === 'multiBrowser';
        test.skip(!(isDeviceRegConfigured && !isMultiBrowser && fc.deviceSync), "Device Sync is disabled.");

        const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');
        await new Promise((resolve, reject) => {
            const child = spawn('node', [scriptPath, '--step=2'], { stdio: 'inherit', shell: true });
            child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Step 2 failed with exit code ${code}`)));
            child.on('error', (err) => reject(err));
        });
    });

    test('Step 8 & 9: 📊 Open Project and Verify Production Tab', async () => {
        test.skip(!fc.productionAnalysis, "Production Analysis is disabled in flowControl.");
        await helper.selectProject(project.projectName);

        const productionTab = page.getByRole('tab', { name: /Production/i });
        await productionTab.click();
        await expect(productionTab).toHaveAttribute('aria-selected', 'true');

        const weldRows = page.locator('table tbody tr');
        await weldRows.first().waitFor({ state: 'visible' });
        const count = await weldRows.count();
        expect(count, 'Production table should have at least one weld row').toBeGreaterThan(0);
    });

    // --- DYNAMIC TESTS FOR EACH SLOPE COMBINATION ---
    // This loop generates a separate, top-level test for each slope combination,
    // giving you a clear pass/fail status for each one in the report.
    for (const slope of project.slopeCombinations) {
        test(`Analysis & Comparison for Slope (In: ${slope.slopeIn}, Out: ${slope.slopeOut})`, async () => {
            test.skip(!fc.productionAnalysis, "Production Analysis is disabled in flowControl.");

            await status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);

            const extractor = new BoltDBTxtFileTOExcel();
            
            const [prodFilePath, actualResult] = await Promise.all([
                analysis.runFlow(targetWeldId, null, project.projectName),
                extractor.run(slope.slopeIn, slope.slopeOut, project.projectName, project.sourceFile)
            ]);

            if (fc.comparison) {
                const { hasFailure, reportPath } = await compare.runAutoCompare(
                    project.projectName,
                    targetWeldId
                );

                if (prodFilePath) {
                    await test.info().attach(`Production Data (${slope.slopeIn}-${slope.slopeOut})`, {
                        path: prodFilePath,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                }

                if (actualResult?.outputPath) {
                    await test.info().attach(`Actual Data (${slope.slopeIn}-${slope.slopeOut})`, {
                        path: actualResult.outputPath,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                }

                if (reportPath) {
                    await test.info().attach(`Comparison Report (${slope.slopeIn}-${slope.slopeOut})`, {
                        path: reportPath,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                }

                if (hasFailure) console.log("⚠️ Comparison found differences (Assertion disabled)");
                expect.soft(hasFailure, `Comparison for slope ${slope.slopeIn}-${slope.slopeOut} found differences.`).toBe(false);
            }
        });
    }

    test('🎉 Flow Complete', async () => {
        console.log("🎉 END-TO-END FLOW COMPLETED");
        expect(true).toBe(true);
    });
});
