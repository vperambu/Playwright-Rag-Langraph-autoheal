'use strict';

/**
 * Retry utility with exponential back-off + jitter.
 * Zero external dependencies — uses only setTimeout.
 *
 * @example
 * const result = await withRetry(() => jiraClient.getIssue('JIRA-1'), {
 *   attempts: 3, baseDelayMs: 500, factor: 2, jitter: true
 * });
 */

const { logger } = require('./logger');
const retryLogger = logger.child('retry');

/**
 * @param {() => Promise<any>} fn         - async function to retry
 * @param {object}             opts
 * @param {number}  [opts.attempts=3]     - total attempts (including first)
 * @param {number}  [opts.baseDelayMs=300]- initial delay
 * @param {number}  [opts.factor=2]       - back-off multiplier
 * @param {boolean} [opts.jitter=true]    - add ±20% random jitter
 * @param {(err: Error) => boolean} [opts.retryIf] - predicate; defaults to always retry
 * @returns {Promise<any>}
 */
async function withRetry(fn, opts = {}) {
  const {
    attempts  = 3,
    baseDelayMs = 300,
    factor    = 2,
    jitter    = true,
    retryIf   = () => true
  } = opts;

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !retryIf(err)) {
        break;
      }
      let delay = baseDelayMs * Math.pow(factor, attempt - 1);
      if (jitter) delay = delay * (0.8 + Math.random() * 0.4);
      retryLogger.warn('Retrying after error', {
        attempt,
        nextAttemptIn: Math.round(delay),
        error: err.message
      });
      await sleep(Math.round(delay));
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { withRetry, sleep };
