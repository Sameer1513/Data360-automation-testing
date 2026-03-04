// const fs = require('fs');
// const path = require('path');
// const { test, chromium } = require('@playwright/test');

// const LoginAndProjectPage = require('../pages/loginAndProject.page');
// const StatusConfigPage = require('../pages/statusConfig.page');
// const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
// const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
// const ComparePage = require('../pages/compare.page');

// // --------------------
// // LOAD CONFIG
// // --------------------
// const configPath = path.join(__dirname, '../config/Combinations.json');
// const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
// const scanConfig = flowConfig.scanConfig;

// // --------------------
// // HELPERS
// // --------------------
// function resolveTargetWelds(weldIds) {
//   if (!weldIds || weldIds.length === 0) return null;
//   return weldIds;
// }

// async function runSingleFlow(page, projectConfig) {
//   const login = new LoginAndProjectPage(page);
//   const status = new StatusConfigPage(page);
//   const analysis = new ProductionTabWeldData(page, flowConfig.scanConfig);
//   const extractor = new BoltDBTxtFileTOExcel();
//   const compare = new ComparePage();

//   const targetWeldId = resolveTargetWelds(projectConfig.weldIds);

//   await login.loginAndOpenProject();
//   console.log(`📂 Selecting Project: ${projectConfig.projectName}`);
  
//   // Use a case-insensitive regex to find the project tile
//   const projectTile = page.getByText(new RegExp(`^${projectConfig.projectName}$`, 'i'));
  
//   await projectTile.waitFor({ state: 'visible', timeout: 15000 });
//   await projectTile.click();

//   // Wait for the Project-specific UI (like tabs) to appear before continuing
//   await page.waitForSelector('button[role="tab"]', { state: 'visible', timeout: 15000 });
//   // ---------------------------------

//   for (const slope of projectConfig.slopeCombinations) {
//     console.log(
//       `🚀 Project=${projectConfig.projectName} | In=${slope.slopeIn} | Out=${slope.slopeOut} | Welds=${targetWeldId || 'ALL'}`
//     );

//     await status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);

//     console.log('⏳ Synchronizing Production Table...');
//     await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });

//     console.log('⚡ Running Analysis & Extraction in Parallel...');
//     await Promise.all([
//       // Added projectConfig.projectName here
//       analysis.runFlow(targetWeldId, null, projectConfig.projectName), 
//       // Added projectConfig.projectName here
//       extractor.run(slope.slopeIn, slope.slopeOut, projectConfig.projectName, projectConfig.sourceFile),
//     ]);

//     console.log('🧪 Running Auto-Comparison...');
//     // Added projectConfig.projectName here
//     await compare.runAutoCompare(projectConfig.projectName, targetWeldId);
//   }
// }

// // --------------------
// // MAIN TEST
// // --------------------
// test('Production Flow – Config Driven', async ({ page }) => {

//   // 1. If we are in multi-mode, kill the automatic blank browser immediately
//   if (flowConfig.mode === 'multiProject' || flowConfig.mode === 'multiBrowser') {
//     await page.close(); 
//   }

//   // --------------------
//   // MODE: SINGLE PROJECT
//   // --------------------
//   if (flowConfig.mode === 'single') {
//     await runSingleFlow(page, flowConfig.singleProject);
//     return;
//   }

//   // --------------------
//   // MODE: MULTI PROJECT
//   // --------------------
//   if (flowConfig.mode === 'multiProject') {
//   await page.close(); // Close the runner browser

//   // Use map to create an array of promises
//   const projectPromises = flowConfig.multiProject.map(async (project) => {
//     // Isolated browser instance for EACH project
//     const browser = await chromium.launch(); 
//     const context = await browser.newContext();
//     const projectPage = await context.newPage();

//     try {
//       console.log(`▶️ Starting: ${project.projectName} (ID: ${project.browserId})`);
//       await runSingleFlow(projectPage, project);
//       console.log(`✅ Finished: ${project.projectName}`);
//     } catch (err) {
//       console.error(`❌ Error in ${project.projectName}:`, err);
//     } finally {
//       await browser.close(); // Only close THIS browser
//     }
//   });

