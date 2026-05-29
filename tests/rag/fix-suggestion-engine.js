class FixSuggestionEngine {
  constructor(vectorStore, embedder, repository) {
    this.vectorStore = vectorStore;
    this.embedder = embedder;
    this.repository = repository;
  }

  suggestFix(errorText) {
    const queryEmbedding = this.embedder.embed(errorText);
    const similar = this.vectorStore.query(queryEmbedding, 2);
    return similar.map(entry => `Consider ${entry.metadata.fixSuggestion || 'reviewing the selector and API payload.'}`);
  }
}

module.exports = FixSuggestionEngine;
