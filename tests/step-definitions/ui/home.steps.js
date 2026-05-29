const { Given, When, Then } = require('@cucumber/cucumber');
const { expectTextIncludes } = require('../../utils/assertion.util');

Given('I open the home page', async function () {
  const home = this.getPage('home');
  await home.open();
});

Then('I should see the hero title on the home page', async function () {
  const home = this.getPage('home');
  const title = await home.getText(home.selectors.heroTitle);
  expectTextIncludes(title, 'Playwright');
});

When('I click the Get Started link', async function () {
  const home = this.getPage('home');
  await home.clickGetStarted();
});

Then('I should navigate to the documentation intro page', async function () {
  await this.page.waitForURL('**/docs/intro');
  const url = this.page.url();
  if (!url.includes('/docs/intro')) throw new Error('Expected documentation intro page to load');
});
