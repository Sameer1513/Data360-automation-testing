const { test, expect } = require('@playwright/test');
const path = require('path');
const ProductionTabAssertion = require('../Assertions/ProductionTabAssertion');
const {
  loadFlowConfig,
  getCore,
  buildSlopeVariants,
  prepareDataFromConfig,
  createRuntime,
  runPrereqToProduction,
  updateDerivedSetupInConfig
} = require('./helpers/flow-fixture');

const SPEC_CONFIG = path.join(process.cwd(), 'config/modular/login-productiontabwelddata.json');

test.describe.serial('Login + ProductionTabWeldData modular flow', () => {
  let flowConfig;
  let core;
  let derivedSetup;
  let runtime;
  let page;

  test.beforeAll(async () => {
    flowConfig = loadFlowConfig(SPEC_CONFIG);
    core = getCore(flowConfig);
    const prep = await prepareDataFromConfig(flowConfig);
    derivedSetup = prep.derivedSetup;
    updateDerivedSetupInConfig(derivedSetup, flowConfig);
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

  test('UI Analysis variants: without slope, slope in/out, value changes', async () => {
    const info = test.info();
    const variants = buildSlopeVariants(core.project);

    for (const slope of variants) {
      await runtime.status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);
      const out = await runtime.analysis.runFlow(core.targetWeldId, null, core.project.projectName);

      expect(out?.filepath, `Missing output file for ${slope.label}`).toBeTruthy();
      expect(Array.isArray(out?.results), `Missing results for ${slope.label}`).toBeTruthy();

      const pa = new ProductionTabAssertion(runtime.page, runtime.helper);
      await pa.attachUIAnalysisSummary(out.results, info);
    }
  });

  test('Weld ID filter checks should work for all configured weld IDs', async () => {
    const ids = Array.isArray(core.project.weldIds) ? core.project.weldIds : [];
    test.skip(ids.length === 0, 'No weldIds configured for filter checks');

    await runtime.status.applyStatusConfiguration(0, 0);

    for (const id of ids) {
      const out = await runtime.analysis.runFlow([String(id)], 1, core.project.projectName);
      const weldRows = (out.results || []).filter(r => r.type === 'weld');
      expect(weldRows.length, `No weld result for filter ${id}`).toBeGreaterThan(0);
      expect(weldRows[0].pass, `Filter failed for weld ${id}`).toBe(true);
    }
  });
});
