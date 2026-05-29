class RagChain {
  constructor(embedder, vectorStore) {
    this.embedder = embedder;
    this.vectorStore = vectorStore;
  }

  run(query) {
    const embedding = this.embedder.embed(query);
    const contexts = this.vectorStore.query(embedding, 2);
    return `RAG chain built with ${contexts.length} contexts for query: ${query}`;
  }
}

module.exports = RagChain;
