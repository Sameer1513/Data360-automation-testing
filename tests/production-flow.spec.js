const fs = require('fs');
const path = require('path');
const { test, chromium } = require('@playwright/test');

const LoginAndProjectPage = require('../pages/loginAndProject.page');
const StatusConfigPage = require('../pages/statusConfig.page');
// const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
// const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
// const ComparePage = require('../pages/compare.page');
const StatusConfigPass = require('../pages/StatusConfigPass.page');
// const WeldParameterExcel = require('../pages/WeldParameterExcel.page');
const WeldParametersCsvToExcel = require('../pages/WeldParametersCsvToExcel.page');
const StatusConfigCompare = require('../pages/statusConfigCompare.page');


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
  // const analysis = new ProductionTabWeldData(page, flowConfig.scanConfig);
  // const extractor = new BoltDBTxtFileTOExcel();
  // const compare = new ComparePage();
  const statusPass = new StatusConfigPass(page);
  // const weldExcel = new WeldParameterExcel(page);
  const csvToExcel = new WeldParametersCsvToExcel();



  // const targetWeldId = resolveTargetWelds(projectConfig.weldIds);

  await login.loginAndOpenProject(projectConfig.projectName);

  for (const slope of projectConfig.slopeCombinations) {
    // console.log(
    // `🚀 Project=${projectConfig.projectName} | In=${slope.slopeIn} | Out=${slope.slopeOut} | Welds=${targetWeldId || 'ALL'}`
    // );

    await status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);

    console.log('⏳ Synchronizing Production Table...');
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });

    // console.log('⚡ Running Analysis & Extraction in Parallel...');
    // await Promise.all([
    // analysis.runFlow(targetWeldId),
    // extractor.run(slope.slopeIn, slope.slopeOut),
    // ]);

    // console.log('🧪 Running Auto-Comparison...');
    // await compare.runAutoCompare();
    console.log('📊 Extracting Final Status Configuration Snapshot...');
    // 1️⃣ Generate StatusConfigPass Excel and capture its path
const uiData = await statusPass.run(
  projectConfig.projectName,
  slope.slopeIn,
  slope.slopeOut
);

// 2️⃣ Generate Weld Parameters Excel
// await weldExcel.run(
//   projectConfig.projectName,
//   slope.slopeIn,
//   slope.slopeOut
// );

// 3️⃣ Convert CSV to Excel and capture path
const csvExcelPath = await csvToExcel.run();

// 4️⃣ Create StatusConfigCompare with BOTH files
const statusCompare = new StatusConfigCompare(
  csvExcelPath,
  uiData
);

await statusCompare.run();
  }
}

// --------------------
// MAIN TEST
// --------------------
test('Production Flow – Config Driven', async ({ page }) => {

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
  await Promise.all(
    flowConfig.multiProject.map(async (project) => {
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();

      console.log(
        `🌐 Browser-${project.browserId} | Project=${project.projectName}`
      );

      await runSingleFlow(page, project);

      await browser.close();
    })
  );
  return;
}

  // --------------------
  // MODE: MULTI BROWSER
  // --------------------
  if (flowConfig.mode === 'multiBrowser') {
    await Promise.all(
      flowConfig.multiBrowser.map(async (browserCfg) => {
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();

        const login = new LoginAndProjectPage(page);
        const status = new StatusConfigPage(page);
        const analysis = new ProductionTabWeldData(page);
        const extractor = new BoltDBTxtFileTOExcel();
        const compare = new ComparePage();

        const targetWeldId = resolveTargetWelds(browserCfg.weldIds);

        console.log(
          `🌐 Browser-${browserCfg.browserId} | Project=${browserCfg.projectName}`
        );

        await login.loginAndOpenProject(browserCfg.projectName);
        await status.applyStatusConfiguration(
          browserCfg.slope.slopeIn,
          browserCfg.slope.slopeOut
        );

        await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });

        await Promise.all([
          analysis.runFlow(targetWeldId),
          extractor.run(browserCfg.slope.slopeIn, browserCfg.slope.slopeOut),
        ]);

        await compare.runAutoCompare();
        await browser.close();
      })
    );
  }
});