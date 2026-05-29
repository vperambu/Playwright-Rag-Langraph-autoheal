const { Given, When, Then } = require('@cucumber/cucumber');
const { expectTextIncludes } = require('../../utils/assertion.util');

Given('I open the login page', async function () {
  const login = this.getPage('login');
  await login.open();
});

Then('the login page should be available', async function () {
  const login = this.getPage('login');
  await login.assertLoaded();
  const title = await login.page.title();
  expectTextIncludes(title, 'Login');
});

When('I perform a login attempt with valid credentials', async function () {
  const user = this.getTestUser('customer');
  const login = this.getPage('login');
  await login.login(user.username, user.password);
});

Then('the dashboard page should be loaded', async function () {
  const dashboard = this.getPage('dashboard');
  await dashboard.open();
  await dashboard.assertLoaded();
  const hasPanel = await dashboard.hasQuickStartPanel();
  if (!hasPanel) {
    throw new Error('Dashboard quick start panel should be visible');
  }
});