//   // Wait for all to finish, regardless of who finishes first
//   await Promise.allSettled(projectPromises); 
//   return;
// }
//   // --------------------
//   // MODE: MULTI BROWSER (Note: You had a few undefined variable errors here too)
//   // --------------------
//   if (flowConfig.mode === 'multiBrowser') {
//     await Promise.all(
//       flowConfig.multiBrowser.map(async (browserCfg) => {
//         const browser = await chromium.launch({ headless: false });
//         const context = await browser.newContext();
//         const mbPage = await context.newPage();

//         const login = new LoginAndProjectPage(mbPage);
//         const status = new StatusConfigPage(mbPage);
//         const analysis = new ProductionTabWeldData(mbPage);
//         const extractor = new BoltDBTxtFileTOExcel();
//         const compare = new ComparePage();

//         console.log(`🌐 Browser-${browserCfg.browserId} | Project=${browserCfg.projectName}`);

//         await login.loginAndOpenProject(browserCfg.projectName);
//         await status.applyStatusConfiguration(browserCfg.slope.slopeIn, browserCfg.slope.slopeOut);

//         await mbPage.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });
        
//         await Promise.all([
//           analysis.runFlow(resolveTargetWelds(browserCfg.weldIds), null, browserCfg.projectName),
//           extractor.run(browserCfg.slope.slopeIn, browserCfg.slope.slopeOut, browserCfg.projectName, browserCfg.sourceFile),
//         ]);

//         await compare.runAutoCompare(browserCfg.projectName);
//         await browser.close();
//       })
//     );
//   }
// });









// // const fs = require('fs');
// // const path = require('path');
// // const { test } = require('@playwright/test');

// // const LoginAndProjectPage = require('../pages/loginAndProject.page');
// // const CreateProjectPage = require('../pages/createproject.page');
// // const SetupPage = require('../pages/setup.page'); 

// // const configPath = path.join(__dirname, '../config/Combinations.json');
// // const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// // // Determine which project list to use based on mode
// // const projects = flowConfig.mode === 'single' 
// //     ? [flowConfig.singleProject] 
// //     : (flowConfig.mode === 'multiBrowser' ? flowConfig.multiBrowser : flowConfig.multiProject);

// // // 🔥 Enable Parallel Mode so they don't wait for each other
// // test.describe.configure({ mode: 'parallel' });

// // for (const project of projects) {
// //     // browserId can be used to differentiate workers if needed
// //     test(`Project Flow: ${project.projectName} (Browser: ${project.browserId || 'Default'})`, async ({ page }) => {
// //         const login = new LoginAndProjectPage(page);
// //         const createPage = new CreateProjectPage(page);
// //         const setupPage = new SetupPage(page); 

// //         const data = {
// //             ...flowConfig.createProjectData,
// //             projectName: project.projectName
// //         };

// //         console.log(`🚀 Starting Parallel Worker for: ${data.projectName}`);

// //         // 1. Login
// //         await login.loginAndOpenProject(data.projectName);

// //         // 2. Create
// //         await createPage.createProject(data);

// //         // 3. Setup
// //         await setupPage.performSetup(data.projectName);
// //     });
// // }



// // const { test } = require('@playwright/test');
// // // Ensure the path correctly points to your pages folder
// // const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');

// // test('Verify Weld Time in Actual Data', async () => {
// //     console.log("⚡ Testing Actual Data Flow...");
// //     const extractor = new BoltDBTxtFileTOExcel();

// //     // Run extraction with 0 slope to test raw timing logic
// //     await extractor.run(0, 0); 
    
// //     console.log("✅ Success! Check the 'exports' folder.");
// // });

// // const fs = require('fs');
// // const path = require('path');
// // const { test } = require('@playwright/test');

// // // Importing the updated Page Object
// // const LoginAndProjectPage = require('../pages/loginAndProject.page');

