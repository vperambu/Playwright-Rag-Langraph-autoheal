const WebSocket = require('ws');

class WebSocketTestClient {
  constructor({ url, headers = {}, reconnect = false, maxReconnectAttempts = 3 }) {
    this.url = url;
    this.headers = headers;
    this.reconnect = reconnect;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.attempts = 0;
    this.connection = null;
    this.messages = [];
    this.resolveQueue = [];
    this.closed = false;
    this.reconnectTimer = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connection = new WebSocket(this.url, { headers: this.headers });
      this.connection.on('open', () => {
        this.attempts = 0;
        resolve(this);
      });
      this.connection.on('message', data => {
        this.messages.push(data.toString());
        this.resolveQueue.forEach(({ predicate, resolve }) => {
          if (predicate(data.toString())) resolve(data.toString());
        });
        this.resolveQueue = this.resolveQueue.filter(entry => !entry.predicate(data.toString()));
      });
      this.connection.on('close', () => {
        if (!this.closed && this.reconnect && this.attempts < this.maxReconnectAttempts) {
          this.attempts += 1;
          this.reconnectTimer = setTimeout(() => this.connect(), 500 * this.attempts);
        }
      });
      this.connection.on('error', err => reject(err));
    });
  }

  send(payload) {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.connection.send(message);
    return message;
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.connection) return Promise.resolve();
    return new Promise(resolve => {
      this.connection.on('close', () => resolve());
      this.connection.close();
    });
  }

  getMessages() {
    return [...this.messages];
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1] || null;
  }

  clearMessages() {
    this.messages = [];
  }

  waitForMessage(predicate, { timeoutMs = 10000 } = {}) {
    return new Promise((resolve, reject) => {
      const matched = this.messages.find(predicate);
      if (matched) return resolve(matched);
      const timeout = setTimeout(() => {
        this.resolveQueue = this.resolveQueue.filter(entry => entry.predicate !== predicate);
        reject(new Error('Timed out waiting for WebSocket message'));
      }, timeoutMs);
      this.resolveQueue.push({ predicate, resolve: value => {
        clearTimeout(timeout);
        resolve(value);
      } });
    });
  }
}

module.exports = WebSocketTestClient;
