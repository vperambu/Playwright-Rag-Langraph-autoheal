const path = require('path');
const envConfig = require('./config/env.config');
const deviceConfig = require('./config/device.config');

module.exports = {
  testDir: './tests',
  timeout: envConfig.timeouts.step,
  expect: {
    timeout: envConfig.timeouts.action
  },
  use: {
    headless: envConfig.headless,
    viewport: envConfig.viewport,
    baseURL: envConfig.baseUrl,
    actionTimeout: envConfig.timeouts.action,
    navigationTimeout: envConfig.timeouts.navigation,
    trace: envConfig.artifacts.trace ? 'on-first-retry' : 'off',
    screenshot: envConfig.artifacts.screenshot ? 'only-on-failure' : 'off',
    video: envConfig.artifacts.video ? 'retain-on-failure' : 'off',
    ...deviceConfig.getContextOptions('playwright-config')
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  reporter: [
    ['list'],
    ['junit', { outputFile: path.join('reports', 'junit', 'results.xml') }]
  ]
};