// // const configPath = path.join(__dirname, '../config/Combinations.json');
// // const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// // // Determine project list
// // const projects = flowConfig.mode === 'single' 
// //     ? [flowConfig.singleProject] 
// //     : (flowConfig.mode === 'multiBrowser' ? flowConfig.multiBrowser : flowConfig.multiProject);

// // // Configure parallel execution
// // test.describe.configure({ mode: 'single' });

// // for (const project of projects) {
// //     test(`Login Flow Verification: ${project.projectName}`, async ({ page }) => {
// //         // Initialize the page object
// //         const login = new LoginAndProjectPage(page);
        
// //         console.log(`🚀 Executing Login Scenarios for: ${project.projectName}`);

// //         // This method handles all scenarios and returns upon 'SUCCESS'
// //         await login.loginAndOpenProject(project.projectName);
        
// //         console.log(`✅ Finished all login scenarios for: ${project.projectName}`);

// //         // --- THE FIX TO CLOSE BROWSER ---
// //         await page.close();
// //     });
// // }


// // const fs = require('fs');
// // const path = require('path');
// // const { test } = require('@playwright/test');

// // // Importing your existing Page Objects
// // const LoginAndProjectPage = require('../pages/loginAndProject.page'); // The one you provided
// // const SpecificationsPage = require('../pages/Specification.page'); // The one we built

// // const configPath = path.join(__dirname, '../config/Combinations.json');
// // const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// // // Determine project list based on your logic
// // const projects = flowConfig.mode === 'single' 
// //     ? [flowConfig.singleProject] 
// //     : (flowConfig.mode === 'multiBrowser' ? flowConfig.multiBrowser : flowConfig.multiProject);

// // test.describe.configure({ mode: 'single' }); // Set to parallel if running multi-browser

// // for (const project of projects) {
// //     test(`Integrated Specification Flow: ${project.projectName}`, async ({ page }) => {
        
// //         // 1. Initialize Page Objects
// //         const login = new LoginAndProjectPage(page);
// //         const specs = new SpecificationsPage(page);

// //         console.log(`🚀 Starting Login Phase for: ${project.projectName}`);

// //         // 2. Execute your login scenarios (Empty, Wrong, then Correct)
// //         // This method handles the page.goto and the login button click internally
// //         await login.loginAndOpenProject(project.projectName);
        
// //         console.log(`✅ Login Phase Finished. Starting Navigation for: ${project.projectName}`);

// //         // 3. NAVIGATION: Search and Open the Specifications Tab
// //         // We use the search logic we built to find the specific project
// //         await specs.navigateToSpecifications(project.projectName);

// //         // 4. ACTION: Upload Specifications (Excel + PDFs)
// //         if (project.specificationData) {
// //             await specs.uploadSpecifications(project.specificationData);
// //         }

// //         // 5. ACTION: Manual Specification Entry (If data exists)
// //         if (project.specificationData.newSpecification) {
// //             await specs.addNewSpecificationManual(project.specificationData.newSpecification);
// //         }

// //         console.log(`🎉 Full Flow Completed for: ${project.projectName}`);

// //         // Close page properly
// //         await page.close();
// //     });
// // }



// const fs = require('fs');
// const path = require('path');
// const { test, chromium, expect } = require('@playwright/test');

// // Page Objects
// const LoginAndProjectPage = require('../pages/loginAndProject.page');
// const CreateProjectPage = require('../pages/createproject.page');
// const SetupPage = require('../pages/setup.page');
// const StatusConfigPage = require('../pages/statusConfig.page');
// const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
// const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
// const ComparePage = require('../pages/compare.page');

// const configPath = path.join(__dirname, '../config/Combinations.json');
// const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// // --------------------
// // HELPERS
// // --------------------
// function resolveTargetWelds(weldIds) {
//     if (!weldIds || weldIds.length === 0) return null;
//     return weldIds;
// }

// /**
//  * Perform ONLY the Creation and Setup Phase
//  */
// async function runSetupPhase(page) {
//     const login = new LoginAndProjectPage(page);
//     const createPage = new CreateProjectPage(page);
//     const setupPage = new SetupPage(page);

//     await login.loginAndOpenProject();
//     const creationProjectName = flowConfig.createProjectData.projectName || "Project-A";
    
