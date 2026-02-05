const { test } = require('@playwright/test');
const LoginAndProjectPage = require('../pages/loginAndProject.page');
const ProductionPassAnalysisPage = require('../pages/productionPassAnalysis.page');

test('FULL PRODUCTION → TABS (PASS, ZONE, TILT) → DATA ANALYSIS FLOW', async ({ page }) => {
  const login = new LoginAndProjectPage(page);
  const analysis = new ProductionPassAnalysisPage(page);

  await login.loginAndOpenProject();
  
  // This will handle Weld Summary, then iterate through each Production row,
  // scanning Pass, Zone, and Tilt tabs for each.
  await analysis.runFlow(1); // Set limit to 1 for initial testing

  console.log('🎉 FULL FLOW COMPLETED SUCCESSFULLY');
});

