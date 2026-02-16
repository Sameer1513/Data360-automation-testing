const fs = require('fs');
const path = require('path');
const { test, chromium } = require('@playwright/test');

const LoginAndProjectPage = require('../pages/loginAndProject.page');
const StatusConfigPage = require('../pages/statusConfig.page');
const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
const ComparePage = require('../pages/compare.page');

// --------------------
// LOAD CONFIG
// --------------------
const configPath = path.join(__dirname, '../config/Combinations.json');
const flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const scanConfig = flowConfig.scanConfig;

// --------------------
// HELPERS
// --------------------
function resolveTargetWelds(weldIds) {
  if (!weldIds || weldIds.length === 0) return null;
  return weldIds;
}

async function runSingleFlow(page, projectConfig) {
  const login = new LoginAndProjectPage(page);
  const status = new StatusConfigPage(page);
  const analysis = new ProductionTabWeldData(page, flowConfig.scanConfig);
  const extractor = new BoltDBTxtFileTOExcel();
  const compare = new ComparePage();

  const targetWeldId = resolveTargetWelds(projectConfig.weldIds);

  await login.loginAndOpenProject(projectConfig.projectName);

  for (const slope of projectConfig.slopeCombinations) {
    console.log(
      `🚀 Project=${projectConfig.projectName} | In=${slope.slopeIn} | Out=${slope.slopeOut} | Welds=${targetWeldId || 'ALL'}`
    );

    await status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);

    console.log('⏳ Synchronizing Production Table...');
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });

    console.log('⚡ Running Analysis & Extraction in Parallel...');
    await Promise.all([
      // Added projectConfig.projectName here
      analysis.runFlow(targetWeldId, null, projectConfig.projectName), 
      // Added projectConfig.projectName here
      extractor.run(slope.slopeIn, slope.slopeOut, projectConfig.projectName, projectConfig.sourceFile),
    ]);

    console.log('🧪 Running Auto-Comparison...');
    // Added projectConfig.projectName here
    await compare.runAutoCompare(projectConfig.projectName, targetWeldId);
  }
}

// --------------------
// MAIN TEST
// --------------------
test('Production Flow – Config Driven', async ({ page }) => {

  // 1. If we are in multi-mode, kill the automatic blank browser immediately
  if (flowConfig.mode === 'multiProject' || flowConfig.mode === 'multiBrowser') {
    await page.close(); 
  }

  // --------------------
  // MODE: SINGLE PROJECT
  // --------------------
  if (flowConfig.mode === 'single') {
    await runSingleFlow(page, flowConfig.singleProject);
    return;
  }

  // --------------------
  // MODE: MULTI PROJECT
  // --------------------
  if (flowConfig.mode === 'multiProject') {
  await page.close(); // Close the runner browser

  // Use map to create an array of promises
  const projectPromises = flowConfig.multiProject.map(async (project) => {
    // Isolated browser instance for EACH project
    const browser = await chromium.launch(); 
    const context = await browser.newContext();
    const projectPage = await context.newPage();

    try {
      console.log(`▶️ Starting: ${project.projectName} (ID: ${project.browserId})`);
      await runSingleFlow(projectPage, project);
      console.log(`✅ Finished: ${project.projectName}`);
    } catch (err) {
      console.error(`❌ Error in ${project.projectName}:`, err);
    } finally {
      await browser.close(); // Only close THIS browser
    }
  });

  // Wait for all to finish, regardless of who finishes first
  await Promise.allSettled(projectPromises); 
  return;
}
  // --------------------
  // MODE: MULTI BROWSER (Note: You had a few undefined variable errors here too)
  // --------------------
  if (flowConfig.mode === 'multiBrowser') {
    await Promise.all(
      flowConfig.multiBrowser.map(async (browserCfg) => {
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const mbPage = await context.newPage();

        const login = new LoginAndProjectPage(mbPage);
        const status = new StatusConfigPage(mbPage);
        const analysis = new ProductionTabWeldData(mbPage);
        const extractor = new BoltDBTxtFileTOExcel();
        const compare = new ComparePage();

        console.log(`🌐 Browser-${browserCfg.browserId} | Project=${browserCfg.projectName}`);

        await login.loginAndOpenProject(browserCfg.projectName);
        await status.applyStatusConfiguration(browserCfg.slope.slopeIn, browserCfg.slope.slopeOut);

        await mbPage.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });
        
        await Promise.all([
          analysis.runFlow(resolveTargetWelds(browserCfg.weldIds), null, browserCfg.projectName),
          extractor.run(browserCfg.slope.slopeIn, browserCfg.slope.slopeOut, browserCfg.projectName, browserCfg.sourceFile),
        ]);

        await compare.runAutoCompare(browserCfg.projectName);
        await browser.close();
      })
    );
  }
});


// const { test } = require('@playwright/test');
// // Ensure the path correctly points to your pages folder
// const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');

// test('Verify Weld Time in Actual Data', async () => {
//     console.log("⚡ Testing Actual Data Flow...");
//     const extractor = new BoltDBTxtFileTOExcel();

//     // Run extraction with 0 slope to test raw timing logic
//     await extractor.run(0, 0); 
    
//     console.log("✅ Success! Check the 'exports' folder.");
// });