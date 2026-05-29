const { BeforeAll, AfterAll, Before, After } = require('@cucumber/cucumber');
const path = require('path');
const fs = require('fs');
const envConfig = require('../../../config/env.config');
const browserConfig = require('../../../config/browser.config');
const deviceConfig = require('../../../config/device.config');
const { ensureDirectory } = require('../../utils/file.util');
const LocalWebSocketServer = require('../../utils/local-websocket-server');
const LocalHttpServer = require('../../utils/local-http-server');
const ObservabilityService = require('../../observability');

const outputFolders = [
  'reports',
  'test-results',
  'allure-results',
  path.join('test-results', 'observability')
];

const localHttpServer = new LocalHttpServer();
const localWebSocketServer = new LocalWebSocketServer();

BeforeAll(async function () {
  outputFolders.forEach(folder => ensureDirectory(path.resolve(process.cwd(), folder)));
});

Before({ tags: '@ui' }, async function () {
  const browser = await browserConfig.launchBrowser();
  this.setBrowser(browser);
  await localHttpServer.start();
  const context = await browser.newContext({
    baseURL: localHttpServer.url(),
    ...deviceConfig.getContextOptions(this.pickle ? this.pickle.name : 'ui-scenario')
  });
  this.setContext(context);
  const page = await context.newPage();
  this.setPage(page);
  await this.initPages();
  page.on('console', msg => console.log(`[page console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', error => console.error(`[page error] ${error.message}`));
  if (envConfig.artifacts.trace) await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
});

Before({ tags: '@api' }, async function () {
  await this.initApi();
});

Before({ tags: '@websocket' }, async function () {
  if (!envConfig.websocketUrl) {
    await localWebSocketServer.start();
  }
  const websocketUrl = envConfig.websocketUrl || localWebSocketServer.url();
  await this.connectWebSocket('default', { url: websocketUrl, reconnect: true });
});

After({ tags: '@websocket' }, async function () {
  const names = Object.keys(this.webSocketClients);
  for (const name of names) {
    await this.closeWebSocket(name);
  }
  if (!envConfig.websocketUrl) {
    await localWebSocketServer.stop();
  }
});

After({ tags: '@ui' }, async function ({ result }) {
  const scenarioName = this.pickle ? this.pickle.name : 'ui-scenario';
  if (result.status === 'FAILED' && this.page) {
    const screenshotPath = path.join('test-results', `${scenarioName.replace(/\s+/g, '_')}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
  }
  if (this.context) {
    const tracePath = path.join('test-results', `${scenarioName.replace(/\s+/g, '_')}.zip`);
    await this.context.tracing.stop({ path: tracePath });
  }
  if (this.context) await this.context.close();
  if (this.browser) await this.browser.close();
  await localHttpServer.stop();
});

After({ tags: '@api' }, async function () {
  if (this.apiContext) await this.apiContext.dispose();
});

After(async function ({ result }) {
  const scenarioName = this.pickle ? this.pickle.name : 'unknown-scenario';
  await ObservabilityService.endScenario(scenarioName, result);
});

AfterAll(async function () {
  await ObservabilityService.flushMetrics();
});
