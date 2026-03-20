const { test, expect } = require('@playwright/test');
const path = require('path');
const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
const ProductionTabAssertion = require('../Assertions/ProductionTabAssertion');
const {
  loadFlowConfig,
  getCore,
  buildSlopeVariants,
  createRuntime,
  runPrereqToProduction
} = require('./helpers/flow-fixture');

const SPEC_CONFIG = path.join(process.cwd(), 'config/modular/compare.json');

test.describe.serial('Compare modular flow', () => {
  let flowConfig;
  let core;
  let runtime;
  let page;

  test.beforeAll(() => {
    flowConfig = loadFlowConfig(SPEC_CONFIG);
    core = getCore(flowConfig);
  });

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    runtime = createRuntime(page, flowConfig);
    await runPrereqToProduction(runtime, {
      login: true,
      create: true,
      setup: true,
      specification: false,
      openProduction: true
    });
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('Run compare for slope variants', async () => {
    test.skip(!core.fc.comparison, 'Comparison disabled by flowControl');

    const variants = buildSlopeVariants(core.project);

    for (const slope of variants) {
      const extractor = new BoltDBTxtFileTOExcel();
      const statusConfigPath = core.project.statusConfigPath ? path.join(process.cwd(), core.project.statusConfigPath) : null;
      const weldParamsPath = core.project.weldParamsPath ? path.join(process.cwd(), core.project.weldParamsPath) : null;

      await extractor.run(
        slope.slopeIn,
        slope.slopeOut,
        core.project.projectName,
        core.project.sourceFile,
        core.fc.BoltDBExcel,
        statusConfigPath,
        weldParamsPath,
        core.project.unitConfig || null
      );

      await runtime.status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);
      const out = await runtime.analysis.runFlow(core.targetWeldId, null, core.project.projectName);
      const pa = new ProductionTabAssertion(runtime.page, runtime.helper);
      await pa.attachUIAnalysisSummary(out.results || [], test.info());

      const cmp = await runtime.compare.runAutoCompare(core.project.projectName, core.targetWeldId);
      expect(cmp.reportPath, `No comparison report for ${slope.label}`).toBeTruthy();
      expect(cmp.hasFailure, `Comparison mismatch for ${slope.label}`).toBe(false);
    }
  });
});
