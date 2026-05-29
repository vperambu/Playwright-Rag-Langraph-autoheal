class MockVectorStore {
  constructor() {
    this.entries = [];
  }

  add({ id, embedding, metadata }) {
    this.entries.push({ id, embedding, metadata });
  }

  query(embedding, topK = 3) {
    const scores = this.entries.map(entry => ({
      entry,
      score: this.cosineSimilarity(embedding, entry.embedding)
    }));
    return scores.sort((a, b) => b.score - a.score).slice(0, topK).map(item => item.entry);
  }

  cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, index) => sum + val * (b[index] || 0), 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return magA && magB ? dot / (magA * magB) : 0;
  }
}

module.exports = MockVectorStore;
