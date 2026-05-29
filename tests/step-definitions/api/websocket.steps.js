const { Given, When, Then } = require('@cucumber/cucumber');

Given('I connect to the echo WebSocket', async function () {
  await this.connectWebSocket('echo');
});

When('I send the WebSocket message {string}', async function (message) {
  await this.sendWebSocketMessage('echo', message);
});

Then('I should receive an echoed WebSocket message containing {string}', async function (expected) {
  const message = await this.waitForWebSocketMessage('echo', msg => msg.includes(expected), { timeoutMs: 10000 });
  if (!message.includes(expected)) {
    throw new Error(`Expected WebSocket echo to contain ${expected}`);
  }
});
