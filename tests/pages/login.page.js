const BasePage = require('./base.page');

class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      emailField: 'input[name="email"]',
      passwordField: 'input[name="password"]',
      signInButton: 'button[type="submit"]',
      authTitle: 'h1'
    };
  }

  async assertLoaded() {
    await this.waitForSelector(this.selectors.authTitle);
  }

  async open() {
    await this.navigate('/login');
    await this.assertLoaded();
  }

  async login(email, password) {
    if (await this.page.isVisible(this.selectors.emailField)) {
      await this.fill(this.selectors.emailField, email);
      await this.fill(this.selectors.passwordField, password);
      await this.click(this.selectors.signInButton);
    }
  }
}

module.exports = LoginPage;
