const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests', testMatch: 'payments-ui.spec.cjs', timeout: 30000, workers: 1,
  outputDir: '.next/payments-ui-results',
  use: { baseURL: 'http://127.0.0.1:3102', viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined } },
  webServer: { command: 'npm run start -- --hostname 127.0.0.1 --port 3102', url: 'http://127.0.0.1:3102/compra/resultado', reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true', timeout: 30000 },
});
