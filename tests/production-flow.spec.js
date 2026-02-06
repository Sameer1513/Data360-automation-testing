
// const { test } = require('@playwright/test');
// const LoginAndProjectPage = require('../pages/loginAndProject.page');
// const ProductionPassAnalysisPage = require('../pages/productionPassAnalysis.page');
// // 1. Import your new extractor
// const ActualDataExtractor = require('../pages/actualdata.page'); 

// test('FULL PRODUCTION → TABS (PASS, ZONE, TILT) → DATA ANALYSIS FLOW', async ({ page }) => {
//   const login = new LoginAndProjectPage(page);
//   const analysis = new ProductionPassAnalysisPage(page);
//   const extractor = new ActualDataExtractor(); // 2. Initialize it

//   // Step 1: Login (This must happen first)
//   await login.loginAndOpenProject();
  
//   console.log('🚀 Starting UI Analysis and Text Extraction in parallel...');

//   // Step 2: Run both in parallel
//   // This starts runFlow AND the file extraction at the same time.
//   await Promise.all([
//     analysis.runFlow(1), 
//     extractor.run()
//   ]);

//   console.log('🎉 FULL FLOW AND DATA EXTRACTION COMPLETED');
// });

const { test } = require('@playwright/test');
// Comment out the UI pages for now
// const LoginAndProjectPage = require('../pages/loginAndProject.page');
// const ProductionPassAnalysisPage = require('../pages/productionPassAnalysis.page');

// 1. Keep only the extractor import
const ActualDataExtractor = require('../pages/actualdata.page'); 

test('TESTING ONLY: Actual Data Extraction', async ({ page }) => {
  // We don't need 'page' for the extractor, but we keep it in the function signature
  
  console.log('🧪 DEBUG: Starting isolated data extraction...');
  
  const extractor = new ActualDataExtractor(); 

  try {
    // 2. Run ONLY the extraction logic
    const outputPath = await extractor.run();
    console.log(`✅ SUCCESS: File generated at ${outputPath}`);
  } catch (error) {
    console.error(`❌ EXTRACTION FAILED: ${error.message}`);
    throw error; // This will make the Playwright test show as "failed" in the report
  }
});