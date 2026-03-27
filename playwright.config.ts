import fs from 'fs';
import { defineConfig } from '@playwright/test';
import path from 'path';

const chromeProjectUse = {
  browserName: 'chromium' as const,
  channel: 'chrome' as const,
};

const MODULAR_SPEC = 'create-device-register-assign-sync.spec.js';

type SpecFlowFile = {
  enabled?: Record<string, boolean>;
  execution?: {
    serial?: string[];
    parallel?: string[];
  };
} & Record<string, unknown>;

/** Per-spec enable/disable + execution grouping (serial/parallel). */
function loadSpecFlowControl(): SpecFlowFile {
  const file = path.join(process.cwd(), 'config', 'spec-flow-control.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as SpecFlowFile;
  } catch {
    return {};
  }
}

const specFlow = loadSpecFlowControl();

function getEnabledMap(): Record<string, boolean> {
  // Backward compatibility:
  // old format => { "A.spec.js": true, "B.spec.js": false }
  if (specFlow.enabled && typeof specFlow.enabled === 'object') return specFlow.enabled;

  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(specFlow)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function getExecutionList(mode: 'serial' | 'parallel'): string[] {
  const list = specFlow.execution?.[mode];
  if (!Array.isArray(list)) return [];
  return list.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

const enabledMap = getEnabledMap();
const serialSpecs = Array.from(new Set(getExecutionList('serial')));
const parallelSpecs = Array.from(new Set(getExecutionList('parallel')));

function isSpecEnabled(filename: string): boolean {
  if (!(filename in enabledMap)) return true;
  return enabledMap[filename] !== false;
}

const disabledSpecs = Object.entries(enabledMap)
  .filter(([, v]) => v === false)
  .map(([name]) => name);

const enabledSerialSpecs = serialSpecs
  .filter((name) => isSpecEnabled(name) && name !== MODULAR_SPEC);

const serialSpecSet = new Set(enabledSerialSpecs);
const parallelSpecsThatAreAlsoSerial = parallelSpecs.filter((name) => serialSpecSet.has(name));
const enabledParallelSpecs = parallelSpecs
  .filter((name) => isSpecEnabled(name) && name !== MODULAR_SPEC && !serialSpecSet.has(name));

// Default parallel bucket: all specs not explicitly serial, not modular, not disabled.
const chromeParallelIgnore: string[] = [
  `**/${MODULAR_SPEC}`,
  ...disabledSpecs.map((name) => `**/${name}`),
  ...enabledSerialSpecs.map((name) => `**/${name}`),
];

// Explicit parallel bucket: only run listed parallel specs (if provided).
const explicitParallelEnabled = enabledParallelSpecs.length > 0;
const explicitParallelMatch = enabledParallelSpecs.map((name) => `**/${name}`);

// Serial bucket: run listed serial specs with 1 worker.
const serialEnabled = enabledSerialSpecs.length > 0;
const serialMatch = enabledSerialSpecs.map((name) => `**/${name}`);

if (parallelSpecsThatAreAlsoSerial.length > 0) {
  console.warn(
    `[spec-flow-control] serial takes precedence; removed from parallel: ${parallelSpecsThatAreAlsoSerial.join(', ')}`
  );
}

const serialIgnoreFromDisabled = [
  ...disabledSpecs.map((name) => `**/${name}`),
];

const modularEnabled = isSpecEnabled(MODULAR_SPEC);

export default defineConfig({
  testDir: 'tests',

  // Parallel workers (default: Playwright picks from CPU count). Override: PLAYWRIGHT_E2E_WORKERS=1 npx playwright test
  workers:
    process.env.PLAYWRIGHT_E2E_WORKERS !== undefined
      ? Math.max(1, parseInt(process.env.PLAYWRIGHT_E2E_WORKERS, 10) || 1)
      : undefined,

  // Modular spec waits on playwright-report/.production-flow-terminal-sync.done (written when production-flow Step 7 terminal sync finishes), not after the full production-flow file.

  timeout: 6000000,
  expect: {
    timeout: 1000000,
  },

  reporter: [
    ['list'],

    ['monocart-reporter', {
      name: "Weld Automation Report",
      outputFile: path.resolve(process.cwd(), 'playwright-report/Test-Report.html'),

      // Group like older view: Project → Describe → Tests (no file layer)
      groupOptions: {
        group: true,
        shard: true,
        project: true,
        file: false,
        describe: true,
        step: false,
        merge: false,
      },

      // ✅ Show expect steps inside each test row
      step: {
        expect: true,
      },

      columns: (defaultColumns: any[]) => {

        // ── Duration formatter ────────────────────────────────────────────
        const durationCol = defaultColumns.find((c: any) => c.id === 'duration');
        if (durationCol) {
          durationCol.formatter = (_v: any, rowItem: any) =>
            rowItem.duration ? (rowItem.duration / 1000).toFixed(2) + 's' : '';
        }

        // ── Status formatter ──────────────────────────────────────────────
        const statusCol = defaultColumns.find((c: any) => c.id === 'status');
        if (statusCol) {
          statusCol.formatter = (value: any, rowItem: any) => {
            const hasFailAnnotation = Array.isArray(rowItem?.annotations)
              && rowItem.annotations.some((a: any) =>
                String(a?.type || '').toUpperCase().includes('FAIL')
              );

            // Annotation-driven override:
            // if any assertion annotation is FAIL, display Failed in Status
            // even when Playwright test status is "passed".
            if (hasFailAnnotation) {
              return '<span style="color:#dc2626;font-weight:700">❌ Failed</span>';
            }
            if (value === 'passed') return '<span style="color:#16a34a;font-weight:700">✅ Passed</span>';
            if (value === 'failed') return '<span style="color:#dc2626;font-weight:700">❌ Failed</span>';
            if (value === 'skipped') return '<span style="color:#64748b;font-weight:600">⏭ Not Executed</span>';
            return value;
          };
        }

        // ── Expected column — show "Pass" not "passed" ────────────────────
        const expectedCol = defaultColumns.find((c: any) => c.id === 'expectedStatus');
        if (expectedCol) {
          expectedCol.formatter = (value: any) => {
            if (value === 'passed')  return '<span style="color:#16a34a;font-weight:700">Pass</span>';
            if (value === 'failed')  return '<span style="color:#dc2626;font-weight:700">Fail</span>';
            if (value === 'skipped') return '<span style="color:#64748b;font-weight:600">Skip</span>';
            return value || '';
          };
        }

        // ── Outcome column — show "Failed" not "unexpected" ───────────────
        const outcomeCol = defaultColumns.find((c: any) => c.id === 'outcome');
        if (outcomeCol) {
          outcomeCol.formatter = (value: any, rowItem: any) => {
            const hasFailAnnotation = Array.isArray(rowItem?.annotations)
              && rowItem.annotations.some((a: any) =>
                String(a?.type || '').toUpperCase().includes('FAIL')
              );

            // Keep flow non-blocking but reflect assertion failure in Outcome column.
            if (hasFailAnnotation) return '<span style="color:#dc2626;font-weight:700">Failed</span>';

            if (value === 'expected')   return '<span style="color:#16a34a;font-weight:700">Pass</span>';
            if (value === 'unexpected') return '<span style="color:#dc2626;font-weight:700">Failed</span>';
            if (value === 'skipped')    return '<span style="color:#64748b;font-weight:600">Skipped</span>';
            return value || '';
          };
        }

        // ── Annotations formatter — full text rows per annotation ──────────
        const annotCol = defaultColumns.find((c: any) => c.id === 'annotations');
        if (annotCol) {
          annotCol.width = 350;
          annotCol.formatter = (_v: any, rowItem: any) => {
            const annotations = rowItem.annotations;
            if (!annotations || !annotations.length) return '';

            return annotations.map((a: any) => {
              const isPass = a.type && a.type.includes('PASS');
              const isFail = a.type && a.type.includes('FAIL');
              const isSkip = !isPass && !isFail;
              const color  = isPass ? '#16a34a' : isFail ? '#dc2626' : '#6366f1';
              const bg     = isPass ? '#dcfce7'  : isFail ? '#fee2e2'  : '#eef2ff';
              const label  = a.type || 'info';
              return `<div style="background:${bg};border-left:3px solid ${color};border-radius:4px;padding:4px 8px;margin-bottom:3px;font-size:0.8rem;line-height:1.4;">
                <span style="color:${color};font-weight:700;">${label}</span><br>
                <span style="color:#374151;">${a.description || ''}</span>
              </div>`;
            }).join('');
          };
        }

        return defaultColumns;
      },

      onEnd: async (reportData: any) => {
        const reportPath = reportData.htmlPath;
        console.log(`\n📊 Report generated: ${reportPath}`);

        const { execSync } = require('child_process');
        let command = '';
        if (process.platform === 'win32') command = `start "" "${reportPath}"`;
        else if (process.platform === 'darwin') command = `open "${reportPath}"`;
        else command = `xdg-open "${reportPath}"`;

        try {
          execSync(command, { stdio: 'ignore' });
        } catch (e) {
          console.error(`❌ Failed to open report: ${e}`);
        }
      }
    }]
  ],

  use: {
    headless: false,
    viewport: null,
    launchOptions: {
      slowMo: 100,
      args: ['--start-maximized', '--force-device-scale-factor=1.10'],
    },
    actionTimeout: 6000000,
    navigationTimeout: 6000000,
    trace: 'on',
    screenshot: 'only-on-failure',
    contextOptions: { ignoreHTTPSErrors: true },
  },

  // Chrome-others: includes production-flow + all other specs (parallel workers). Modular runs in parallel but blocks in beforeAll until Step 7 terminal gate file exists.
  projects: [
    {
      name: 'Chrome-parallel',
      ...(explicitParallelEnabled
        ? { testMatch: explicitParallelMatch }
        : { testIgnore: chromeParallelIgnore }),
      use: chromeProjectUse,
    },
    {
      name: 'Chrome-serial',
      testMatch: serialEnabled ? serialMatch : '**/__no_serial_specs__.spec.js',
      testIgnore: serialIgnoreFromDisabled,
      workers: 1,
      fullyParallel: false,
      use: chromeProjectUse,
    },
    // Modular runs separately and can coordinate with production flow through terminal gate file.
    {
      name: 'Chrome-device-sync-modular',
      testMatch: modularEnabled ? `**/${MODULAR_SPEC}` : '**/__spec_flow_disabled__.spec.js',
      use: chromeProjectUse,
    },
  ],

});