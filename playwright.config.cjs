const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests', testMatch: 'products-ui.spec.cjs', timeout: 120000, workers: 1,
  outputDir: '.next/ui-results',
  use: { baseURL: 'http://127.0.0.1:3100', viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined } },
  webServer: { command: 'npm run start -- --hostname 127.0.0.1 --port 3100', url: 'http://127.0.0.1:3100/admin/productos', reuseExistingServer: false, timeout: 30000 },
});
