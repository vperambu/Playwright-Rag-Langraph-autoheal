class AiDecisionLogStore {
  constructor() {
    this.decisions = {};
  }

  record(scenarioName, entry) {
    if (!this.decisions[scenarioName]) this.decisions[scenarioName] = [];
    this.decisions[scenarioName].push({ ...entry, timestamp: new Date().toISOString() });
  }

  getDecisions(scenarioName) {
    return this.decisions[scenarioName] || [];
  }
}

module.exports = AiDecisionLogStore;
