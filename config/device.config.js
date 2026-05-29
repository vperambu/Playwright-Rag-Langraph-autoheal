const { devices } = require('@playwright/test');
const envConfig = require('./env.config');

function getSelectedDevice() {
  return envConfig.device || null;
}

function getContextOptions(scenarioName) {
  const selectedDevice = getSelectedDevice();
  if (!selectedDevice) {
    return {
      viewport: { width: 1280, height: 720 }
    };
  }

  const descriptor = devices[selectedDevice] || devices['iPhone 13'];
  return {
    ...descriptor,
    viewport: descriptor.viewport,
    userAgent: descriptor.userAgent
  };
}

module.exports = {
  getContextOptions,
  getSelectedDevice
};
