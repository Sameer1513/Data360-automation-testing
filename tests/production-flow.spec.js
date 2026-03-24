const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { execSync, spawn } = require('child_process');

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
const StatusConfigCompare    = require('../pages/statusConfigCompare.page.js');
const BoltDBTxtFileTOExcel   = require('../pages/BoltDBTxtFileTOExcel.page');
const ComparePage            = require('../pages/compare.page');
const CommonHelper           = require('../Helper/CommonHelper');
const assertion              = require('../Helper/AssertionHelper.js');
const { sanitizeFolderName } = require('../Helper/excelNaming.util.js');
const LoginAssertion         = require('../Assertions/LoginAssertion');
const ProductionTabAssertion = require('../Assertions/ProductionTabAssertion');
const {
    clearProductionFlowTerminalSyncGate,
    markProductionFlowTerminalSyncDone
} = require('./helpers/production-flow-terminal-gate');

// Config
const configPath  = path.join(__dirname, '../config/Combinations.json');
const flowConfig  = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

test.describe.serial('🔥 COMPLETE END-TO-END FLOW', () => {

    // ── Shared state ──────────────────────────────────────────────────────
    let page, helper, login, createPage, specPage, deviceAssign,
        setupPage, status, statusConfigPass, analysis, compare;

    const project      = flowConfig.singleProject;
    const fc           = flowConfig.flowControl || {};
    const targetWeldId = new CommonHelper(null).resolveTargetWelds(project.weldIds);

    let derivedSetup = null;
    let deviceId     = null;

    const statusCompareConfigPath = path.join(__dirname, '../config/StatusConfigCompareFlow.json');
    const readStatusCompareConfig = () => {
        try {
            return JSON.parse(fs.readFileSync(statusCompareConfigPath, 'utf-8'));
        } catch {
            return null;
        }
    };

    // ── Before All ────────────────────────────────────────────────────────
    test.beforeAll(async () => {
        clearProductionFlowTerminalSyncGate();

        if (fc.cleanExports) {
            const exportsDir   = path.join(process.cwd(), 'exports');
            const dirsToClean  = ['ActualData', 'ProductionData', 'ComparedData'];
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
            expect(
                fs.existsSync(sourceFilePath),
                `❌ Source file '${project.sourceFile}' not found in Input directory.`
            ).toBe(true);
        }

        // NOTE: These cannot run in parallel.
        // runExtraction reads weldParamsPath while weldParameterExtraction writes the same XLSX.
        // Parallel execution intermittently causes "Corrupted zip" while opening the file.
        if (fc.weldParameterExtraction) {
            const inputFile = project.weldParamsInputFile;
            if (inputFile) {
                console.log(`⚡ Running Weld Parameter Extraction for ${inputFile}...`);
                if (inputFile.toLowerCase().endsWith('.csv')) {
                    await new WeldParametersCsvToExcel(inputFile).run();
                } else if (inputFile.toLowerCase().endsWith('.xml')) {
                    await new WeldParametersXmlToExcel(inputFile).run();
                }
            } else {
                console.warn("⚠️ 'weldParamsInputFile' is missing in project config. Skipping parameter extraction.");
            }
        }

        if (fc.runExtraction) {
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
        }
    });

    // ── Before Each ───────────────────────────────────────────────────────
    // Only open a browser page if at least one browser-dependent step is enabled.
    const needsBrowser = fc.login || fc.createProject || fc.deviceRegistration ||
                         fc.setup || fc.specification || fc.deviceSync ||
                         fc.productionAnalysis || fc.statusConfigPass || fc.comparison;

    test.beforeEach(async ({ browser }) => {
        if (!needsBrowser) return;
        if (page) return;
        page             = await browser.newPage();
        helper           = new CommonHelper(page);
        login            = new LoginAndProjectPage(page);
        createPage       = new CreateProjectPage(page);
        specPage         = new SpecificationPage(page);
        deviceAssign     = new DeviceAssigningPage(page);
        setupPage        = new SetupPage(page);
        status           = new StatusConfigPage(page);
        statusConfigPass = new StatusConfigPass(page);
        analysis         = new ProductionTabWeldData(page, flowConfig.scanConfig);
        compare          = new ComparePage();
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
        const isMultiBrowser        = flowConfig.mode === 'multiBrowser';
        const shouldRegister        = isDeviceRegConfigured && !isMultiBrowser && fc.deviceRegistration;
        test.skip(!shouldRegister, "Device Registration is disabled in flowControl or config.");

        const info = test.info();

        const resetConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        delete resetConfig.capturedDeviceId;
        fs.writeFileSync(configPath, JSON.stringify(resetConfig, null, 2));

        const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');

        await test.step('Run Device Register (Step 1)', async () => {
            await new Promise((resolve, reject) => {
                const child = spawn('node', [scriptPath, '--step=1'], { stdio: 'inherit', shell: true });
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
                if (derivedSetup.pipeSize)      p.pipeSize      = String(derivedSetup.pipeSize);
                if (derivedSetup.wallThickness)  p.wallThickness = String(derivedSetup.wallThickness);
                if (derivedSetup.wps)            p.wps           = [String(derivedSetup.wps)];
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
        const isMultiBrowser        = flowConfig.mode === 'multiBrowser';
        const shouldRunSync         = isDeviceRegConfigured && !isMultiBrowser && fc.deviceSync;

        // Release modular spec gate when sync step is not in this run (so create-device-register-assign-sync does not hang).
        if (!shouldRunSync) {
            markProductionFlowTerminalSyncDone();
            test.skip();
        }

        const info = test.info();
        const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');

        await new Promise((resolve, reject) => {
            const child = spawn('node', [scriptPath, '--step=2'], { stdio: 'inherit', shell: true });
            child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Step 2 failed: exit ${code}`)));
            child.on('error', (err) => reject(err));
        });

        assertion.log('Step 7: Device Sync', 'Sync Script Completed', 'Device Sync Completed', 'PASS', '', info);
        expect("Device Sync Completed Successfully").toBe("Device Sync Completed Successfully");

        // Terminal device sync finished — modular spec can start (parallel with Step 8+ UI in this file).
        markProductionFlowTerminalSyncDone();
    });

    // ═════════════════════════════════════════════════════════════════════
    // STEP 8 & 9 — PRODUCTION TAB VERIFICATION
    // ═════════════════════════════════════════════════════════════════════
    test('Step 8 & 9: 📊 Open Project and Verify Production Tab', async () => {
        test.skip(!fc.productionAnalysis, "Production Analysis is disabled in flowControl.");
        await new ProductionTabAssertion(page, helper).run(project.projectName, test.info());
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
                const extractor        = new BoltDBTxtFileTOExcel();
                const statusConfigPath = project.statusConfigPath
                    ? path.join(process.cwd(), project.statusConfigPath) : null;
                const weldParamsPath   = project.weldParamsPath
                    ? path.join(process.cwd(), project.weldParamsPath) : null;

                const { outputPath } = await extractor.run(
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

                if (fc.statusConfigPass) {
                    const result = await statusConfigPass.run(project.projectName, slope.slopeIn, slope.slopeOut);
                    await statusConfigPass.goBackToProduction();

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
                    e.message, 'Status Configuration Completed', 'FAIL', '', info
                );
                throw e;
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

        // ── Comparison  ────────────────────────────────────────────────────
        test(`Step: ⚖️ Comparison Report (In: ${slope.slopeIn}, Out: ${slope.slopeOut})`, async () => {
            test.skip(!fc.comparison, "Comparison disabled.");
            const info = test.info();

            try {
                const { hasFailure, reportPath, dashboardPath } =
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
    // INDEPENDENT STATUS CONFIG COMPARE FLOW
    // Uses ONLY config/StatusConfigCompareFlow.json for cases/flags.
    // Controlled by Combinations.flowControl.statusConfigCompareFlowAtEnd.
    // ═════════════════════════════════════════════════════════════════════
    // test('Step: 🧪 StatusConfig Compare Flow (p600z → p625)', async () => {
    //     test.skip(!fc.statusConfigCompareFlowAtEnd, "Independent StatusConfig compare flow is disabled.");
    //     const info = test.info();

    //     const scCfg = readStatusCompareConfig();
    //     if (!scCfg) {
    //         assertion.log(
    //             'StatusConfig Compare Flow (End)',
    //             'StatusConfigCompareFlow.json is missing/invalid',
    //             'Valid config file',
    //             'FAIL', '', info
    //         );
    //         return;
    //     }

    //     const scFc = scCfg.flowControl || {};
    //     const scCases = scCfg.cases || {};
    //     const scCompareCfg = scCfg.statusConfigCompare || {};

    //     // Optional clean-up based on the independent flow config.
    //     if (scFc.cleanExports) {
    //         const exportsDir = path.join(process.cwd(), 'exports');
    //         const legacyDirs = [
    //             'StatusConfig UI',
    //             'WeldParametersXmlToExcel',
    //             'WeldParametersCsvToExcel',
    //             'StatusConfig Compared with WeldParam',
    //             'StatusConfigCompareFlow'
    //         ];
    //         for (const dir of legacyDirs) {
    //             const fullPath = path.join(exportsDir, dir);
    //             if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { recursive: true, force: true });
    //         }
    //         for (const [_, cfg] of Object.entries(scCases)) {
    //             if (cfg?.projectName) {
    //                 const projDir = path.join(exportsDir, sanitizeFolderName(cfg.projectName));
    //                 if (fs.existsSync(projDir)) fs.rmSync(projDir, { recursive: true, force: true });
    //             }
    //         }
    //     }

    //     // IMPORTANT: this end block runs inside production-flow after earlier steps already
    //     // authenticated. Do NOT trigger login again; start directly from project search.
    //     const goToProjectsDashboard = async () => {
    //         const searchInput = page.locator('input[placeholder*="Search"]').first();
    //         const projectControls = [
    //             page.getByRole('button', { name: /^Projects$/i }).first(),
    //             page.getByRole('link', { name: /^Projects$/i }).first(),
    //             page.locator('header').getByText('Projects', { exact: true }).first(),
    //             page.getByText('Projects', { exact: true }).first()
    //         ];

    //         for (let attempt = 0; attempt < 3; attempt++) {
    //             try {
    //                 for (const ctrl of projectControls) {
    //                     if (await ctrl.isVisible().catch(() => false)) {
    //                         await ctrl.click({ timeout: 5000 }).catch(() => {});
    //                         break;
    //                     }
    //                 }
    //             } catch (_) {
    //                 // ignore and retry
    //             }

    //             await page.waitForLoadState('networkidle').catch(() => {});
    //             await page.waitForSelector('text=/Projects/i', { state: 'visible', timeout: 8000 }).catch(() => {});
    //             const visible = await searchInput.isVisible().catch(() => false);
    //             if (visible) return;
    //             await page.waitForTimeout(500).catch(() => {});
    //         }

    //         await searchInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    //     };

    //     const runCase = async (caseKey, cfg) => {
    //         if (!cfg?.enabled) return;

    //         const result = { caseKey, enabled: !!cfg?.enabled, passed: true, failures: [] };
    //         const projectName = cfg.projectName;
    //         const inputFile = cfg.weldParameterInputFile || '';
    //         const slopeIn = Number(cfg.slopeIn ?? 0);
    //         const slopeOut = Number(cfg.slopeOut ?? 0);
    //         const calcMethod = cfg.calculationMethod || scCompareCfg.calculationMethod || null;

    //         let uiPath = null;
    //         let weldPath = null;
    //         let comparePath = null;
    //         let caseFinalized = false;
    //         const fail = (stage, message, extra = '') => {
    //             result.passed = false;
    //             result.failures.push({ stage, message, extra });
    //             assertion.log(`${caseKey}: ${stage}`, message, 'No failure expected', 'FAIL', extra, info);
    //         };
    //         const passLog = (stage, message, extra = '') => {
    //             assertion.log(`${caseKey}: ${stage}`, message, 'Success', 'PASS', extra, info);
    //         };
    //         const finalizeCase = () => {
    //             if (caseFinalized) return;
    //             caseFinalized = true;
    //             assertion.log(
    //                 `${caseKey}: Overall Case Result`,
    //                 result.passed ? 'PASS' : 'FAIL',
    //                 'PASS',
    //                 result.passed ? 'PASS' : 'FAIL',
    //                 result.passed ? 'All assertions in this case passed' : 'At least one assertion failed in this case',
    //                 info
    //             );
    //         };

    //         // Project open + production tab (best effort, no throw)
    //         try {
    //             await goToProjectsDashboard();
    //             await helper.selectProject(projectName);
    //             passLog('Login/Navigation', `Project opened: ${projectName}`);
    //         } catch (e) {
    //             fail('Login/Navigation', e?.message || String(e));
    //             finalizeCase();
    //             return;
    //         }

    //         // Weld extraction
    //         try {
    //             if (!scFc.weldParameterExtraction) {
    //                 fail('Weld Conversion', 'Disabled in StatusConfigCompareFlow.flowControl');
    //                 finalizeCase();
    //                 return;
    //             }
    //             if (!inputFile) {
    //                 fail('Weld Conversion', 'weldParameterInputFile is missing');
    //                 finalizeCase();
    //                 return;
    //             }
    //             const opts = projectName ? { projectName } : {};
    //             if (inputFile.toLowerCase().endsWith('.csv')) {
    //                 weldPath = await new WeldParametersCsvToExcel(inputFile, opts).run();
    //             } else if (inputFile.toLowerCase().endsWith('.xml')) {
    //                 weldPath = await new WeldParametersXmlToExcel(inputFile, opts).run();
    //             } else {
    //                 fail('Weld Conversion', `Unsupported file type: ${inputFile}`);
    //                 finalizeCase();
    //                 return;
    //             }
    //             if (!weldPath || !fs.existsSync(weldPath)) {
    //                 fail('Weld Conversion', `Weld Excel missing: ${weldPath || 'empty path'}`);
    //                 finalizeCase();
    //                 return;
    //             }
    //             passLog('Weld Excel Generated', weldPath, `Input: ${inputFile}\nOutput: ${weldPath}`);
    //         } catch (e) {
    //             fail('Weld Conversion', e?.message || String(e));
    //             finalizeCase();
    //             return;
    //         }

    //         // Status config apply + UI extraction
    //         let uiResult = { filePath: null };
    //         try {
    //             await status.applyStatusConfiguration(slopeIn, slopeOut);
    //             passLog('Apply Slope', `Applied In:${slopeIn}, Out:${slopeOut}`);

    //             if (!scFc.statusConfigUIExtraction) {
    //                 fail('UI Extraction', 'Disabled in StatusConfigCompareFlow.flowControl');
    //                 finalizeCase();
    //                 return;
    //             }

    //             uiResult = await statusConfigPass.run(projectName, slopeIn, slopeOut, calcMethod);
    //             await statusConfigPass.goBackToProduction();
    //             uiPath = uiResult?.filePath || null;

    //             if (!uiPath || !fs.existsSync(uiPath)) {
    //                 fail('UI Extraction', `UI Excel missing: ${uiPath || 'empty path'}`);
    //                 finalizeCase();
    //                 return;
    //             }
    //             passLog('UI Excel Generated', uiPath);
    //         } catch (e) {
    //             fail('UI Extraction', e?.message || String(e));
    //             finalizeCase();
    //             return;
    //         }

    //         // Compare
    //         try {
    //             if (!scFc.statusConfigComparison) {
    //                 passLog('Comparison Skipped', 'statusConfigComparison=false');
    //                 finalizeCase();
    //                 return;
    //             }
    //             passLog('Comparison Inputs', `weld=${weldPath}`, `ui=${uiPath}`);

    //             const comparer = new StatusConfigCompare(
    //                 weldPath,
    //                 uiPath,
    //                 scCompareCfg.weldSheetName || null,
    //                 uiResult?.weldDetails?.['Job Number'] ?? null,
    //                 projectName
    //             );
    //             comparePath = await comparer.run();
    //             if (!comparePath || !fs.existsSync(comparePath)) {
    //                 fail('Comparison Output', `Comparison Excel missing: ${comparePath || 'empty path'}`);
    //                 finalizeCase();
    //                 return;
    //             }

    //             let hasMismatch = false;
    //             const wb = new ExcelJS.Workbook();
    //             await wb.xlsx.readFile(comparePath);
    //             wb.eachSheet(sheet => {
    //                 sheet.eachRow(row => {
    //                     row.eachCell(cell => {
    //                         if (cell.fill?.fgColor?.argb?.includes('FFFFC7CE')) hasMismatch = true;
    //                     });
    //                 });
    //             });

    //             if (hasMismatch) {
    //                 fail(
    //                     'StatusConfig vs WeldParam Comparison',
    //                     'Mismatch found',
    //                     `WeldExcel: ${weldPath}\nUIExcel: ${uiPath}\nCompare: ${comparePath}`
    //                 );
    //             } else {
    //                 passLog(
    //                     'StatusConfig vs WeldParam Comparison',
    //                     'No mismatches detected',
    //                     `WeldExcel: ${weldPath}\nUIExcel: ${uiPath}\nCompare: ${comparePath}`
    //                 );
    //             }
    //         } catch (e) {
    //             fail('StatusConfigCompare.run()', e?.message || String(e));
    //         }
    //         finalizeCase();
    //     };

    //     // Keep order as requested: CSVp600z first, then p625.
    //     await runCase('p600z', scCases.p600z);
    //     await runCase('p625', scCases.p625);
    // });

    // ═════════════════════════════════════════════════════════════════════
    // FINAL
    // ═════════════════════════════════════════════════════════════════════
    test('🎉 Flow Complete', async () => {
        console.log("🎉 END-TO-END FLOW COMPLETED");
        assertion.log('Flow Complete', 'All Steps Executed', 'End-to-End Flow Completed', 'PASS', '', test.info());
        expect(true).toBe(true);
    });
});