
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  timeout: 6000000,
  // workers: 3,
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

  
  
  projects: [

    // {
    //   name: 'Chromium',
    //   use: {
    //     browserName: 'chromium',
    //   },
    // },

    {
      name: 'Chrome',
      use: {
        browserName: 'chromium',
        channel: 'chrome', // 🔹 Uses installed Google Chrome
      },
    },

    // {
    //   name: 'Edge',
    //   use: {
    //     browserName: 'chromium',
    //     channel: 'msedge', // ✅ Microsoft Edge
    //   },
    // },

    // {
    //   name: 'Firefox',
    //   use: {
    //     browserName: 'firefox',
    //   },
    // },

    // {
    //   name: 'WebKit',
    //   use: {
    //     browserName: 'webkit',
    //   },
    // },

  ],

});