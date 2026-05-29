const { writeJSON, readJSON } = require('../utils/file.util');
const path = require('path');

class TestArtifactRepository {
  constructor() {
    this.folder = path.resolve('test-results', 'observability');
  }

  saveArtifact(scenarioName, artifact) {
    const filePath = path.join(this.folder, `${scenarioName.replace(/\s+/g, '_')}.artifact.json`);
    writeJSON(filePath, artifact);
  }

  loadArtifacts() {
    return readJSON(path.join(this.folder, 'summary.json')) || {};
  }
}

module.exports = TestArtifactRepository;