//     console.log(`🏗️ Phase 1: Setup for: ${creationProjectName}`);
//     await createPage.createProject({ ...flowConfig.createProjectData, projectName: creationProjectName });
//     await setupPage.performSetup(creationProjectName);
// }

// /**
//  * Perform ONLY the Scan and Analysis Phase
//  */
// /**
//  * Perform ONLY the Scan and Analysis Phase
//  */
// async function runScanPhase(page, projectConfig) {
//     const login = new LoginAndProjectPage(page);
//     const status = new StatusConfigPage(page);
//     const analysis = new ProductionTabWeldData(page, flowConfig.scanConfig);
//     const extractor = new BoltDBTxtFileTOExcel();
//     const compare = new ComparePage();

//     // 1. RETURN TO DASHBOARD
//     const isDashboard = await page.locator('input[placeholder*="Search"]').first().isVisible();

//     if (!isDashboard) {
//         if (page.url().includes('login') || page.url() === 'about:blank') {
//             await login.loginAndOpenProject();
//         } else {
//             console.log("⬅️ Navigating back to Project List...");
//             const projectsBreadcrumb = page.locator('header').getByText('Projects', { exact: true });
//             await projectsBreadcrumb.click();
//         }
//     }

//     // 2. SEARCH AND SELECT PROJECT-B
//     const searchInput = page.locator('input[placeholder*="Search"]').first();
//     await searchInput.click({ clickCount: 3 });
//     await page.keyboard.press('Backspace');
//     await searchInput.fill(projectConfig.projectName);
//     await page.keyboard.press('Enter');

//     const projectTile = page.locator('main, .project-list')
//         .getByText(new RegExp(`^${projectConfig.projectName}$`, 'i'))
//         .first();
    
//     // Wait for the tile to be stable before clicking
//     await projectTile.waitFor({ state: 'visible' });
//     await projectTile.click();

//     // 3. WAIT FOR PRODUCTION TAB TO BE SELECTED & DATA TO APPEAR
//     console.log("📂 Switching to Production and waiting for data...");
    
//     const productionTab = page.getByRole('tab', { name: /Production/i });
    
//     // Ensure tab is clicked
//     await productionTab.waitFor({ state: 'visible' });
//     await productionTab.click();

//     // CRITICAL: Wait for the tab to gain the 'active' state (aria-selected) 
//     // and wait for the table rows to exist in the DOM.
//     await expect(productionTab).toHaveAttribute('aria-selected', 'true');

//     // This is the "Smart Wait": It waits for the first weld row to actually show up
//     const weldRows = page.locator('table tbody tr');
//     await weldRows.first().waitFor({ state: 'visible' });

//     console.log(`✅ Data loaded. Found ${await weldRows.count()} welds. Starting search...`);

//     // 4. CONTINUE ANALYSIS FLOW
//     const targetWeldId = resolveTargetWelds(projectConfig.weldIds);
//     for (const slope of projectConfig.slopeCombinations) {
//         console.log(`🚀 Project=${projectConfig.projectName} | In=${slope.slopeIn}`);
        
//         // Re-verify table is still present before applying config
//         await expect(page.locator('table')).toBeVisible();
        
//         await status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);
        
//         await Promise.all([
//             analysis.runFlow(targetWeldId, null, projectConfig.projectName), 
//             extractor.run(slope.slopeIn, slope.slopeOut, projectConfig.projectName, projectConfig.sourceFile),
//         ]);
        
//         await compare.runAutoCompare(projectConfig.projectName, targetWeldId);
//     }
// }

// // --------------------
// // MAIN TEST
// // --------------------
// test('Production Flow – Strategy Controller', async ({ page }) => {

//     switch (flowConfig.mode) {
        
//         // OPTION 1: Same Browser (Setup A -> Dashboard -> Scan B)
//         case 'single':
//             await runSetupPhase(page);
//             await runScanPhase(page, flowConfig.singleProject);
//             break;

//         // OPTION 2: Different Browsers (Browser 1 Setup -> Close -> Browser 2 Scan)
//         case 'split':
//             await page.close(); // Close default
            
