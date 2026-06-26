'use strict';

/**
 * Structured logger for orchestration layer.
 * Wraps existing StructuredLogger pattern with agent-context enrichment.
 * Outputs JSON lines — compatible with Datadog, CloudWatch, stdout CI logs.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class OrchestrationLogger {
  /**
   * @param {object} opts
   * @param {string} [opts.agent]   - agent name printed in every line
   * @param {string} [opts.level]   - minimum log level (default: info)
   * @param {boolean} [opts.pretty] - pretty-print JSON (default: false)
   */
  constructor(opts = {}) {
    this.agent = opts.agent || 'orchestration';
    this.minLevel = LEVELS[opts.level || process.env.LOG_LEVEL || 'info'] ?? 1;
    this.pretty = opts.pretty || process.env.LOG_PRETTY === 'true';
  }

  _write(level, message, meta = {}) {
    if ((LEVELS[level] ?? 0) < this.minLevel) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      agent: this.agent,
      message,
      ...meta
    };
    const line = this.pretty
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  debug(message, meta) { this._write('debug', message, meta); }
  info(message, meta)  { this._write('info',  message, meta); }
  warn(message, meta)  { this._write('warn',  message, meta); }
  error(message, meta) { this._write('error', message, meta); }

  /** Returns a child logger scoped to a sub-component */
  child(agentName) {
    return new OrchestrationLogger({
      agent: agentName,
      level: Object.keys(LEVELS).find(k => LEVELS[k] === this.minLevel) || 'info',
      pretty: this.pretty
    });
  }

  /** Timing helper — logs start + returns a done() function that logs duration */
  startTimer(label, meta = {}) {
    const start = Date.now();
    this.debug(`${label} started`, meta);
    return (extraMeta = {}) => {
      const durationMs = Date.now() - start;
      this.info(`${label} completed`, { ...meta, ...extraMeta, durationMs });
      return durationMs;
    };
  }
}

// Singleton root logger — agents call logger.child('AgentName')
const rootLogger = new OrchestrationLogger();
module.exports = { OrchestrationLogger, logger: rootLogger };
