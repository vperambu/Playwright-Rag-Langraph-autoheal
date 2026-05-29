const { expect } = require('@playwright/test');

function expectTextIncludes(actual, expected) {
  expect(actual).toContain(expected);
}

function expectStatus(response, expectedStatus) {
  expect(response.status()).toBe(expectedStatus);
}

function expectOk(response) {
  expect(response.ok()).toBeTruthy();
}

module.exports = {
  expectTextIncludes,
  expectStatus,
  expectOk
};
