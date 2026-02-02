const { test } = require('@playwright/test');

const LoginAndProjectPage = require('../pages/loginAndProject.page');
const ProductionPassAnalysisPage = require('../pages/productionPassAnalysis.page');
const StatusConfigPage = require('../pages/statusConfig.page');

test('FULL PRODUCTION → PASS → DATA ANALYSIS → STATUS CONFIG', async ({ page }) => {
  const login = new LoginAndProjectPage(page);
  const analysis = new ProductionPassAnalysisPage(page);
  const status = new StatusConfigPage(page);

  await login.loginAndOpenProject();
  const redValues = await analysis.collectRedValues();
  await status.applyStatusConfig(redValues);

  console.log('🎉 FULL FLOW COMPLETED SUCCESSFULLY');
});
