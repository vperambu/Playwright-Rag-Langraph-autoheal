const { World, setWorldConstructor } = require('@cucumber/cucumber');
const { chromium, request } = require('@playwright/test');
const envConfig = require('../../config/env.config');
const HomePage = require('../pages/home.page');
const LoginPage = require('../pages/login.page');
const DashboardPage = require('../pages/dashboard.page');
const PostsClient = require('../api/clients/posts.client');
const UsersClient = require('../api/clients/users.client');
const WebSocketTestClient = require('../utils/websocket.client');
const UserManager = require('./user-manager');
const ObservabilityService = require('../observability');

class CustomWorld extends World {
  constructor(options) {
    super(options);
    this.browser = null;
    this.context = null;
    this.page = null;
    this.apiContext = null;
    this.pages = {};
    this.clients = {};
    this.webSocketClients = {};
    this.browserWebSocketMessages = [];
    this.testData = {};
    this.userManager = new UserManager();
    this.observability = ObservabilityService.startScenario(this.constructor.name);
  }

  async setBrowser(browser) {
    this.browser = browser;
  }

  async setContext(context) {
    this.context = context;
  }

  async setPage(page) {
    this.page = page;
    if (page) {
      page.on('websocket', ws => {
        ws.on('framereceived', frame => {
          this.browserWebSocketMessages.push({ url: ws.url(), payload: frame.payload });
        });
      });
    }
  }

  async initPages() {
    if (!this.page) throw new Error('Page is not initialized');
    this.registerPage('home', new HomePage(this.page));
    this.registerPage('login', new LoginPage(this.page));
    this.registerPage('dashboard', new DashboardPage(this.page));
  }

  async initApi() {
    this.apiContext = await request.newContext({
      baseURL: envConfig.apiBaseUrl,
      extraHTTPHeaders: {
        Authorization: envConfig.apiToken ? `Bearer ${envConfig.apiToken}` : ''
      }
    });
    this.registerClient('posts', new PostsClient(this.apiContext, envConfig.apiToken));
    this.registerClient('users', new UsersClient(this.apiContext, envConfig.apiToken));
  }

  registerPage(key, pageObject) {
    this.pages[key] = pageObject;
  }

  getPage(key) {
    return this.pages[key];
  }

  registerClient(key, client) {
    this.clients[key] = client;
  }

  getClient(key) {
    return this.clients[key];
  }

  async connectWebSocket(name, options = {}) {
    const url = options.url || envConfig.websocketUrl || 'ws://localhost:8080';
    const client = new WebSocketTestClient({ url, headers: options.headers, reconnect: options.reconnect });
    await client.connect();
    this.webSocketClients[name] = client;
    return client;
  }

  async sendWebSocketMessage(name, payload) {
    const client = this.webSocketClients[name];
    if (!client) throw new Error(`WebSocket client ${name} not found`);
    return client.send(payload);
  }

  async waitForWebSocketMessage(name, predicate, options = {}) {
    const client = this.webSocketClients[name];
    if (!client) throw new Error(`WebSocket client ${name} not found`);
    return client.waitForMessage(predicate, options);
  }

  getWebSocketMessages(name) {
    const client = this.webSocketClients[name];
    return client ? client.getMessages() : [];
  }

  async closeWebSocket(name) {
    const client = this.webSocketClients[name];
    if (client) await client.close();
    delete this.webSocketClients[name];
  }

  async waitForBrowserWebSocketMessage(predicate, { timeoutMs = 15000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const message = this.browserWebSocketMessages.find(predicate);
      if (message) return message;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Browser WebSocket message did not match predicate in time');
  }

  setTestData(key, value) {
    this.testData[key] = value;
  }

  getTestData(key) {
    return this.testData[key];
  }

  clearTestData() {
    this.testData = {};
  }

  getTestUser(roleOrKey) {
    return this.userManager.getUser(roleOrKey);
  }
}

module.exports = CustomWorld;
