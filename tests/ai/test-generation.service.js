class TestGenerationService {
  constructor() {}

  generateSteps(featureTitle) {
    return [`Given the ${featureTitle} page is available`, `When I perform the main action`, `Then I should observe the expected result`];
  }
}

module.exports = new TestGenerationService();
