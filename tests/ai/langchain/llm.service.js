'use strict';

/**
 * LlmService — unified LLM gateway.
 *
 * Backward-compatible: existing callers ( simulate-*.js, etc.) continue to work unchanged.
 *
 * Routing:
 *   USE_LLM=true  → routes to Ollama (via orchestration/llm/ollama.client.js)
 *   USE_LLM=false → returns deterministic simulation string (original behaviour)
 *
 * Set USE_LLM=true in your .env to activate real LLM calls.
 * Set OLLAMA_HOST / OLLAMA_MODEL to configure (defaults: localhost:11434, llama3.2)
 */

const path = require('path');

class LlmService {
  constructor() {
    this._useLlm = process.env.USE_LLM === 'true';
    this._client = null;
  }

  _getClient() {
    if (!this._client) {
      try {
        this._client = require(path.resolve(__dirname, '../../../orchestration/llm/ollama.client'));
      } catch (err) {
        console.warn('[LlmService] Could not load OllamaClient:', err.message);
        this._client = null;
      }
    }
    return this._client;
  }

  /**
   * Complete a prompt — drops into Ollama chat if USE_LLM=true.
   * @param {string} prompt
   * @param {object} [opts]
   * @param {string} [opts.system]      - optional system prompt
   * @param {number} [opts.temperature] - 0-1
   * @returns {Promise<string>}
   */
  async complete(prompt, opts = {}) {
    if (this._useLlm) {
      const client = this._getClient();
      if (client) {
        const system = opts.system || 'You are a senior QA engineer. Respond concisely and accurately.';
        return client.chat(system, prompt, { temperature: opts.temperature ?? 0.3 });
      }
    }
    // Fallback: original deterministic simulation
    return `Simulated response for prompt: ${prompt.slice(0, 120)}...`;
  }

  /** Convenience: structured JSON completion. Returns parsed object or null. */
  async completeJson(prompt, opts = {}) {
    const jsonPrompt = prompt + '\n\nRespond with valid JSON only. No explanation, no markdown fences.';
    const raw = await this.complete(jsonPrompt, { ...opts, temperature: opts.temperature ?? 0.1 });
    try {
      // Strip markdown code fences if model adds them
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  get isLive() { return this._useLlm; }
}

module.exports = new LlmService();
