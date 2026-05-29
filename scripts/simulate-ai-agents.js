const SelfHealingAgent = require('../tests/ai/agents/self-healing.agent');
const brokenSelector = 'button#missing';
const suggestions = SelfHealingAgent.suggestSelectors(brokenSelector);
console.log('Simulated self-healing suggestions:', suggestions);
