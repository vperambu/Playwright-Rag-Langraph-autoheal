'use strict';

/**
 * OllamaClient — HTTP client for local Ollama server.
 *
 * Ollama exposes two compatible APIs:
 *   POST /api/generate    — raw completion (stream or single)
 *   POST /api/chat        — OpenAI-style messages array
 *
 * We use /api/chat so prompts are structured with system + user roles.
 *
 * Required env vars:
 *   OLLAMA_HOST   default: http://localhost:11434
 *   OLLAMA_MODEL  default: llama3.2
 *
 * All calls go through the existing CircuitBreaker + withRetry for resilience.
 */

const http    = require('http');
const https   = require('https');
const { URL } = require('url');
const { withRetry }     = require('../core/retry');
const { CircuitBreaker } = require('../core/circuit-breaker');
const { logger }        = require('../core/logger');

const ollamaLog = logger.child('OllamaClient');

class OllamaClient {
  constructor() {
    this.host  = (process.env.OLLAMA_HOST  || 'http://localhost:11434').replace(/\/$/, '');
    this.model = process.env.OLLAMA_MODEL  || 'llama3.2';
    this._cb   = new CircuitBreaker({ name: 'ollama', failureThreshold: 3, resetTimeoutMs: 10000 });
  }

  /**
   * Chat completion — returns the assistant message text.
   * @param {string}   systemPrompt
   * @param {string}   userPrompt
   * @param {object}   [opts]
   * @param {number}   [opts.temperature=0.3]
   * @param {number}   [opts.timeoutMs=60000]
   * @returns {Promise<string>}
   */
  async chat(systemPrompt, userPrompt, opts = {}) {
    const body = JSON.stringify({
      model:   this.model,
      stream:  false,
      options: { temperature: opts.temperature ?? 0.3 },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ]
    });

    ollamaLog.debug('Sending chat request', { model: this.model, promptLength: userPrompt.length });

    const raw = await withRetry(
      () => this._cb.call(() => this._post('/api/chat', body, opts.timeoutMs || 60000)),
      { attempts: 3, baseDelayMs: 1000, retryIf: err => !err.message.includes('404') }
    );

    try {
      const parsed = JSON.parse(raw);
      const text   = parsed.message?.content || parsed.response || '';
      ollamaLog.debug('Response received', { length: text.length });
      return text.trim();
    } catch {
      return raw.trim();
    }
  }

  /**
   * Simple completion — wraps the raw /api/generate endpoint.
   * Useful for structured JSON output where you inject format instructions.
   */
  async complete(prompt, opts = {}) {
    const body = JSON.stringify({
      model:   this.model,
      prompt,
      stream:  false,
      format:  opts.format || undefined,
      options: { temperature: opts.temperature ?? 0.2 }
    });

    const raw    = await withRetry(
      () => this._cb.call(() => this._post('/api/generate', body, opts.timeoutMs || 60000)),
      { attempts: 3, baseDelayMs: 1000 }
    );
    const parsed = JSON.parse(raw);
    return (parsed.response || '').trim();
  }

  /** Check if Ollama is reachable and the model is available */
  async healthCheck() {
    try {
      const raw    = await this._get('/api/tags', 5000);
      const parsed = JSON.parse(raw);
      const models = (parsed.models || []).map(m => m.name);
      const ok     = models.some(m => m.startsWith(this.model.replace(':latest', '')));
      return { reachable: true, modelAvailable: ok, availableModels: models };
    } catch (err) {
      return { reachable: false, modelAvailable: false, error: err.message };
    }
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────────

  _post(path, body, timeoutMs) {
    return this._request('POST', path, body, timeoutMs);
  }

  _get(path, timeoutMs) {
    return this._request('GET', path, null, timeoutMs);
  }

  _request(method, path, body, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const url     = new URL(this.host + path);
      const isHttps = url.protocol === 'https:';
      const lib     = isHttps ? https : http;
      const options = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
        },
        timeout: timeoutMs
      };

      const req = lib.request(options, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) {
            const err = new Error(`Ollama ${res.statusCode}: ${raw.slice(0, 200)}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          resolve(raw);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Ollama request timed out after ${timeoutMs}ms`));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

// Singleton
module.exports = new OllamaClient();
