const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { test } = require('@playwright/test');

// Page Objects / Helpers
const LoginAndProjectPage = require('../pages/loginAndProject.page');
const StatusConfigPage = require('../pages/statusConfig.page');
const StatusConfigPass = require('../pages/StatusConfigPass.page.js');
const StatusConfigCompare = require('../pages/statusConfigCompare.page.js');

const {
  WeldParametersCsvToExcel,
  WeldParametersXmlToExcel
} = require('../pages/WeldParameterFileToExcel.page.js');

const CommonHelper = require('../Helper/CommonHelper');
const assertion = require('../Helper/AssertionHelper.js');
const { sanitizeFolderName } = require('../Helper/excelNaming.util.js');
const { POManager } = require('../Locators/POManager');


/** Per-project export root: `exports/<projectName>/` (UI Excel, weld Excel, comparison). */
function resolveExportsProjectDir(projectName) {
  return path.join(process.cwd(), 'exports', sanitizeFolderName(projectName));
}

async function convertWeldParamToExcel({ inputFile, projectName }) {
  const input = inputFile || '';
  if (!input) throw new Error('weldParameterInputFile is required');

  const opts = projectName ? { projectName } : {};

  if (input.endsWith('.csv')) {
    return await new WeldParametersCsvToExcel(input, opts).run();
  }
  if (input.endsWith('.xml')) {
    return await new WeldParametersXmlToExcel(input, opts).run();
  }
  throw new Error(`Unsupported weld parameter file type: ${input}`);
}

