const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

(async () => {
  const authDir = path.resolve('auth');
  fs.mkdirSync(authDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://playwright.dev');
  await context.storageState({ path: path.join(authDir, 'uberagent-auth-state.json') });
  await browser.close();
  console.log('Saved UberAgent auth state');
})();