//             console.log("🖥️ Launching Browser 1 for SETUP...");
//             const b1 = await chromium.launch({ headless: false });
//             const p1 = await b1.newPage();
//             await runSetupPhase(p1);
//             await b1.close();

//             console.log("🖥️ Launching Browser 2 for SCAN...");
//             const b2 = await chromium.launch({ headless: false });
//             const p2 = await b2.newPage();
//             await runScanPhase(p2, flowConfig.singleProject);
//             await b2.close();
//             break;

//         // OPTION 3: Parallel Multi-Project
//         case 'multiProject':
//             await page.close();
//             const projectPromises = flowConfig.multiProject.map(async (project) => {
//                 const browser = await chromium.launch({ headless: false });
//                 const pPage = await browser.newPage();
//                 try {
//                     await runSetupPhase(pPage);
//                     await runScanPhase(pPage, project);
//                 } finally {
//                     await browser.close();
//                 }
//             });
//             await Promise.allSettled(projectPromises);
//             break;
//     }
// });



// const fs = require('fs');
// const path = require('path');
// const { test } = require('@playwright/test');
// const { execSync } = require('child_process');

// // 1. Import Page Objects
// const LoginAndProjectPage = require('../pages/loginAndProject.page');
// const CreateProjectPage = require('../pages/createproject.page');
// const DeviceAssigningPage = require('../pages/DeviceAssigning.page');
// const SetupPage = require('../pages/setup.page');

// // Config path
// const configPath = path.join(__dirname, '../config/Combinations.json');

// // --------------------------------------------
// // ✅ Helper: Wait for Device ID (IMPORTANT)
// // --------------------------------------------
// async function waitForDeviceId(configPath, timeout = 20000) {
//     const start = Date.now();

//     while (Date.now() - start < timeout) {
//         const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

//         if (updatedConfig.capturedDeviceId) {
//             return updatedConfig.capturedDeviceId;
//         }

//         await new Promise(res => setTimeout(res, 1000)); // wait 1 sec
//     }

//     throw new Error("❌ Timeout: Device ID not generated.");
// }

// // Run in serial (important for shared file)
// test.describe.configure({ mode: 'serial' });

// // Load Config
// const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
// const projects = flowConfig.mode === 'single'
//     ? [flowConfig.singleProject]
//     : flowConfig.multiProject;

// // --------------------------------------------
// // 🚀 MAIN FLOW
// // --------------------------------------------
// for (const project of projects) {
//     test(`Automated Integrated Flow: ${project.projectName}`, async ({ page }) => {

//         // --------------------------------------------
//         // 🔁 STEP 0: Reset old Device ID
//         // --------------------------------------------
//         const configToReset = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
//         delete configToReset.capturedDeviceId;
//         fs.writeFileSync(configPath, JSON.stringify(configToReset, null, 2));

//         // --------------------------------------------
//         // 📄 Initialize Pages
//         // --------------------------------------------
//         const login = new LoginAndProjectPage(page);
//         const createPage = new CreateProjectPage(page);
//         const deviceAssign = new DeviceAssigningPage(page);
//         const setupPage = new SetupPage(page);

//         // --------------------------------------------
//         // 🔐 STEP 1: LOGIN
//         // --------------------------------------------
//         console.log(`🚀 Starting Flow for: ${project.projectName}`);
//         await login.loginAndOpenProject(project.projectName);

//         // --------------------------------------------
//         // 🏗️ STEP 2: CREATE PROJECT
//         // --------------------------------------------
//         await createPage.createProject(project.createProjectData || project);

//         // --------------------------------------------
//         // 🖥️ STEP 3: RUN TERMINAL SYNC (STEP 1 - Register)
//         // --------------------------------------------
//         console.log(`🖥️ Running device_register.js (Step 1)...`);

//         try {
//             const scriptPath = path.join(
//                 __dirname,
//                 '..',
//                 'terminal_execution_files',
//                 'device_register.js'
//             );

//             console.log(`🔍 Executing Step 1: ${scriptPath}`);

