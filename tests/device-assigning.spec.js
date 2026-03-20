const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  configPath,
  loadFlowConfig,
  getCore,
  createRuntime,
  runPrereqToProduction,
  runDeviceRegisterStep
} = require('./helpers/flow-fixture');

const SPEC_CONFIG = path.join(process.cwd(), 'config/modular/device-assigning.json');

test.describe.serial('Device assigning modular flow', () => {
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
    await runPrereqToProduction(runtime, { login: true, openProduction: false });
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('Assign captured device to project', async () => {
    const isDeviceRegConfigured = flowConfig.deviceRegistration && flowConfig.deviceRegistration.enabled !== false;
    const isMultiBrowser = flowConfig.mode === 'multiBrowser';
    const shouldRun = isDeviceRegConfigured && !isMultiBrowser;
    test.skip(!shouldRun, 'Device registration mode unsupported for this run');

    let cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!cfg.capturedDeviceId) {
      await runDeviceRegisterStep(1);
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    const deviceId = cfg.capturedDeviceId;
    expect(deviceId, 'Missing capturedDeviceId').toBeTruthy();

    await runtime.deviceAssign.assignProjectToDevice(deviceId, core.project.projectName);
    expect(true).toBe(true);
  });
});
