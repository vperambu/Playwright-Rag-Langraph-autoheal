class StructuredLogger {
  log(level, message, meta = {}) {
    const entry = {
      level,
      message,
      meta,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(entry));
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }
}

module.exports = StructuredLogger;
