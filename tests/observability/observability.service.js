const MetricsRecorder = require('./metrics-recorder');
const StructuredLogger = require('./structured-logger');
const AiDecisionLogStore = require('./ai-decision-log-store');
const FlakyTestDetector = require('./flaky-test-detector');
const { writeJSON } = require('../utils/file.util');
const path = require('path');

class ObservabilityService {
  constructor() {
    this.metrics = new MetricsRecorder();
    this.logger = new StructuredLogger();
    this.aiLogStore = new AiDecisionLogStore();
    this.flakyDetector = new FlakyTestDetector();
  }

  startScenario(scenarioName) {
    this.logger.info('Starting scenario', { scenarioName });
    return {
      recordStep: (name, status, durationMs) => this.metrics.recordStep(scenarioName, name, status, durationMs),
      recordDecision: entry => this.aiLogStore.record(scenarioName, entry),
      markFailed: () => this.flakyDetector.recordFailure(scenarioName)
    };
  }

  async endScenario(scenarioName, result) {
    this.logger.info('Ending scenario', { scenarioName, result });
    this.metrics.recordScenarioResult(scenarioName, result);
    const outputPath = path.resolve('test-results', 'observability', `${scenarioName.replace(/\s+/g, '_')}.json`);
    writeJSON(outputPath, { scenarioName, result, metrics: this.metrics.getScenarioMetrics(scenarioName) });
  }

  async flushMetrics() {
    const payload = {
      totals: this.metrics.getTotals(),
      flaky: this.flakyDetector.getFlakyTests()
    };
    writeJSON(path.resolve('test-results', 'observability', 'summary.json'), payload);
    this.logger.info('Flushing observability metrics', payload);
  }
}

module.exports = new ObservabilityService();
