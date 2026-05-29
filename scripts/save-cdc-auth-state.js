const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

(async () => {
  const authDir = path.resolve('auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://playwright.dev');
  await context.storageState({ path: path.join(authDir, 'cdc-auth-state.json') });
  await browser.close();
  console.log('Saved CDC auth state');
})();
