const BasePage = require('./base.page');

class HomePage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      heroTitle: 'h1',
      getStartedLink: 'a[href*="docs/intro"]',
      searchInput: 'input[placeholder="Search docs"]'
    };
  }

  async assertLoaded() {
    await this.waitForSelector(this.selectors.heroTitle);
  }

  async open() {
    await this.navigate('/');
    await this.assertLoaded();
  }

  async clickGetStarted() {
    await this.click(this.selectors.getStartedLink);
  }

  async searchDocs(term) {
    await this.click(this.selectors.searchInput);
    await this.fill(this.selectors.searchInput, term);
    await this.page.keyboard.press('Enter');
  }
}

module.exports = HomePage;
