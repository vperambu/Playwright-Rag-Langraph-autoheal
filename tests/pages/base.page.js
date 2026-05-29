class BasePage {
  constructor(page) {
    this.page = page;
  }

  async navigate(relativeUrl) {
    await this.page.goto(relativeUrl, { waitUntil: 'domcontentloaded' });
  }

  async click(selector) {
    await this.page.click(selector, { timeout: 15000 });
  }

  async fill(selector, text) {
    await this.page.fill(selector, text, { timeout: 15000 });
  }

  async getText(selector) {
    return this.page.textContent(selector, { timeout: 15000 });
  }

  async isVisible(selector) {
    return this.page.isVisible(selector, { timeout: 15000 });
  }

  async waitForSelector(selector) {
    return this.page.waitForSelector(selector, { timeout: 15000 });
  }

  async assertLoaded() {
    throw new Error('assertLoaded() must be implemented by child page objects');
  }
}

module.exports = BasePage;
