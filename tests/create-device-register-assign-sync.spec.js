const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LoginAndProjectPage = require('../pages/loginAndProject.page');
const CreateProjectPage = require('../pages/createproject.page');
const DeviceAssigningPage = require('../pages/DeviceAssigning.page');
const { ProjectsPage } = require('../Locators/ProjectsPage');
const CommonHelper = require('../Helper/CommonHelper');
const LoginAssertion = require('../Assertions/LoginAssertion');
const CreateDeviceRegisterAssignSyncAssertion = require('../Assertions/create-device-register-assign-sync-assertion');
const { cleanupProjectByFirstTile } = require('../utils/projectCleanup.util');
const { waitForProductionFlowTerminalSyncDone } = require('./helpers/production-flow-terminal-gate');

const baseConfigPath = path.join(process.cwd(), 'config/Combinations.json');
const SPEC_CONFIG_PATH = path.join(process.cwd(), 'config/modular/create-device-register-assign-sync.json');

function loadSpecConfig() {
  return JSON.parse(fs.readFileSync(SPEC_CONFIG_PATH, 'utf-8'));
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function applySyncToDeviceRegisterStep2(baseConfig, sync) {
  const dbFiles = Array.isArray(sync?.dbFiles) ? sync.dbFiles : [];
  const paramFile = sync?.paramFile || '';

  baseConfig.deviceRegistration = baseConfig.deviceRegistration || {};
  baseConfig.deviceRegistration.step2 = baseConfig.deviceRegistration.step2 || {};

  baseConfig.deviceRegistration.step2.enabled = true;
  baseConfig.deviceRegistration.step2.files = dbFiles.map(db => ({
    exe: '',
    db,
    param: paramFile
  }));
}

async function runDeviceRegisterStep(step) {
  const scriptPath = path.join(process.cwd(), 'terminal_execution_files', 'device_register.js');
  return await new Promise((resolve) => {
    const child = spawn('node', [scriptPath, `--step=${step}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    let output = '';
    const hardTimeoutMs = Number(process.env.DEVICE_REGISTER_STEP_TIMEOUT_MS || 10 * 60 * 1000);
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_) {
        // ignore kill errors
      }
      resolve({
        ok: false,
        exitCode: null,
        output: `${output}\n[timeout] device_register step ${step} exceeded ${hardTimeoutMs}ms`
      });
    }, hardTimeoutMs);

    const collect = (chunk, isErr) => {
      const s = chunk.toString();
      output += s;
      // Keep terminal output visible while still capturing it for assertions.
      if (isErr) process.stderr.write(s);
      else process.stdout.write(s);
    };

    child.stdout.on('data', (d) => collect(d, false));
    child.stderr.on('data', (d) => collect(d, true));

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, exitCode: code, output });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, exitCode: null, output: `${output}\n${String(err?.message || err)}` });
    });
  });
}

async function runCaseWithBrowser(browser, caseDef, options = {}) {
  const originalBaseConfig = deepClone(JSON.parse(fs.readFileSync(baseConfigPath, 'utf-8')));
  const cleanupCreatedProjects = options.cleanupCreatedProjects === true;
  const createdProjectNames = [];

  const baseConfigLive = deepClone(originalBaseConfig);
  delete baseConfigLive.capturedDeviceId;

  const syncRuns = Array.isArray(caseDef.syncRuns)
    ? caseDef.syncRuns
    : (caseDef.sync ? [caseDef.sync] : []);
  const requireDataSync = caseDef.requireDataSync !== false;
  if (requireDataSync) {
    expect(syncRuns.length, `${caseDef.id}: missing sync config`).toBeGreaterThan(0);
  }

  const projectCount = Number(caseDef.projectCount || 1);
  const syncMode = caseDef.syncMode || 'assignThenSyncAll'; // assignThenSyncAll | serialPerProject

  // Set step2 files for the first sync run before step1 (only if data sync is required).
  if (requireDataSync && syncRuns.length > 0) {
    applySyncToDeviceRegisterStep2(baseConfigLive, syncRuns[0]);
    fs.writeFileSync(baseConfigPath, JSON.stringify(baseConfigLive, null, 2));
  } else {
    fs.writeFileSync(baseConfigPath, JSON.stringify(baseConfigLive, null, 2));
  }

  let page;
  try {
    page = await browser.newPage();
    const testInfo = test.info();
    const helper = new CommonHelper(page);

    const login = new LoginAndProjectPage(page);
    const createPage = new CreateProjectPage(page);
    const deviceAssign = new DeviceAssigningPage(page);

    // 1) Login
    await new LoginAssertion(login).run(test.info());

    const baseProjectNumber = Number(caseDef.createProjectData?.projectNumber || 0);

    const step2Runs = [];
    let deviceAssignedProjects = null;

    const getProjectName = (idx) => (projectCount === 1 ? caseDef.projectName : `${caseDef.projectName}-p${idx + 1}`);
    const getProjectNumber = (idx) => String(baseProjectNumber + idx);

    // 2) device_register step1 (captures capturedDeviceId into Combinations.json)
    // In serialPerProject mode we want: create project -> assign -> sync -> next project,
    // so we run step1 before creating projects.
    const step1Result = await runDeviceRegisterStep(1);
    let deviceId = '';
    let deviceIdOk = false;
    try {
      deviceId = await helper.waitForDeviceId(baseConfigPath, 60000);
      deviceIdOk = Boolean(deviceId);
    } catch (e) {
      deviceIdOk = false;
      deviceId = '';
    }

    if (!deviceIdOk) {
      await CreateDeviceRegisterAssignSyncAssertion.attach(test.info(), {
        caseId: caseDef.id,
        step1Output: step1Result.output,
        step2Runs: []
      });
      expect(deviceIdOk, `${caseDef.id}: capturedDeviceId missing`).toBeTruthy();
      return;
    }

    if (syncMode === 'serialPerProject') {
      for (let i = 0; i < projectCount; i++) {
        const projectName = getProjectName(i);
        createdProjectNames.push(projectName);

        await createPage.createProject({
          ...caseDef.createProjectData,
          projectName,
          projectNumber: getProjectNumber(i)
        });

        const expectFailure = Boolean(caseDef.expectedAssignFailure) && i > 0;
        const assignedResult = await deviceAssign.assignProjectToDevice(deviceId, projectName, {
          expectFailure,
          testInfo,
          screenshotPrefix: `${caseDef.id}-p${i + 1}`
        });

        // Expected negative condition (assignment must fail) => no need to run sync for that project attempt.
        if (expectFailure && !assignedResult) {
          continue;
        }

        for (const syncRun of syncRuns) {
          const liveConfig = JSON.parse(fs.readFileSync(baseConfigPath, 'utf-8'));
          applySyncToDeviceRegisterStep2(liveConfig, syncRun);
          fs.writeFileSync(baseConfigPath, JSON.stringify(liveConfig, null, 2));

          const step2Result = await runDeviceRegisterStep(2);
          step2Runs.push({
            dbLabel: Array.isArray(syncRun?.dbFiles) ? syncRun.dbFiles.join(', ') : '',
            output: step2Result.output
          });
        }
      }
    } else {
      // assignThenSyncAll:
      // create all projects -> assign once -> run sync step2 for each sync run.
      for (let i = 0; i < projectCount; i++) {
        const projectName = getProjectName(i);
        createdProjectNames.push(projectName);

        await createPage.createProject({
          ...caseDef.createProjectData,
          projectName,
          projectNumber: getProjectNumber(i)
        });
      }

      // Positive: assign individually for each created project.
      for (const pName of createdProjectNames) {
        await deviceAssign.assignProjectToDevice(deviceId, pName);
      }

      // Verify device assigned projects BEFORE running sync.
      deviceAssignedProjects = await deviceAssign.getAssignedProjectsForDevice(deviceId, {
        testInfo,
        screenshotPrefix: `${caseDef.id}-device`
      });

      for (const syncRun of syncRuns) {
        const liveConfig = JSON.parse(fs.readFileSync(baseConfigPath, 'utf-8'));
        applySyncToDeviceRegisterStep2(liveConfig, syncRun);
        fs.writeFileSync(baseConfigPath, JSON.stringify(liveConfig, null, 2));

        const step2Result = await runDeviceRegisterStep(2);
        step2Runs.push({
          dbLabel: Array.isArray(syncRun?.dbFiles) ? syncRun.dbFiles.join(', ') : '',
          output: step2Result.output
        });
      }
    }

    // Attach report table: register step1 + each data sync step2 run.
    await CreateDeviceRegisterAssignSyncAssertion.attach(testInfo, {
      caseId: caseDef.id,
      step1Output: step1Result.output,
      step2Runs,
      deviceAssignedProjects: typeof deviceAssignedProjects !== 'undefined' ? deviceAssignedProjects : null,
      createdProjectNames: typeof createdProjectNames !== 'undefined' ? createdProjectNames : null,
      requireDataSync
    });

    const step1Ok = /🎯 ID (Captured|Saved to config)/i.test(step1Result.output)
      || /✅ Step 1 completed successfully/i.test(step1Result.output);
    expect(step1Ok, `${caseDef.id}: device register step1 marker not found`).toBeTruthy();

    if (requireDataSync) {
      const step2OkAll = Array.isArray(step2Runs) &&
        step2Runs.length > 0 &&
        step2Runs.every(r => /✅ \[SYNC COMPLETE\]/i.test(r?.output || '')
          || /\(boltdb\) Get all logs:\s*Completed/i.test(r?.output || '')
          || /No new logs to publish/i.test(r?.output || '')
          || /Device registration and sync finished!/i.test(r?.output || ''));
      expect(step2OkAll, `${caseDef.id}: data sync step2 not completed (SYNC COMPLETE marker missing)`).toBeTruthy();
    }
  } finally {
    if (cleanupCreatedProjects && page) {
      try {
        const projectsPage = new ProjectsPage(page);
        for (const projectName of [...createdProjectNames].reverse()) {
          await cleanupProjectByFirstTile(projectsPage, projectName);
        }
      } catch (e) {
        console.warn(`Cleanup warning (${caseDef?.id || 'unknown-case'}): ${e.message}`);
      }
    }

    // Restore original config
    fs.writeFileSync(baseConfigPath, JSON.stringify(originalBaseConfig, null, 2));
    await page?.close();
  }
}

test.describe.serial('Device Register, Assign and Sync', () => {
  test.beforeAll(async () => {
    await waitForProductionFlowTerminalSyncDone();
  });

  const specCfg = loadSpecConfig();
  const cleanupCreatedProjects = specCfg?.cleanup?.deleteProjectsAfterEachTest === true;
  const cases = Array.isArray(specCfg.cases) ? specCfg.cases : [];

  const byId = cases.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  test('singleProject-Assign-SingleDataSync', async ({ browser }) => {
    test.setTimeout(60000);
    const c = byId.test1;
    test.skip(!c?.enabled, 'test1 disabled in json');
    await runCaseWithBrowser(browser, c, { cleanupCreatedProjects });
  });

  test('multiProj-Assign-SingleDataSyn', async ({ browser }) => {
    const c = byId.test2;
    test.skip(!c?.enabled, 'test2 disabled in json');
    await runCaseWithBrowser(browser, c, { cleanupCreatedProjects });
  });

  test('singleProj-Assign-MultipleDBSyn', async ({ browser }) => {
    const c = byId.test3;
    test.skip(!c?.enabled, 'test3 disabled in json');
    await runCaseWithBrowser(browser, c, { cleanupCreatedProjects });
  });
});
