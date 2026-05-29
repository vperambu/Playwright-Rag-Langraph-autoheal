const ObservabilityService = require('../tests/observability');
(async () => {
  const scenario = ObservabilityService.startScenario('observability-demo');
  scenario.recordStep('load', 'passed', 1200);
  scenario.recordStep('validate', 'passed', 300);
  await ObservabilityService.endScenario('observability-demo', { status: 'PASSED', duration: 1500 });
  await ObservabilityService.flushMetrics();
})();
