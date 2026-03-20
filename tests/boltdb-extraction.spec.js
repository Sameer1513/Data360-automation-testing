const { test, expect } = require('@playwright/test');
const path = require('path');
const BoltDBTxtFileTOExcel = require('../pages/BoltDBTxtFileTOExcel.page');
const {
  loadFlowConfig,
  getCore,
  buildSlopeVariants,
  prepareDataFromConfig
} = require('./helpers/flow-fixture');

const SPEC_CONFIG = path.join(process.cwd(), 'config/modular/boltdb-extraction.json');

test.describe.serial('BoltDB extraction modular flow', () => {
  let flowConfig;
  let core;

  test.beforeAll(async () => {
    flowConfig = loadFlowConfig(SPEC_CONFIG);
    core = getCore(flowConfig);
    await prepareDataFromConfig(flowConfig);
  });

  test('Generate actual data for multiple text files and slope variants', async () => {
    test.skip(!core.fc.BoltDBExcel, 'BoltDB Excel disabled by flowControl');

    const variants = buildSlopeVariants(core.project);
    const sourceFiles = Array.isArray(core.project.sourceFiles) && core.project.sourceFiles.length
      ? core.project.sourceFiles
      : [core.project.sourceFile];

    // Verify once: merge all source files into one BoltD workbook per slope variant.
    for (const slope of variants) {
      const extractor = new BoltDBTxtFileTOExcel();
      const statusConfigPath = core.project.statusConfigPath ? path.join(process.cwd(), core.project.statusConfigPath) : null;
      const weldParamsPath = core.project.weldParamsPath ? path.join(process.cwd(), core.project.weldParamsPath) : null;

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
    }
  });
});
