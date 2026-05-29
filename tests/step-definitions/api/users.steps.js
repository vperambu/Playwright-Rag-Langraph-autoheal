const { Given, Then } = require('@cucumber/cucumber');
const { expectStatus } = require('../../utils/assertion.util');

Given('I request user details for id {string}', async function (userId) {
  await this.initApi();
  this.testData.userResponse = await this.getClient('users').getUser(userId);
});

Then('the user response status should be {int}', async function (expectedStatus) {
  expectStatus(this.testData.userResponse, expectedStatus);
});

Then('the user response should contain a username', async function () {
  const body = await this.testData.userResponse.json();
  if (!body.username) throw new Error('Expected user response to contain username');
});
