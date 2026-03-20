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
const {
  WeldParametersCsvToExcel,
  WeldParametersXmlToExcel
} = require('../pages/WeldParameterFIleToExcel.page.js');

const SPEC_CONFIG = path.join(process.cwd(), 'config/modular/login-production-statusconfig-boltdb.json');

test.describe.serial('LoginPage-production-statusconfig-boltdb-compare (modular)', () => {
  let flowConfig;
  let core;
  let runtime;
  let page;

  let weldParamsPath = null;

  test.beforeAll(async () => {
    flowConfig = loadFlowConfig(SPEC_CONFIG);
    core = getCore(flowConfig);

    const inputFile = core.project.weldParamsInputFile;
    if (inputFile) {
      if (inputFile.toLowerCase().endsWith('.csv')) {
        weldParamsPath = await new WeldParametersCsvToExcel(inputFile).run();
      } else if (inputFile.toLowerCase().endsWith('.xml')) {
        weldParamsPath = await new WeldParametersXmlToExcel(inputFile).run();
      }
    }

    expect(weldParamsPath, 'Weld Parameters Excel (for limits/red circles) not generated').toBeTruthy();
  });

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    runtime = createRuntime(page, flowConfig);

    await runPrereqToProduction(runtime, {
      login: true,
      create: false,
      setup: false,
      specification: false,
      openProduction: true
    });
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('Slope in/out + limits (red circle) + production compare', async () => {
    const info = test.info();
    const variants = buildSlopeVariants(core.project);
    const sourceFiles = Array.isArray(core.project.sourceFiles) && core.project.sourceFiles.length
      ? core.project.sourceFiles
      : [core.project.sourceFile];

    for (const slope of variants) {
      // 1) Apply slope/time in UI
      await runtime.status.applyStatusConfiguration(slope.slopeIn, slope.slopeOut);

      // 2) Create StatusConfig UI Excel (this is what BoltDB uses for limits)
      const statusOut = await runtime.statusConfigPass.run(core.project.projectName, slope.slopeIn, slope.slopeOut);
      const statusConfigPath = statusOut?.filePath || statusOut?.filePath;
      expect(statusConfigPath, `Missing StatusConfig excel for ${slope.label}`).toBeTruthy();

      // 3) Back to Production table
      await runtime.statusConfigPass.goBackToProduction();

      // 4) Production extraction (creates latest Production_Report_*.xlsx)
      const prodOut = await runtime.analysis.runFlow(core.targetWeldId, null, core.project.projectName);
      expect(prodOut?.filepath, `No production file for ${slope.label}`).toBeTruthy();

      const pa = new ProductionTabAssertion(runtime.page, runtime.helper);
      await pa.attachUIAnalysisSummary(prodOut.results || [], info);

      // 5) Actual data extraction (BoltDB) -> creates latest BoltD_*.xlsx with red circles
      const extractor = new BoltDBTxtFileTOExcel();
      const { outputPath } = await extractor.run(
        slope.slopeIn,
        slope.slopeOut,
        core.project.projectName,
        sourceFiles,
        core.fc.BoltDBExcel,
        statusConfigPath,
        weldParamsPath,
        core.project.unitConfig || null
      );
      expect(outputPath, `No BoltDB output for ${sourceFiles.join(', ')} / ${slope.label}`).toBeTruthy();

      // 6) Compare (optional by flowControl)
      if (core.fc.comparison) {
        const cmp = await runtime.compare.runAutoCompare(core.project.projectName, core.targetWeldId);
        expect(cmp.reportPath, `No comparison report for ${slope.label}`).toBeTruthy();
        expect(cmp.hasFailure, `Comparison mismatch for ${slope.label}`).toBe(false);
      }
    }
  });
});
