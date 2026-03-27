
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Overall test timeout (reduced for faster feedback)
  timeout: 300000,
  // workers: 3,
  expect: {
    // Per-expect timeout
    timeout: 10000,
  },

  // Use built-in HTML reporter instead of Monocart.
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'on-failure' }],
  ],

  use: {
    // Keep browser visible but remove artificial delays
    headless: false,
    viewport: null,
    launchOptions: {
      slowMo: 0,
      args: ['--start-maximized', '--force-device-scale-factor=1.10'],
    },
    actionTimeout: 30000,
    navigationTimeout: 60000,
    trace: 'off',
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