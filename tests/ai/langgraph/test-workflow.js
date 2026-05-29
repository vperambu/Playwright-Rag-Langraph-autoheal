class TestWorkflow {
  constructor() {
    this.nodes = ['plan', 'execute', 'verify'];
  }

  async run() {
    return { status: 'passed', path: this.nodes };
  }
}

module.exports = TestWorkflow;
