const WebSocket = require('ws');

class LocalWebSocketServer {
  constructor(port = 8080) {
    this.port = port;
    this.server = null;
  }

  async start() {
    if (this.server) return;
    this.server = new WebSocket.Server({ port: this.port });
    this.server.on('connection', ws => {
      ws.on('message', message => {
        ws.send(message);
      });
    });
    await new Promise(resolve => this.server.once('listening', resolve));
  }

  url() {
    return `ws://127.0.0.1:${this.port}`;
  }

  async stop() {
    if (!this.server) return;
    await new Promise(resolve => this.server.close(resolve));
    this.server = null;
  }
}

module.exports = LocalWebSocketServer;
