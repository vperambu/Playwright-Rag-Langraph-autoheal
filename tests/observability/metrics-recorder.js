class MetricsRecorder {
  constructor() {
    this.scenarios = {};
    this.steps = {};
  }

  recordStep(scenarioName, name, status, durationMs) {
    if (!this.steps[scenarioName]) this.steps[scenarioName] = [];
    this.steps[scenarioName].push({ name, status, durationMs, timestamp: Date.now() });
  }

  recordScenarioResult(scenarioName, result) {
    this.scenarios[scenarioName] = {
      status: result.status || 'UNKNOWN',
      durationMs: result.duration || 0,
      timestamp: Date.now()
    };
  }

  getScenarioMetrics(scenarioName) {
    return {
      steps: this.steps[scenarioName] || [],
      summary: this.scenarios[scenarioName] || {}
    };
  }

  getTotals() {
    return {
      scenarios: Object.keys(this.scenarios).length,
      steps: Object.values(this.steps).reduce((sum, list) => sum + list.length, 0)
    };
  }
}

module.exports = MetricsRecorder;
