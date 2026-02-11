
// for executing only the actualdata script

// const { test } = require('@playwright/test');
//         // Comment out the UI pages for now
// const LoginAndProjectPage = require('../pages/loginAndProject.page');
// const ProductionPassAnalysisPage = require('../pages/productionPassAnalysis.page');

//           // 1. Keep only the extractor import
// const ActualDataExtractor = require('../pages/actualdata.page'); 

// test('TESTING ONLY: Actual Data Extraction', async ({ page }) => {
//   // We don't need 'page' for the extractor, but we keep it in the function signature
  
//   console.log('🧪 DEBUG: Starting isolated data extraction...');
  
//   const extractor = new ActualDataExtractor(); 

//   try {
//     // 2. Run ONLY the extraction logic
//     const outputPath = await extractor.run();
//     console.log(`✅ SUCCESS: File generated at ${outputPath}`);
//   } catch (error) {
//     console.error(`❌ EXTRACTION FAILED: ${error.message}`);
//     throw error; // This will make the Playwright test show as "failed" in the report
//   }
// });


// for executing only the compare script

// const { test } = require('@playwright/test');
// const ComparePage = require('../pages/compare.page'); 

// test('TESTING ONLY: Compare Isolated Files', async () => {
//   const compare = new ComparePage();
  
//   console.log('🧪 Starting isolated comparison...');

//   // The Page Object now handles finding the files automatically
//   await compare.runAutoCompare();

//   console.log('✅ Done.');
// });


// slope in and out 

const { test, expect } = require('@playwright/test');
const LoginAndProjectPage = require('../pages/loginAndProject.page');
const StatusConfigPage = require('../pages/statusConfig.page');
const ProductionTabWeldData = require('../pages/ProductionTabWeldData.page');
const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page'); 
const ComparePage = require('../pages/compare.page');

test('Production Flow: Fast Script-Based Input', async ({ page }) => {
  // --- STEP 1: DEFINE INPUTS DIRECTLY ---
  // Change these numbers here whenever you want to test different slopes
  const slopes = {
    slopeIn: 4, 
    slopeOut: 3
  };

  const login = new LoginAndProjectPage(page);
  const status = new StatusConfigPage(page);
  const analysis = new ProductionTabWeldData(page);
  const extractor = new BoltDBTxtFileTOExcel();
  const compare = new ComparePage(); 

  console.log(`🚀 Starting Flow with: In=${slopes.slopeIn}, Out=${slopes.slopeOut}`);

  // --- STEP 2: LOGIN & PROJECT ---
  await login.loginAndOpenProject();

  // --- STEP 3: STATUS CONFIGURATION ---
  // Logic inside this method will skip the menu if values are 0
  await status.applyStatusConfiguration(slopes.slopeIn, slopes.slopeOut);

  // --- STEP 4: MANDATORY TABLE WAIT ---
  console.log('⏳ Synchronizing Production Table...');
  await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });

  // --- STEP 5: PARALLEL TASKS ---
  console.log('⚡ Running Analysis & Extraction in Parallel...');
  await Promise.all([
    analysis.runFlow(1).then(() => console.log('✅ Analysis Complete.')),
    extractor.run(slopes.slopeIn, slopes.slopeOut).then(() => console.log('✅ Extraction Complete.'))
  ]);

  // --- STEP 6: AUTO COMPARE ---
  console.log('🧪 Running Auto-Comparison...');
  await compare.runAutoCompare();

  console.log('✅ COMPLETE: Flow finished successfully.');
});