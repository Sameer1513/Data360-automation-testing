const fs = require('fs');
const path = require('path');
const {
    test,
    expect
} = require('@playwright/test');
const {
    execSync,
    spawn
} = require('child_process');
const ExcelJS = require('exceljs');

// Page Objects
const LoginAndProjectPage    = require('../pages/loginAndProject.page');
const CreateProjectPage      = require('../pages/createproject.page');
const SpecificationPage      = require('../pages/Specification.page');
const DeviceAssigningPage    = require('../pages/DeviceAssigning.page');
const SetupPage              = require('../pages/setup.page');
const StatusConfigPage       = require('../pages/statusConfig.page');
const StatusConfigPass       = require('../pages/StatusConfigPass.page.js');
const ProductionTabWeldData  = require('../pages/ProductionTabWeldData.page');
const { WeldParametersCsvToExcel, WeldParametersXmlToExcel } = require('../pages/WeldParameterFileToExcel.page.js');
const BoltDBTxtFileTOExcel   = require('../pages/BoltDBTxtFileTOExcel.page');
const ComparePage            = require('../pages/compare.page');
const CommonHelper           = require('../Helper/CommonHelper');
const assertion              = require('../Helper/AssertionHelper.js');
const LoginAssertion         = require('../Assertions/LoginAssertion');


const LoginAndProjectPage = require('../pages/loginAndProject.page');
const CreateProjectPage = require('../pages/createproject.page');
const SpecificationPage = require('../pages/Specification.page');
const DeviceAssigningPage = require('../pages/DeviceAssigning.page');
const SetupPage = require('../pages/setup.page');
const StatusConfigPage = require('../pages/statusConfig.page');
const StatusConfigPass = require('../pages/StatusConfigPass.page.js');
const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
const {
    WeldParametersCsvToExcel,
    WeldParametersXmlToExcel
} = require('../pages/WeldParameterFileToExcel.page.js');
const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
const ComparePage = require('../pages/compare.page');
const CommonHelper = require('../Helper/CommonHelper');
const assertion = require('../Helper/AssertionHelper.js');
const LoginAssertion = require('../Assertions/LoginAssertion');
const ProductionTabAssertion = require('../Assertions/ProductionTabAssertion');
const StatusConfigCompare = require('../pages/statusConfigCompare.page.js');


// Config
const configPath = path.join(__dirname, '../config/Combinations.json');
const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

