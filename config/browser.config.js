const { chromium, firefox, webkit, devices } = require('@playwright/test');
const envConfig = require('./env.config');

const supportedBrowsers = ['chromium', 'firefox', 'webkit'];

function getBrowserType(browserName) {
  if (browserName === 'firefox') return firefox;
  if (browserName === 'webkit') return webkit;
  return chromium;
}

async function launchBrowser(launchOptions = {}) {
  const browserType = getBrowserType(envConfig.browser);
  return browserType.launch({ headless: envConfig.headless, ...launchOptions });
}

async function launchPersistentContext(userDataDir, contextOptions = {}) {
  const browserType = getBrowserType(envConfig.browser);
  return browserType.launchPersistentContext(userDataDir, {
    headless: envConfig.headless,
    ...contextOptions
  });
}

module.exports = {
  supportedBrowsers,
  launchBrowser,
  launchPersistentContext
};
