const path = require('path');

module.exports = {
  default: `tests/features/**/*.feature --require ${path.join('tests', 'support', 'worlds.js')} --require ${path.join('tests', 'support', 'hooks', 'hooks.js')} --require ${path.join('tests', 'step-definitions', '**', '*.js')} --format progress-bar --format json:${path.join('reports', 'cucumber-report.json')}`,
  ui: `tests/features/**/*.feature --tags '@ui' --require ${path.join('tests', 'support', 'worlds.js')} --require ${path.join('tests', 'support', 'hooks', 'hooks.js')} --format progress-bar --format json:${path.join('reports', 'cucumber-ui-report.json')}`,
  api: `tests/features/**/*.feature --tags '@api' --require ${path.join('tests', 'support', 'worlds.js')} --require ${path.join('tests', 'support', 'hooks', 'hooks.js')} --format progress-bar --format json:${path.join('reports', 'cucumber-api-report.json')}`,
  websocket: `tests/features/**/*.feature --tags '@websocket' --require ${path.join('tests', 'support', 'worlds.js')} --require ${path.join('tests', 'support', 'hooks', 'hooks.js')} --format progress-bar --format json:${path.join('reports', 'cucumber-websocket-report.json')}`
};
