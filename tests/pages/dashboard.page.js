const BasePage = require('./base.page');

class DashboardPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      dashboardHeader: 'h1',
      quickStartPanel: 'main'
    };
  }

  async assertLoaded() {
    await this.waitForSelector(this.selectors.dashboardHeader);
  }

  async open() {
    await this.navigate('/dashboard');
    await this.assertLoaded();
  }

  async hasQuickStartPanel() {
    return this.isVisible(this.selectors.quickStartPanel);
  }
}

module.exports = DashboardPage;