//             // Run script (blocking)
//             // Pass --step=1 to only run registration and capture ID
//             execSync(`node "${scriptPath}" --step=1`, { stdio: 'inherit' });

//             console.log("⏳ Waiting for Device ID...");

//             // --------------------------------------------
//             // ⏳ STEP 4: WAIT FOR DEVICE ID
//             // --------------------------------------------
//             const capturedID = await waitForDeviceId(configPath);

//             console.log(`🎯 Device ID received: ${capturedID}`);

//             // --------------------------------------------
//             // 🔗 STEP 5: ASSIGN DEVICE
//             // --------------------------------------------
//             await deviceAssign.assignProjectToDevice(capturedID, project.projectName);

//             // --------------------------------------------
//             // 🖥️ STEP 5.5: RUN TERMINAL SYNC (STEP 2 - DB Sync)
//             // --------------------------------------------
//             console.log(`🖥️ Running device_register.js (Step 2)...`);
//             console.log(`🔍 Executing Step 2: ${scriptPath}`);
//             // Pass --step=2 to run the sync process
//             execSync(`node "${scriptPath}" --step=2`, { stdio: 'inherit' });

//         } catch (error) {
//             console.error(`❌ Terminal execution failed: ${error.message}`);
//             throw error;
//         }

//         // --------------------------------------------
//         // ⚙️ STEP 6: SETUP CONFIGURATION
//         // --------------------------------------------
//         console.log(`⚙️ Starting Setup for: ${project.projectName}`);
//         await setupPage.performSetup(project.projectName);

//         console.log(`🎉 SUCCESS: ${project.projectName} is fully configured.`);

//         await page.close();
//     });
// }





// const { test } = require('@playwright/test');
// const fs = require('fs');
// const path = require('path');
// const LoginAndProjectPage = require('../pages/loginAndProject.page');
// const DeviceAssigningPage = require('../pages/DeviceAssigning.page');

// const configPath = path.join(__dirname, '../config/Combinations.json');
// const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// test('Login and Device Assign Flow', async ({ page }) => {
//     const login = new LoginAndProjectPage(page);
//     const devicePage = new DeviceAssigningPage(page);

//     // Get data from JSON
//     // We use singleProject.projectName as the target
//     const projectName = flowConfig.singleProject.projectName;
    
//     // We assume capturedDeviceId was already saved by your terminal script
//     const deviceId = flowConfig.capturedDeviceId || "DESKTOP-3Q28M09"; 

//     // 1. Login
//     await login.loginAndOpenProject(projectName);

//     // 2. Assign Device
//     await devicePage.assignProjectToDevice(deviceId, projectName);
// });


const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

// Page Objects
const LoginAndProjectPage = require('../pages/loginAndProject.page');
const CreateProjectPage = require('../pages/createproject.page');
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

