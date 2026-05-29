class LlmService {
  async complete(prompt) {
    return `Simulated response for prompt: ${prompt.slice(0, 120)}...`;
  }
}

module.exports = new LlmService();
