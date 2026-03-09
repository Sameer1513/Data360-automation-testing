import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 6000000,
  // workers: 3,
  expect: {
    timeout: 1000000,
  },
  reporter: [
    ['list'],   
                            
    ['html', { open: 'always' }]             
  ],

  use: {
    headless: false,
    viewport: null,
    launchOptions: {
      slowMo: 10,
      args: ['--start-maximized','--force-device-scale-factor=1.10'],
    },
    actionTimeout: 6000000,
    navigationTimeout: 6000000,
    trace: 'on', 
    screenshot: 'only-on-failure',
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
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