test('🔥 COMPLETE END-TO-END SINGLE FLOW', async ({ page }) => {

    const helper = new CommonHelper(page);
    const project = flowConfig.singleProject;
    const targetWeldId = helper.resolveTargetWelds(project.weldIds);

    // 🎛️ FLOW CONTROL
    const fc = flowConfig.flowControl || {};

    // ----------------------------
    // 🧹 PRE-CLEANUP: DELETE OLD EXPORTS
    // ----------------------------
    if (fc.cleanExports) {
        await test.step('🧹 Cleanup Old Export Files', async () => {
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
        });
    }

    // ----------------------------
    // 🛡️ ASSERTION: CHECK SOURCE FILE
    // ----------------------------
    if (fc.checkSourceFile) {
        await test.step('📂 Verify Input Source File Exists', async () => {
            const sourceFilePath = path.join(process.cwd(), 'Input', project.sourceFile);
            expect(fs.existsSync(sourceFilePath), `❌ Source file '${project.sourceFile}' not found in Input directory.`).toBe(true);
        });
    }

    // ⚙️ CONFIG: Determine if Device Registration is needed
    const isDeviceRegConfigured = flowConfig.deviceRegistration && flowConfig.deviceRegistration.enabled !== false;
    const isMultiBrowser = flowConfig.mode === 'multiBrowser';
    
    // We now use the JSON flag 'deviceRegistration' to gate Step 1 specifically
    const shouldRegisterDevice = isDeviceRegConfigured && !isMultiBrowser && fc.deviceRegistration;
    console.log(`ℹ️ Device Registration (Step 1) Mode: ${shouldRegisterDevice ? 'ENABLED' : 'DISABLED'}`);

    // ----------------------------
    // ⚡ PRE-STEP: RUN EXTRACTOR
    // ----------------------------
    let derivedSetup = null;
    if (fc.runExtraction) {
        await test.step('⚡ Pre-Computation: BoltDB to Excel Extraction', async () => {
            const extractor = new BoltDBTxtFileTOExcel();
            console.log("⚡ Starting BoltDB to Excel Extraction (Pre-computation)...");
            for (const slope of project.slopeCombinations) {
                const result = await extractor.run(
                    slope.slopeIn,
                    slope.slopeOut,
                    project.projectName,
                    project.sourceFile
                );
                if (result) derivedSetup = result;
            }
        });
    }

    // ----------------------------
    // 🔁 RESET DEVICE ID
    // ----------------------------
    if (shouldRegisterDevice && fc.deviceRegistration) {
        const resetConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        delete resetConfig.capturedDeviceId;
        fs.writeFileSync(configPath, JSON.stringify(resetConfig, null, 2));
    }

    // ----------------------------
    // 📄 INIT PAGES
    // ----------------------------
    const login = new LoginAndProjectPage(page);
    const createPage = new CreateProjectPage(page);
    const deviceAssign = new DeviceAssigningPage(page);
    const setupPage = new SetupPage(page);
    const status = new StatusConfigPage(page);
    const analysis = new ProductionTabWeldData(page, flowConfig.scanConfig);
    const compare = new ComparePage();

    console.log(`🚀 START FLOW: ${project.projectName}`);

    // ----------------------------
    // 🔐 STEP 1: LOGIN
    // ----------------------------
    if (fc.login) {
        await login.loginAndOpenProject();
    } else {
        console.log("⏩ Skipping Login (Disabled in FlowControl)");
    }

    // ----------------------------
    // 🏗️ STEP 2: CREATE PROJECT
    // ----------------------------
    if (fc.createProject) {
        await createPage.createProject({
            ...flowConfig.createProjectData,
            projectName: project.projectName
        });
    } else {
        console.log("⏩ Skipping Create Project (Disabled in FlowControl)");
    }

    // ----------------------------
    // 🖥️ STEP 3: DEVICE REGISTER (STEP 1)
    // ----------------------------
    const scriptPath = path.join(__dirname, '..', 'terminal_execution_files', 'device_register.js');

    if (shouldRegisterDevice) {
        await test.step('🖥️ Run Device Register (Step 1)', async () => {
            try {
                // Capture stdout and print it to the report
                const output = execSync(`node "${scriptPath}" --step=1`, { encoding: 'utf-8' });
                console.log(output);
            } catch (error) {
                // If the command fails, log its output and re-throw to fail the test
                console.error(error.stdout);
                throw error;
            }
        });

        // ----------------------------
        // ⏳ STEP 4: WAIT FOR DEVICE ID
        // ----------------------------
        const deviceId = await test.step('⏳ Wait for Device ID', async () => {
            const id = await helper.waitForDeviceId(configPath);
            console.log(`🎯 Device ID: ${id}`);
            expect(id, 'Device ID should be generated').toBeTruthy();
            return id;
        });

        // ----------------------------
        // 🔗 STEP 5: ASSIGN DEVICE
        // ----------------------------
        await test.step('🔗 Assign Device to Project', async () => {
            await deviceAssign.assignProjectToDevice(deviceId, project.projectName);
        });
    } else {
        console.log("⏩ Skipping Device Registration & Assignment (Disabled or Multi-Browser)");
    }

    // ----------------------------
    // ⚙️ STEP 6: SETUP
    // ----------------------------
    if (fc.setup) {
        if (derivedSetup) {
            await test.step('📝 Apply Derived Setup Config', async () => {
                console.log("📝 Updating Combinations.json with derived data:", derivedSetup);
                const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                
                if (cfg.singleProject && cfg.singleProject.setupConfig && cfg.singleProject.setupConfig.pipes && cfg.singleProject.setupConfig.pipes.length > 0) {
                    const p = cfg.singleProject.setupConfig.pipes[0];
                    if (derivedSetup.pipeSize) p.pipeSize = String(derivedSetup.pipeSize);
                    if (derivedSetup.wallThickness) p.wallThickness = String(derivedSetup.wallThickness);
                    if (derivedSetup.wps) p.wps = [String(derivedSetup.wps)];
                    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
                }
            });
        }

        await test.step('⚙️ Perform Project Setup', async () => {
            await setupPage.performSetup(project.projectName);
        });
    } else {
        console.log("⏩ Skipping Setup (Disabled in FlowControl)");
    }

    // ----------------------------
    // 🖥️ STEP 7: DEVICE SYNC (STEP 2)
    // ----------------------------
    // We use the 'deviceSync' flag from flowControl, combined with general config
    if (isDeviceRegConfigured && !isMultiBrowser && fc.deviceSync) {
        await test.step('🖥️ Run Device Sync (Step 2)', async () => {
            try {
                const output = execSync(`node "${scriptPath}" --step=2`, { encoding: 'utf-8' });
                console.log(output);
            } catch (error) {
                console.error(error.stdout);
                throw error;
            }
        });
    } else {
        console.log("⏩ Skipping Device Sync (Step 2)");
    }

    // ----------------------------
    // 📊 PRODUCTION & ANALYSIS BLOCK
    // ----------------------------
    if (fc.productionAnalysis) {
    // ----------------------------
    // � STEP 8: OPEN PROJECT
    // ----------------------------
        await helper.selectProject(project.projectName);

    // ----------------------------
    // 📊 STEP 9: PRODUCTION TAB
    // ----------------------------
    await test.step('📊 Verify Production Tab Data', async () => {
        const productionTab = page.getByRole('tab', { name: /Production/i });
        await productionTab.click();

        await expect(productionTab).toHaveAttribute('aria-selected', 'true');

        const weldRows = page.locator('table tbody tr');
        await weldRows.first().waitFor({ state: 'visible' });

        const count = await weldRows.count();
        console.log(`✅ Weld Count: ${count}`);
        expect(count, 'Production table should have at least one weld row').toBeGreaterThan(0);
    });

    // ----------------------------
    // 🔁 STEP 10: SLOPE LOOP
    // ----------------------------
        for (const slope of project.slopeCombinations) {

            console.log(`🚀 In=${slope.slopeIn}, Out=${slope.slopeOut}`);

            await status.applyStatusConfiguration(
                slope.slopeIn,
                slope.slopeOut
            );

            // ----------------------------
            // ⚡ RUN ANALYSIS & EXTRACTION
            // ----------------------------
            const extractor = new BoltDBTxtFileTOExcel();
            
            await Promise.all([
                analysis.runFlow(targetWeldId, null, project.projectName),
                extractor.run(slope.slopeIn, slope.slopeOut, project.projectName, project.sourceFile)
            ]);

            // ----------------------------
            // 🧪 STEP 11: COMPARE
            // ----------------------------
            if (fc.comparison) {
                await test.step(`🧪 Run Comparison (In:${slope.slopeIn}, Out:${slope.slopeOut})`, async () => {
                    const hasDiffs = await compare.runAutoCompare(
                        project.projectName,
                        targetWeldId
                    );
                    // Assert that there are no failures (hasDiffs should be false)
                    expect.soft(hasDiffs, 'Excel Comparison should not have failures').toBe(false);
                });
            } else {
                console.log("⏩ Skipping Comparison (Disabled in FlowControl)");
            }
        }
    } else {
        console.log("⏩ Skipping Production Analysis (Disabled in FlowControl)");
    }

    console.log("🎉 END-TO-END FLOW COMPLETED");
});