test.describe.serial('🔥 StatusConfig vs WeldParam', () => {
  let page, helper, login, status, statusConfigPass;
  let poManager, loginPage;
  let flowConfig;
  const caseResults = {};
  let didLogin = false;

  const configPath = path.join(__dirname, '../config/StatusConfigCompareFlow.json');
  flowConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const fc = flowConfig.flowControl || {};
  const cases = flowConfig.cases || {};
  const compareCfg = flowConfig.statusConfigCompare || {};

  test.beforeAll(() => {
    if (fc.cleanExports) {
      const exportsDir = path.join(process.cwd(), 'exports');
      const legacyDirs = [
        'StatusConfig UI',
        'WeldParametersXmlToExcel',
        'WeldParametersCsvToExcel',
        'StatusConfig Compared with WeldParam',
        'StatusConfigCompareFlow'
      ];
      for (const dir of legacyDirs) {
        const fullPath = path.join(exportsDir, dir);
        if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { recursive: true, force: true });
      }
      const enabledCases = Object.entries(cases || {}).filter(([_, v]) => v?.enabled);
      for (const [_, cfg] of enabledCases) {
        if (cfg?.projectName) {
          const p = path.join(exportsDir, sanitizeFolderName(cfg.projectName));
          if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
        }
      }
    }

    if (fc.checkSourceFile) {
      const enabledCases = Object.entries(cases).filter(([_, v]) => v?.enabled);
      for (const [caseKey, cfg] of enabledCases) {
        const inputPath = path.join(process.cwd(), cfg.weldParameterInputFile || '');
        if (!fs.existsSync(inputPath)) {
          console.warn(`⚠️ Missing weld input file for ${caseKey}: ${inputPath} — keeping case enabled; it will fail inside the case stage.`);
        }
      }
    }
  });

  test.beforeEach(async ({ browser }) => {
    if (page) return;
    page = await browser.newPage();
    helper = new CommonHelper(page);
    login = new LoginAndProjectPage(page);
    poManager = new POManager(page);
    loginPage = poManager.getLoginPage();
    status = new StatusConfigPage(page);
    statusConfigPass = new StatusConfigPass(page);
  });

  test.afterAll(async () => {
    await page?.close();
    const dashboardPath = assertion.generateDashboard();
    if (fs.existsSync(dashboardPath)) {
      await test.info().attach('📝 Assertion Dashboard', {
        path: dashboardPath,
        contentType: 'text/html'
      });
    }
  });

  async function goToProjectsPage(targetProjectName = null) {
    // Deterministic "go to Projects dashboard" navigation:
    // Always attempt an explicit click on the top-left "Projects" control (with fallbacks),
    // then wait for the dashboard search input and "Projects" text.
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    const targetTile = targetProjectName
      ? page.getByText(new RegExp(`^${targetProjectName}$`, 'i')).first()
      : null;

    const projectControls = [
      page.getByRole('button', { name: /^Projects$/i }).first(),
      page.getByRole('link', { name: /^Projects$/i }).first(),
      page.locator('header').getByText('Projects', { exact: true }).first(),
      page.getByText('Projects', { exact: true }).first()
    ];

    // Try a couple times: click Projects -> wait for the target tile (if provided)
    for (let attempt = 0; attempt < 3; attempt++) {
      // 1) Click Projects control (best-effort; doesn't throw)
      try {
        for (const ctrl of projectControls) {
          if (await ctrl.isVisible().catch(() => false)) {
            await ctrl.click({ timeout: 5000 }).catch(() => {});
            break;
          }
        }
      } catch (_) {
        // ignore
      }

      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForSelector('text=/Projects/i', { state: 'visible', timeout: 8000 }).catch(() => {});
      await searchInput.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

      if (targetTile) {
        const tileVisible = await targetTile.isVisible().catch(() => false);
        if (tileVisible) return;
      } else {
        return;
      }

      // If target tile didn't appear, try again after a short wait
      await page.waitForTimeout(500).catch(() => {});
    }

    // Final best-effort wait (never fail-fast)
    if (targetTile) await targetTile.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  async function runOneCase(caseKey, cfg) {
    test.skip(!cfg?.enabled);

    const testInfo = test.info();
    const result = { caseKey, enabled: !!cfg?.enabled, passed: true, failures: [] };

    const projectName = cfg.projectName;
    const weldParameterInputFile = cfg.weldParameterInputFile;
    const slopeIn = Number(cfg.slopeIn ?? 0);
    const slopeOut = Number(cfg.slopeOut ?? 0);

    const caseDir = resolveExportsProjectDir(projectName);
    fs.mkdirSync(caseDir, { recursive: true });

    const fail = (stage, message, extra = '') => {
      result.passed = false;
      result.failures.push({ stage, message, extra });
      assertion.log(
        `${caseKey}: ${stage}`,
        message,
        'No failure expected',
        'FAIL',
        extra,
        testInfo
      );
    };

    const passLog = (stage, message, extra = '') => {
      assertion.log(
        `${caseKey}: ${stage}`,
        message,
        'Success',
        'PASS',
        extra,
        testInfo
      );
    };

    let caseFinalized = false;
    const finalizeCase = () => {
      if (caseFinalized) return;
      caseFinalized = true;

      const hasFailAnnotation = (testInfo.annotations || []).some(a =>
        String(a?.type || '').toUpperCase().includes('FAIL')
      );
      if (hasFailAnnotation) result.passed = false;

      // Monocart step row status is driven by annotations; ensure a deterministic
      // top-level case status annotation is present at the top.
      testInfo.annotations.unshift({
        type: result.passed ? '✅ PASS' : '❌ FAIL',
        description: `[${caseKey}: Overall Case Result] ${result.passed ? 'PASS' : 'FAIL'}`
      });

      assertion.log(
        `${caseKey}: Overall Case Result`,
        result.passed ? 'PASS' : 'FAIL',
        'PASS',
        result.passed ? 'PASS' : 'FAIL',
        result.passed
          ? 'All assertions in this case passed'
          : `At least one assertion failed in this case`,
        testInfo
      );

      caseResults[caseKey] = result;
    };

    // Outputs we will snapshot-copy for traceability in the report.
    let weldExcelOriginalPath = null;
    let weldExcelCasePath = null;
    let uiExcelOriginalPath = null;
    let uiExcelCasePath = null;
    let comparePath = null;

    // 1) Login + open project/production tab
    try {
      if (fc.login && !didLogin) {
        await loginPage.goTo();
        const projectsPage = await loginPage.validLogin(
          login.correctEmail,
          login.correctPassword,
          { rememberMe: false }
        );
      }

      // Ensure we start each case from the Projects list (prevents carrying "Status Configuration" state).
      await goToProjectsPage(projectName);

      // Open the project, but avoid calling ProductionTabAssertion here because it logs
      // "Production:*" checks into the same dashboard section (p600z/p625 comparisons).
      // StatusConfigPage.applyStatusConfiguration will navigate Production + Status Config anyway.
      await helper.selectProject(projectName);
      passLog('Login/Navigation', `Project opened: ${projectName}`);
    } catch (e) {
      fail('Login/Navigation', e?.message || String(e));
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    // 2) Convert weld parameter file -> Excel (can run while we open Status Config UI)
    const weldPromise = fc.weldParameterExtraction
      ? convertWeldParamToExcel({ inputFile: weldParameterInputFile, projectName })
      : Promise.resolve(null);

    // 3) Apply slope and open Status Configuration tab
    try {
      await status.applyStatusConfiguration(slopeIn, slopeOut);
      passLog('Apply Slope', `Applied In:${slopeIn}, Out:${slopeOut}`);
    } catch (e) {
      fail('Apply Slope', e?.message || String(e));
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    // 4) Extract Status Configuration UI table -> Excel
    let uiResult = { filePath: null };
    try {
      uiResult = fc.statusConfigUIExtraction
        ? await statusConfigPass.run(
          projectName,
          slopeIn,
          slopeOut,
          cfg.calculationMethod || compareCfg.calculationMethod || null
        )
        : { filePath: null };

      await statusConfigPass.goBackToProduction();
    } catch (e) {
      fail('UI Extraction', e?.message || String(e));
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    uiExcelOriginalPath = uiResult?.filePath || null;
    if (!uiExcelOriginalPath) {
      fail('UI Extraction', 'UI Excel filePath missing from StatusConfigPass output');
      finalizeCase();
      await goToProjectsPage();
      return result;
    }
    if (!fs.existsSync(uiExcelOriginalPath)) {
      fail('UI Extraction', `UI Excel does not exist: ${uiExcelOriginalPath}`);
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    // Sanity-check: values shown in the UI after applying slopes
    const uiSlopeTime = uiResult?.weldDetails?.['Slope Time'] || '';
    if (uiSlopeTime) {
      const inMatch = uiSlopeTime.match(/In:\s*([-\d.]+)/i);
      const outMatch = uiSlopeTime.match(/Out:\s*([-\d.]+)/i);

      if (inMatch) {
        const uiIn = Number(inMatch[1]);
        if (Number.isNaN(uiIn) || Math.abs(uiIn - slopeIn) > 1e-6) {
          fail('UI Slope Sanity', `slopeIn expected=${slopeIn}, got=${uiIn}`, uiSlopeTime);
        }
      }
      if (outMatch) {
        const uiOut = Number(outMatch[1]);
        if (Number.isNaN(uiOut) || Math.abs(uiOut - slopeOut) > 1e-6) {
          fail('UI Slope Sanity', `slopeOut expected=${slopeOut}, got=${uiOut}`, uiSlopeTime);
        }
      }
    }

    // UI Excel already under `exports/<projectName>/` from StatusConfigPass
    uiExcelCasePath = uiExcelOriginalPath;

    await testInfo.attach(`${caseKey}: StatusConfig UI Excel`, {
      path: uiExcelCasePath,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    passLog('UI Excel Generated', uiExcelCasePath);

    // Wait for weld conversion (if we started it in parallel).
    try {
      weldExcelOriginalPath = await weldPromise;
    } catch (e) {
      fail('Weld Conversion', e?.message || String(e));
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    if (!weldExcelOriginalPath) {
      fail('Weld Conversion', 'Weld conversion returned empty output path');
      finalizeCase();
      await goToProjectsPage();
      return result;
    }
    if (!fs.existsSync(weldExcelOriginalPath)) {
      fail('Weld Conversion', `Weld Excel does not exist: ${weldExcelOriginalPath}`);
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    // Weld Excel already under `exports/<projectName>/WeldParameters_Converted.xlsx`
    weldExcelCasePath = weldExcelOriginalPath;

    await testInfo.attach(`${caseKey}: Weld Parameter Excel`, {
      path: weldExcelCasePath,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    passLog(
      'Weld Excel Generated',
      weldExcelCasePath,
      `Input: ${weldParameterInputFile}\nOutput: ${weldExcelCasePath}`
    );

    // 5) Compare UI Excel vs WeldParam Excel
    if (!fc.statusConfigComparison) {
      passLog('Comparison Skipped', 'fc.statusConfigComparison=false');
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    passLog(
      'Comparison Inputs',
      `weld=${weldExcelCasePath}`,
      `ui=${uiExcelCasePath}`
    );

    try {
      const comparer = new StatusConfigCompare(
        weldExcelCasePath,
        uiExcelCasePath,
        compareCfg.weldSheetName || null,
        uiResult?.weldDetails?.['Job Number'] ?? null,
        projectName
      );
      comparePath = await comparer.run();
    } catch (e) {
      fail('StatusConfigCompare.run()', e?.message || String(e));
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    if (!comparePath) {
      fail('Comparison Output', 'Comparison Excel path missing');
      finalizeCase();
      await goToProjectsPage();
      return result;
    }
    if (!fs.existsSync(comparePath)) {
      fail('Comparison Output', `Comparison Excel does not exist: ${comparePath}`);
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    await testInfo.attach(`${caseKey}: Comparison Excel`, {
      path: comparePath,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Re-run the mismatch detection (same color heuristic as production-flow.spec.js)
    let hasMismatch = false;
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(comparePath);

      workbook.eachSheet(sheet => {
        sheet.eachRow(row => {
          row.eachCell(cell => {
            if (cell.fill?.fgColor?.argb?.includes('FFFFC7CE')) {
              hasMismatch = true;
            }
          });
        });
      });
    } catch (e) {
      fail('Mismatch Detection', e?.message || String(e), `comparePath=${comparePath}`);
      finalizeCase();
      await goToProjectsPage();
      return result;
    }

    if (hasMismatch) {
      fail(
        'StatusConfig vs WeldParam Comparison',
        'Mismatch found',
        `WeldExcel: ${weldExcelCasePath}\nUIExcel: ${uiExcelCasePath}\nCompare: ${comparePath}`
      );
    } else {
      passLog(
        'StatusConfig vs WeldParam Comparison',
        'No mismatches detected',
        `WeldExcel: ${weldExcelCasePath}\nUIExcel: ${uiExcelCasePath}\nCompare: ${comparePath}`
      );
    }

    finalizeCase();
    await goToProjectsPage();
    return result;
  }

  // Explicit first step in the report: Login only once.
  test('Login', async () => {
    test.skip(!fc.login);
    if (didLogin) return;
    const info = test.info();
    await loginPage.goTo();
    const projectsPage = await loginPage.validLogin(
      login.correctEmail,
      login.correctPassword,
      { rememberMe: false }
    );
    didLogin = true;
  });

  test('p600z comparison (WeldParam file vs StatusConfig UI)', async () => {
    const info = test.info();
    try {
      await runOneCase('p600z', cases.p600z);
    } catch (e) {
      assertion.log(
        'p600z: Unhandled Error',
        e?.message || String(e),
        'No error expected',
        'FAIL',
        '',
        info
      );
    }
  });

  test('p625 comparison (WeldParam file vs StatusConfig UI)', async () => {
    const info = test.info();
    try {
      await runOneCase('p625', cases.p625);
    } catch (e) {
      assertion.log(
        'p625: Unhandled Error',
        e?.message || String(e),
        'No error expected',
        'FAIL',
        '',
        info
      );
    }
  });

  test('🎉 Flow Complete', async () => {
    console.log('🎉 Flow Complete. Case results:', caseResults);
  });
});

