'use strict';

/**
 * Circuit Breaker — protects external calls (Jira, LLM) from cascading failures.
 *
 * States:
 *   CLOSED     — calls pass through normally
 *   OPEN       — calls fail immediately (no network traffic)
 *   HALF_OPEN  — one probe call is allowed to test recovery
 *
 * @example
 * const cb = new CircuitBreaker({ name: 'jira', failureThreshold: 3, resetTimeoutMs: 10000 });
 * const result = await cb.call(() => jiraClient.getIssue('JIRA-1'));
 */

const { logger } = require('./logger');

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
  /**
   * @param {object} opts
   * @param {string} opts.name               - identifier for logging
   * @param {number} [opts.failureThreshold=3] - consecutive failures before opening
   * @param {number} [opts.resetTimeoutMs=15000] - time before trying HALF_OPEN
   * @param {number} [opts.successThreshold=1]   - successes in HALF_OPEN to close
   */
  constructor(opts = {}) {
    this.name             = opts.name || 'default';
    this.failureThreshold = opts.failureThreshold || 3;
    this.resetTimeoutMs   = opts.resetTimeoutMs  || 15000;
    this.successThreshold = opts.successThreshold || 1;

    this._state           = STATE.CLOSED;
    this._failures        = 0;
    this._successes       = 0;
    this._openedAt        = null;
    this._log             = logger.child(`circuit-breaker:${this.name}`);
  }

  get state() { return this._state; }

  /** Execute fn through the breaker */
  async call(fn) {
    this._maybeTransitionFromOpen();

    if (this._state === STATE.OPEN) {
      const err = new Error(`CircuitBreaker[${this.name}] is OPEN — call blocked`);
      err.code = 'CIRCUIT_OPEN';
      throw err;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _maybeTransitionFromOpen() {
    if (this._state === STATE.OPEN) {
      const elapsed = Date.now() - this._openedAt;
      if (elapsed >= this.resetTimeoutMs) {
        this._log.info('Transitioning to HALF_OPEN');
        this._state = STATE.HALF_OPEN;
        this._successes = 0;
      }
    }
  }

  _onSuccess() {
    if (this._state === STATE.HALF_OPEN) {
      this._successes++;
      if (this._successes >= this.successThreshold) {
        this._log.info('Closing circuit after recovery');
        this._state = STATE.CLOSED;
        this._failures = 0;
      }
    } else {
      this._failures = 0;
    }
  }

  _onFailure(err) {
    this._failures++;
    this._log.warn('Call failed', { failures: this._failures, error: err.message });
    if (this._failures >= this.failureThreshold || this._state === STATE.HALF_OPEN) {
      this._log.error('Opening circuit', { failures: this._failures });
      this._state    = STATE.OPEN;
      this._openedAt = Date.now();
      this._failures = 0;
    }
  }

  reset() {
    this._state    = STATE.CLOSED;
    this._failures = 0;
    this._successes = 0;
    this._openedAt  = null;
  }

  stats() {
    return {
      name:     this.name,
      state:    this._state,
      failures: this._failures,
      openedAt: this._openedAt
    };
  }
}

module.exports = { CircuitBreaker, STATE };
