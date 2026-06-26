'use strict';

/**
 * AgentBase — abstract base class for all orchestration agents.
 *
 * Provides:
 *   - Structured logging with timing
 *   - Standardised input/output envelope
 *   - Error wrapping (never leaks raw errors into pipeline)
 *   - Optional dry-run bypass
 *
 * Every concrete agent must implement:
 *   async execute(input)  → output
 */

const { logger } = require('./logger');

class AgentBase {
  /**
   * @param {string} name  - agent identifier, e.g. 'GroundingAgent'
   * @param {object} [opts]
   * @param {boolean} [opts.dryRun] - skip side-effects when true
   */
  constructor(name, opts = {}) {
    if (!name) throw new Error('AgentBase requires a name');
    this.name   = name;
    this.dryRun = opts.dryRun || false;
    this.log    = logger.child(name);
  }

  /**
   * Public entry point — wraps execute() with logging + timing + error envelope.
   * @param {object} input
   * @returns {Promise<AgentResult>}
   */
  async run(input) {
    const done = this.log.startTimer(`${this.name}.run`);
    this.log.info('Starting', { ticketId: input.ticketId, mode: input.mode });

    try {
      this._validateInput(input);
      const output  = await this.execute(input);
      const durationMs = done({ status: 'success' });
      return this._envelope('success', output, durationMs);
    } catch (err) {
      done({ status: 'error', error: err.message });
      this.log.error('Agent failed', { error: err.message, stack: err.stack });
      return this._envelope('error', null, 0, err);
    }
  }

  /**
   * Must be implemented by subclasses.
   * @param {object} input
   * @returns {Promise<object>}
   */
  async execute(input) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.name}.execute() is not implemented`);
  }

  /**
   * Optional — subclasses can override to throw on invalid input.
   * @param {object} input
   */
  _validateInput(input) {
    if (!input || typeof input !== 'object') {
      throw new Error(`${this.name}: input must be a non-null object`);
    }
  }

  /**
   * Wraps agent output in a consistent envelope.
   * @private
   */
  _envelope(status, data, durationMs, err = null) {
    return {
      agent:      this.name,
      status,                   // 'success' | 'error'
      durationMs,
      data,                     // null on error
      error: err ? { message: err.message, stack: err.stack } : null,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AgentBase;