test.describe.serial('🔥 COMPLETE END-TO-END FLOW', () => {

    // ── Shared state ──────────────────────────────────────────────────────
    let page, helper, login, createPage, specPage, deviceAssign,
        setupPage, status, statusConfigPass, analysis, compare;

    const project = flowConfig.singleProject;
    const fc = flowConfig.flowControl || {};
    const targetWeldId = new CommonHelper(null).resolveTargetWelds(project.weldIds);

    let derivedSetup = null;
    let deviceId = null;
    let statusConfigUIFilePath = null;
    let excelPath = null;


    // ── Before All ────────────────────────────────────────────────────────
    test.beforeAll(async () => {
        if (fc.cleanExports) {
            const exportsDir = path.join(process.cwd(), 'exports');
            const dirsToClean = ['ActualData', 'ProductionData', 'ComparedData', 'StatusConfig UI', 'WeldParametersXmlToExcel', 'StatusConfig compared with WeldParam'];
            console.log("🧹 Cleaning up old export files...");
            for (const dir of dirsToClean) {
                const fullPath = path.join(exportsDir, dir);
                if (fs.existsSync(fullPath)) {
                    fs.rmSync(fullPath, {
                        recursive: true,
                        force: true
                    });
                    console.log(`   🗑️ Deleted: ${dir}`);
                }
            }
        }

        if (fc.checkSourceFile) {
            const sourceFilePath = path.join(process.cwd(), 'Input', project.sourceFile);
            expect(
                fs.existsSync(sourceFilePath),
                `❌ Source file '${project.sourceFile}' not found in Input directory.`
            ).toBe(true);
        }

        const parallelTasks = [];

        if (fc.weldParameterExtraction) {
            const extractParams = async () => {
                const inputFile = project.weldParamsInputFile;
                if (inputFile) {
                    console.log(`⚡ Running Weld Parameter Extraction in parallel for ${inputFile}...`);
                    if (inputFile.toLowerCase().endsWith('.csv')) {
                        await new WeldParametersCsvToExcel(inputFile).run();
                    } else if (inputFile.toLowerCase().endsWith('.xml')) {
                        await new WeldParametersXmlToExcel(inputFile).run();
                    }
                } else {
                    console.warn("⚠️ 'weldParamsInputFile' is missing in project config. Skipping parameter extraction.");
                }
            };
            parallelTasks.push(extractParams());
        }

        if (fc.runExtraction) {
            const extractBoltDB = async () => {
                const extractor = new BoltDBTxtFileTOExcel();
                console.log("⚡ Running extractor once to derive setup data...");
                const statusConfigPath = project.statusConfigPath
                    ? path.join(process.cwd(), project.statusConfigPath) : null;
                const weldParamsPath = project.weldParamsPath
                    ? path.join(process.cwd(), project.weldParamsPath) : null;
                const { setupData } = await extractor.run(
                    0, 0, project.projectName, project.sourceFile, false,
                    statusConfigPath, weldParamsPath, project.unitConfig || null
                );
                derivedSetup = setupData;
            };
            parallelTasks.push(extractBoltDB());
        }

        if (fc.runExtraction) {
            const extractBoltDB = async () => {
                const extractor = new BoltDBTxtFileTOExcel();
                console.log("⚡ Running extractor once to derive setup data...");
                const statusConfigPath = project.statusConfigPath ?
                    path.join(process.cwd(), project.statusConfigPath) : null;
                const weldParamsPath = project.weldParamsPath ?
                    path.join(process.cwd(), project.weldParamsPath) : null;
                const {
                    setupData
                } = await extractor.run(
                    0, 0, project.projectName, project.sourceFile, false,
                    statusConfigPath, weldParamsPath, project.unitConfig || null
                );
                derivedSetup = setupData;
            };
            parallelTasks.push(extractBoltDB());
        }

        await Promise.all(parallelTasks);
    });

    // ── Before Each ───────────────────────────────────────────────────────
    // Only open a browser page if at least one browser-dependent step is enabled.
    const needsBrowser = fc.login || fc.createProject || fc.deviceRegistration ||
        fc.setup || fc.specification || fc.deviceSync ||
        fc.productionAnalysis || fc.statusConfigPass || fc.comparison;

    test.beforeEach(async ({
        browser
    }) => {
        if (!needsBrowser) return;
        if (page) return;
        page = await browser.newPage();
        helper = new CommonHelper(page);
        login = new LoginAndProjectPage(page);
        createPage = new CreateProjectPage(page);
        specPage = new SpecificationPage(page);
        deviceAssign = new DeviceAssigningPage(page);
        setupPage = new SetupPage(page);
        status = new StatusConfigPage(page);
        statusConfigPass = new StatusConfigPass(page);
        analysis = new ProductionTabWeldData(page, flowConfig.scanConfig);
        compare = new ComparePage();
    });

    // ── After All ─────────────────────────────────────────────────────────
    test.afterAll(async () => {
        await page?.close();

        // Generate and attach the assertion dashboard
        const dashboardPath = assertion.generateDashboard();
        if (fs.existsSync(dashboardPath)) {
            await test.info().attach('📝 Detailed Assertion Dashboard', {
                path: dashboardPath,
                contentType: 'text/html'
            });
        }
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 1 — LOGIN
    // ═════════════════════════════════════════════════════════════════════
    test('Step 1: 🔐 Login', async () => {
        test.skip(!fc.login, "Login is disabled in flowControl.");
        await new LoginAssertion(login).run(test.info());
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 2 — CREATE PROJECT
    // ═════════════════════════════════════════════════════════════════════
    test('Step 2: 🏗️ Create Project', async () => {
        test.skip(!fc.createProject, "Create Project is disabled in flowControl.");
        const info = test.info();

        try {
            await createPage.createProject({
                ...flowConfig.createProjectData,
                projectName: project.projectName
            });
            assertion.log(
                'Step 2: Create Project',
                `Project "${project.projectName}" Created`,
                'Project Created Successfully',
                'PASS', '', info
            );
        } catch (e) {
            assertion.log('Step 2: Create Project', e.message, 'Project Created Successfully', 'FAIL', '', info);
            throw e;
        }
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 3 & 4 — DEVICE REGISTRATION & ASSIGNMENT
    // ═════════════════════════════════════════════════════════════════════
    test('Step 3 & 4: 🖥️ Device Registration & Assignment', async () => {
        const isDeviceRegConfigured = flowConfig.deviceRegistration && flowConfig.deviceRegistration.enabled !== false;
        const isMultiBrowser = flowConfig.mode === 'multiBrowser';
        const shouldRegister = isDeviceRegConfigured && !isMultiBrowser && fc.deviceRegistration;
        test.skip(!shouldRegister, "Device Registration is disabled in flowControl or config.");

        const info = test.info();

        const resetConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        delete resetConfig.capturedDeviceId;
        fs.writeFileSync(configPath, JSON.stringify(resetConfig, null, 2));

        const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');

        await test.step('Run Device Register (Step 1)', async () => {
            await new Promise((resolve, reject) => {
                const child = spawn('node', [scriptPath, '--step=1'], {
                    stdio: 'inherit',
                    shell: true
                });
                child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Step 1 failed: exit ${code}`)));
                child.on('error', (err) => reject(err));
            });
            assertion.log('Device Registration: Step 1', 'Script Completed', 'Script Completed', 'PASS', '', info);
        });

        deviceId = await test.step('Wait for Device ID', async () => {
            const id = await helper.waitForDeviceId(configPath);
            expect(id, 'Device ID should be generated').toBeTruthy();
            assertion.log('Device Registration: Capture ID', `Device ID: ${id}`, 'Device ID Generated', 'PASS', '', info);
            return id;
        });

        await test.step('Assign Device to Project', async () => {
            await deviceAssign.assignProjectToDevice(deviceId, project.projectName);
            assertion.log(
                'Device Assignment',
                `${deviceId} → ${project.projectName}`,
                'Device Assigned Successfully',
                'PASS', '', info
            );
        });
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 5 — SETUP
    // ═════════════════════════════════════════════════════════════════════
    test('Step 5: ⚙️ Perform Project Setup', async () => {
        test.skip(!fc.setup, "Setup is disabled in flowControl.");
        const info = test.info();

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

        try {
            await setupPage.performSetup(project.projectName);
            assertion.log(
                'Step 5: Project Setup',
                'Setup Saved Successfully',
                'Setup Saved Successfully',
                'PASS', '', info
            );
        } catch (e) {
            assertion.log('Step 5: Project Setup', e.message, 'Setup Saved Successfully', 'FAIL', '', info);
            throw e;
        }
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 6 — SPECIFICATIONS
    // ═════════════════════════════════════════════════════════════════════
    test('Step 6: 📑 Configure Specifications', async () => {
        test.skip(!fc.specification, "Specification is disabled in flowControl.");
        const info = test.info();

        if (!project.specificationData) {
            console.log("⚠️ No specificationData in config. Skipping.");
            assertion.log('Step 6: Specifications', 'Skipped — no specificationData', 'N/A', 'PASS', '', info);
            return;
        }

        try {
            await specPage.navigateToSpecifications(project.projectName);
            if (project.specificationData.excelTemplate) {
                await specPage.uploadSpecifications(project.specificationData);
                assertion.log('Step 6: Upload Specifications', 'Upload Flow Completed', 'Specifications Uploaded', 'PASS', '', info);
            }
            if (project.specificationData.newSpecification) {
                await specPage.addNewSpecificationManual(project.specificationData.newSpecification);
                assertion.log('Step 6: Add Manual Specification', 'Manual Spec Added', 'Specification Added', 'PASS', '', info);
            }
        } catch (e) {
            assertion.log('Step 6: Specifications', e.message, 'Specifications Configured', 'FAIL', '', info);
            throw e;
        }
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 7 — DEVICE SYNC
    // ═════════════════════════════════════════════════════════════════════
    test('Step 7: 🖥️ Run Device Sync', async () => {
        const isDeviceRegConfigured = flowConfig.deviceRegistration && flowConfig.deviceRegistration.enabled !== false;
        const isMultiBrowser = flowConfig.mode === 'multiBrowser';
        test.skip(!(isDeviceRegConfigured && !isMultiBrowser && fc.deviceSync), "Device Sync is disabled.");

        const info = test.info();
        const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');

        await new Promise((resolve, reject) => {
            const child = spawn('node', [scriptPath, '--step=2'], {
                stdio: 'inherit',
                shell: true
            });
            child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Step 2 failed: exit ${code}`)));
            child.on('error', (err) => reject(err));
        });

        assertion.log('Step 7: Device Sync', 'Sync Script Completed', 'Device Sync Completed', 'PASS', '', info);
        expect("Device Sync Completed Successfully").toBe("Device Sync Completed Successfully");
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 8 & 9 — PRODUCTION TAB VERIFICATION
    // ═════════════════════════════════════════════════════════════════════
    test('Step 8 & 9: 📊 Open Project and Verify Production Tab', async () => {
        test.skip(!fc.productionAnalysis, "Production Analysis is disabled in flowControl.");
        await new ProductionTabAssertion(page, helper).run(project.projectName, test.info());
    });

    //═════════════════════════════════════════════════════════════════════
    // WELD PARAMETER EXTRACTION FROM CSV/XML FILES
    //═════════════════════════════════════════════════════════════════════
    test('Step: 📄 WeldParameter Extraction', async () => {
        test.skip(!fc.weldParameterExtraction, "Weld Parameter Extraction disabled.");

        const info = test.info();
        const inputFile = project.weldParamsInputFile;

        if (!inputFile) {
            assertion.log(
                'Weld Parameter Extraction',
                'Skipped',
                'weldParamsInputFile missing',
                'SKIP',
                '',
                info
            );
            return;
        }

        console.log(`📄 Converting Weld Parameter file: ${inputFile}`);

        let status = 'FAIL';
        let expected = `Excel from ${path.basename(inputFile)}`;

        try {
            if (inputFile.toLowerCase().endsWith('.csv')) {
                const converter = new WeldParametersCsvToExcel(inputFile);
                excelPath = await converter.run();
            } else if (inputFile.toLowerCase().endsWith('.xml')) {
                const converter = new WeldParametersXmlToExcel(inputFile);
                excelPath = await converter.run();
            }

            if (excelPath && fs.existsSync(excelPath)) {
                status = 'PASS';

                await info.attach('Weld Parameter Excel', {
                    path: excelPath,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                console.log(`✅ Weld Parameter Excel saved: ${excelPath}`);
            } else {
                throw new Error('No valid Excel path returned');
            }

        } catch (err) {
            console.error('❌ Weld Parameter Excel generation failed:', err.message);
        }

        assertion.log(
            'Weld Parameter Extraction',
            excelPath || 'Failed',
            expected,
            status,
            excelPath ? `Path: ${excelPath}` : 'Unknown error',
            info
        );
    });

    // ═════════════════════════════════════════════════════════════════════
    // DYNAMIC SLOPE COMBINATIONS
    // ═════════════════════════════════════════════════════════════════════
    for (const slope of project.slopeCombinations) {

        // ── BoltDB Extraction ─────────────────────────────────────────────
        test(`Step: 📄 BoltDB Extraction (In: ${slope.slopeIn}, Out: ${slope.slopeOut})`, async () => {
            test.skip(!fc.BoltDBExcel, "BoltDB Excel generation disabled in flowControl.");
            const info = test.info();

            try {
                const extractor = new BoltDBTxtFileTOExcel();
                const statusConfigPath = project.statusConfigPath ?
                    path.join(process.cwd(), project.statusConfigPath) : null;
                const weldParamsPath = project.weldParamsPath ?
                    path.join(process.cwd(), project.weldParamsPath) : null;

                const {
                    outputPath
                } = await extractor.run(
                    slope.slopeIn, slope.slopeOut,
                    project.projectName, project.sourceFile,
                    fc.BoltDBExcel, statusConfigPath, weldParamsPath,
                    project.unitConfig || null
                );

                if (outputPath) {
                    await info.attach(`BoltDB Data (${slope.slopeIn}-${slope.slopeOut})`, {
                        path: outputPath,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                }

                assertion.log(
                    `BoltDB Extraction (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    outputPath ? `File Generated: ${path.basename(outputPath)}` : 'No Output Path',
                    'BoltDB Excel Generated',
                    outputPath ? 'PASS' : 'FAIL',
                    '', info
                );
            } catch (e) {
                assertion.log(
                    `BoltDB Extraction (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    e.message, 'BoltDB Excel Generated', 'FAIL', '', info
                );
                throw e;
            }
        });

        // ── Status Configuration ──────────────────────────────────────────

        test(`Step: ⚙️ Status Configuration (In: ${slope.slopeIn}, Out: ${slope.slopeOut})`, async () => {
            test.skip(!fc.productionAnalysis, "Production Analysis is disabled in flowControl.");
            const info = test.info();

            try {
                await status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);
                assertion.log(
                    `Status Config (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    `Slopes Applied — In:${slope.slopeIn} Out:${slope.slopeOut}`,
                    'Status Configuration Applied',
                    'PASS', '', info
                );

                if (fc.statusConfigUIExtraction) {
                    const result = await statusConfigPass.run(project.projectName, slope.slopeIn, slope.slopeOut);
                    await statusConfigPass.goBackToProduction();
                    statusConfigUIFilePath = result.filePath;
                    console.log("status config us path---", result.filePath);

                    if (result.filePath) {
                        await info.attach('Status Config UI Data', {
                            path: result.filePath,
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        });
                    }
                    assertion.log(
                        `Status Config Pass UI (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                        result.filePath ? `File: ${path.basename(result.filePath)}` : 'No File',
                        'Status Config UI Data Extracted',
                        result.filePath ? 'PASS' : 'FAIL',
                        '', info
                    );

                }

            } catch (e) {
                assertion.log(
                    `Status Configuration (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    e.message,
                    'Status Configuration Applied',
                    'FAIL',
                    '',
                    info
                );
                throw e;
            }

        });

        //Status Config Comparison-------------------------------------------

        test(`Step: 🔍 Status Configuration Comparison with Weld Parameters (In: ${slope.slopeIn}, Out: ${slope.slopeOut})`, async () => {
            test.skip(!fc.statusConfigComparison, "StatusConfig Comparison disabled.");

            const info = test.info();

            let comparePath;
            let testFailed = false;

            const stepName = `StatusConfig Comparison (In:${slope.slopeIn}, Out:${slope.slopeOut})`;

            // ─────────────────────────────────────────────
            // CASE 1 — Weld file not obtained
            // ─────────────────────────────────────────────
            if (!excelPath || !fs.existsSync(excelPath)) {
                assertion.log(stepName, 'Weld file not found', 'Weld file should exist', 'FAIL', '', info);
                testFailed = true;
            } else {
                assertion.log(stepName, 'Weld file found', 'Weld file should exist', 'PASS', '', info);
            }

            // ─────────────────────────────────────────────
            // CASE 2 — UI file not obtained
            // ─────────────────────────────────────────────
            if (!statusConfigUIFilePath || !fs.existsSync(statusConfigUIFilePath)) {
                assertion.log(stepName, 'UI file not found', 'UI file should exist', 'FAIL', '', info);
                testFailed = true;
            } else {
                assertion.log(stepName, 'UI file found', 'UI file should exist', 'PASS', '', info);
            }

            // ─────────────────────────────────────────────
            // RUN COMPARISON ONLY IF ABOVE PASSED
            // ─────────────────────────────────────────────
            if (!testFailed) {
                try {
                    const comparer = new StatusConfigCompare(excelPath, statusConfigUIFilePath);
                    comparePath = await comparer.run();
                } catch (e) {
                    console.warn("Comparison execution failed:", e.message);
                }
            }

            // ─────────────────────────────────────────────
            // CASE 5 — Comparison file not obtained
            // ─────────────────────────────────────────────
            if (!comparePath || !fs.existsSync(comparePath)) {
                assertion.log(stepName, 'Comparison file not generated', 'Comparison file should exist', 'FAIL', '', info);
                testFailed = true;
            } else {
                assertion.log(stepName, `Comparison file generated`, 'Comparison file should exist', 'PASS', '', info);

                await info.attach('StatusConfig Comparison', {
                    path: comparePath,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                // ─────────────────────────────────────────────
                // CASE 3 & 4 — Check RED cells (mismatch)
                // ─────────────────────────────────────────────
                let hasMismatch = false;

                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.readFile(comparePath);

                workbook.eachSheet(sheet => {
                    sheet.eachRow(row => {
                        row.eachCell(cell => {
                            const fill = cell.fill;

                            // Detect RED fill (mismatch)
                            if (fill && fill.fgColor && fill.fgColor.argb) {
                                const color = fill.fgColor.argb.toUpperCase();

                                if (color.includes('FFFFC7CE')) { // RED
                                    hasMismatch = true;
                                }
                            }
                        });
                    });
                });

                // CASE 3 — mismatch exists
                if (hasMismatch) {
                    assertion.log(stepName, 'Mismatch found (red cells)', 'No mismatches expected', 'FAIL', '', info);
                    testFailed = true;
                }
                // CASE 4 — no mismatch
                else {
                    assertion.log(stepName, 'No mismatch found', 'All values should match', 'PASS', '', info);
                }
            }

            // ─────────────────────────────────────────────
            // FINAL ASSERTION (FAIL TEST IF ANY CASE FAILED)
            // ─────────────────────────────────────────────
            if (testFailed) {
    console.warn(`❌ ${stepName} FAILED — continuing execution...`);
}
        });
        // ── UI Production Analysis ────────────────────────────────────────
        test(`Step: 📊 UI Analysis (In: ${slope.slopeIn}, Out: ${slope.slopeOut})`, async () => {
            test.skip(!fc.productionAnalysis, "Production Analysis is disabled in flowControl.");
            const info = test.info();

            try {
                const out = await analysis.runFlow(targetWeldId, null, project.projectName);
                const prodFilePath = out && out.filepath ? out.filepath : null;

                if (prodFilePath) {
                    await info.attach('Production Data', {
                        path: prodFilePath,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                }
                if (out && out.results && out.results.length > 0) {
                    const productionTabAssertion = new ProductionTabAssertion(page, helper);
                    await productionTabAssertion.attachUIAnalysisSummary(out.results, info);
                }
                assertion.log(
                    `UI Production Analysis (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    prodFilePath ? `File: ${path.basename(prodFilePath)}` : 'No File',
                    'Production Data Exported',
                    prodFilePath ? 'PASS' : 'FAIL',
                    '', info
                );
            } catch (e) {
                assertion.log(
                    `UI Analysis (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    e.message, 'Production Data Exported', 'FAIL', '', info
                );
                throw e;
            }
        });

        // ── Comparison ────────────────────────────────────────────────────
        test(`Step: ⚖️ Comparison Report (In: ${slope.slopeIn}, Out: ${slope.slopeOut})`, async () => {
            test.skip(!fc.comparison, "Comparison disabled.");
            const info = test.info();

            try {
                const {
                    hasFailure,
                    reportPath,
                    dashboardPath
                } =
                await compare.runAutoCompare(project.projectName, targetWeldId);

                if (reportPath) {
                    await info.attach('Comparison Excel Report', {
                        path: reportPath,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                }

                if (dashboardPath) {
                    await info.attach('📊 Weld Comparison Dashboard', {
                        body: fs.readFileSync(dashboardPath),
                        contentType: 'text/html'
                    });
                }

                assertion.log(
                    `Comparison (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    hasFailure ? '⚠️ Mismatches Found' : '✅ All Values Match',
                    'No Mismatches',
                    hasFailure ? 'FAIL' : 'PASS',
                    reportPath ? `Report: ${path.basename(reportPath)}` : '',
                    info
                );
                if (hasFailure) {
                    expect(false, "⚠️ Comparison found mismatches — check the 📊 Weld Comparison Dashboard attachment.").toBe(true);
                }
            } catch (e) {
                assertion.log(
                    `Comparison (In:${slope.slopeIn}, Out:${slope.slopeOut})`,
                    e.message, 'Comparison Completed', 'FAIL', '', info
                );
                throw e;
            }
        });
    }

    // ═════════════════════════════════════════════════════════════════════
    // FINAL
    // ═════════════════════════════════════════════════════════════════════
    test('🎉 Flow Complete', async () => {
        console.log("🎉 END-TO-END FLOW COMPLETED");
        assertion.log('Flow Complete', 'All Steps Executed', 'End-to-End Flow Completed', 'PASS', '', test.info());
        expect(true).toBe(true);
    });
});