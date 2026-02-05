import { defineConfig } from '@playwright/test';

export default defineConfig({
  // 1. Increase the overall test timeout (e.g., to 5 or 10 minutes)
  // because clicking every eye-icon takes significant time.
  timeout: 600000, 

  expect: {
    timeout: 10000,
  },

  use: {
    headless: false,
    viewport: null, 
    launchOptions: {
      slowMo: 300, // Reduced slightly from 500 to speed up extraction
      args: ["--start-maximized"], 
    },
    // 2. Action timeout for individual clicks/navigation
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
});
