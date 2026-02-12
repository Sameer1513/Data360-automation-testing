import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 600000,
  workers: 3,
  expect: {
    timeout: 100000,
  },

  use: {
    headless: false,
    viewport: null,
    launchOptions: {
      slowMo: 300,
      args: ['--start-maximized'],
    },
    actionTimeout: 30000,
    navigationTimeout: 30000,
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