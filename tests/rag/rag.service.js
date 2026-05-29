const MockVectorStore = require('./mock-vector-store');
const TextEmbedder = require('./text-embedder');
const TestArtifactRepository = require('./test-artifact-repository');
const FixSuggestionEngine = require('./fix-suggestion-engine');

class RagService {
  constructor() {
    this.store = new MockVectorStore();
    this.embedder = new TextEmbedder();
    this.repository = new TestArtifactRepository();
    this.suggestionEngine = new FixSuggestionEngine(this.store, this.embedder, this.repository);
  }

  ingestArtifact(scenarioName, text, metadata = {}) {
    const embedding = this.embedder.embed(text);
    this.store.add({ id: scenarioName, embedding, metadata });
    this.repository.saveArtifact(scenarioName, { text, metadata, createdAt: new Date().toISOString() });
  }

  analyzeFailure(errorText) {
    return this.suggestionEngine.suggestFix(errorText);
  }
}

module.exports = new RagService();
