const reporter = require('multiple-cucumber-html-reporter');
const path = require('path');

reporter.generate({
  jsonDir: path.resolve('reports'),
  reportPath: path.resolve('reports', 'html-report'),
  metadata: { browser: process.env.BROWSER || 'chromium', platform: process.platform },
  customData: { title: 'Cucumber Report', data: [{ label: 'Project', value: 'Playwright Cucumber Framework' }] }
});
console.log('Generated HTML report');
