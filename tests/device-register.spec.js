const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  configPath,
  loadFlowConfig,
  getCore,
  runDeviceRegisterStep
} = require('./helpers/flow-fixture');

const SPEC_CONFIG = path.join(process.cwd(), 'config/modular/device-register.json');

test.describe.serial('Device register modular flow', () => {
  let flowConfig;
  let core;

  test.beforeAll(() => {
    flowConfig = loadFlowConfig(SPEC_CONFIG);
    core = getCore(flowConfig);
  });

  test('Device Register step-1 should capture device id', async () => {
    const isDeviceRegConfigured = flowConfig.deviceRegistration && flowConfig.deviceRegistration.enabled !== false;
    const isMultiBrowser = flowConfig.mode === 'multiBrowser';
    const shouldRun = isDeviceRegConfigured && !isMultiBrowser && core.fc.deviceRegistration;
    test.skip(!shouldRun, 'Device registration disabled by flowControl/config');

    const resetConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    delete resetConfig.capturedDeviceId;
    fs.writeFileSync(configPath, JSON.stringify(resetConfig, null, 2));

    await runDeviceRegisterStep(1);

    const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(updated.capturedDeviceId, 'capturedDeviceId not found in Combinations.json').toBeTruthy();
  });
});
