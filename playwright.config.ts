import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,

  timeout: 0,

  reporter: [
    ['list'],
    ['html', { open: 'always' }]
  ],

  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },

    // ✅ correct place
    launchOptions: {
      slowMo: 500,
    },
  },
});
