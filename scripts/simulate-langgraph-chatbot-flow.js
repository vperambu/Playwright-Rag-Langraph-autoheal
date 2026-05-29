const { TestWorkflow, SelfHealingWorkflow } = require('../tests/ai/langgraph');
(async () => {
  const workflow = new TestWorkflow();
  const result = await workflow.run();
  console.log('LangGraph test workflow result:', result);
  const healing = new SelfHealingWorkflow();
  const recovery = await healing.run({ message: 'Selector failed' });
  console.log('Self-healing workflow result:', recovery);
})();
