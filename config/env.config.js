const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEFAULTS = {
  TEST_ENV: 'dev',
  BROWSER: 'chromium',
  HEADLESS: 'true',
  DEVICE: '',
  PARALLEL: '1',
  RETRY: '0',
  STEP_TIMEOUT: '60000',
  BASE_URL: 'https://playwright.dev',
  API_BASE_URL: 'https://jsonplaceholder.typicode.com',
  API_TOKEN: '',
  WEBSOCKET_URL: ''
};

const env = Object.assign({}, DEFAULTS, process.env);
const environments = {
  dev: {
    baseUrl: env.BASE_URL,
    apiBaseUrl: env.API_BASE_URL
  },
  qa: {
    baseUrl: env.BASE_URL,
    apiBaseUrl: env.API_BASE_URL
  },
  prod: {
    baseUrl: env.BASE_URL,
    apiBaseUrl: env.API_BASE_URL
  },
  'onprem-devint': {
    baseUrl: env.BASE_URL,
    apiBaseUrl: env.API_BASE_URL
  },
  'onprem-stage': {
    baseUrl: env.BASE_URL,
    apiBaseUrl: env.API_BASE_URL
  },
  'oncloud-stage': {
    baseUrl: env.BASE_URL,
    apiBaseUrl: env.API_BASE_URL
  }
};

const environment = env.TEST_ENV in environments ? env.TEST_ENV : 'dev';
const envConfig = {
  environment,
  baseUrl: environments[environment].baseUrl,
  apiBaseUrl: environments[environment].apiBaseUrl,
  apiToken: env.API_TOKEN,
  browser: env.BROWSER,
  headless: env.HEADLESS === 'true',
  device: env.DEVICE || null,
  websocketUrl: env.WEBSOCKET_URL,
  parallel: Number(env.PARALLEL) || 1,
  retry: Number(env.RETRY) || 0,
  timeouts: {
    step: Number(env.STEP_TIMEOUT) || 60000,
    action: 30000,
    navigation: 45000
  },
  artifacts: {
    screenshot: true,
    trace: true,
    video: false
  }
};

module.exports = envConfig;
