class FlakyTestDetector {
  constructor() {
    this.history = {};
  }

  recordFailure(scenarioName) {
    this.history[scenarioName] = this.history[scenarioName] || [];
    this.history[scenarioName].push('fail');
  }

  recordSuccess(scenarioName) {
    this.history[scenarioName] = this.history[scenarioName] || [];
    this.history[scenarioName].push('pass');
  }

  getFlakyTests() {
    return Object.entries(this.history)
      .filter(([, events]) => events.includes('fail') && events.includes('pass'))
      .map(([scenarioName]) => scenarioName);
  }
}

module.exports = FlakyTestDetector;
