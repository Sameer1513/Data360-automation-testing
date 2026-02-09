
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


// for executing only the actualdata script

// const { test } = require('@playwright/test');
// // Comment out the UI pages for now
// // const LoginAndProjectPage = require('../pages/loginAndProject.page');
// // const ProductionPassAnalysisPage = require('../pages/productionPassAnalysis.page');

// // 1. Keep only the extractor import
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


// all at once
const { test } = require('@playwright/test');
const LoginAndProjectPage = require('../pages/loginAndProject.page');
const ProductionPassAnalysisPage = require('../pages/productionPassAnalysis.page');
const ActualDataExtractor = require('../pages/actualdata.page'); 
const ComparePage = require('../pages/compare.page'); 

test('FULL PRODUCTION FLOW: Extraction followed by Auto-Comparison', async ({ page }) => {
  // Initialize Page Objects
  const login = new LoginAndProjectPage(page);
  const analysis = new ProductionPassAnalysisPage(page);
  const extractor = new ActualDataExtractor(); 
  // Ensure the constructor in compare.page.js matches this call
  const compare = new ComparePage(page); 

  // --- PART 1: GENERATE THE EXCEL FILES ---
  
  // Step 1: Login
  await login.loginAndOpenProject();
  
  console.log('🚀 Starting UI Analysis and Text Extraction...');

  // Step 2: Run Analysis and Extraction in parallel
  // We wait for this to finish so the files actually exist on disk
  await Promise.all([
    analysis.runFlow(1), 
    extractor.run()
  ]);

  console.log('🎉 DATA EXTRACTION COMPLETED. Checking for files...');

  // --- PART 2: COMPARE THE GENERATED FILES ---

  console.log('🧪 Starting automated comparison of generated excels...');

  // This will only run AFTER the Promise.all above has resolved
  await compare.runAutoCompare();

  console.log('✅ ALL PROCESSES COMPLETED SUCCESSFULLY.');
});