const http = require('http');
const url = require('url');

class LocalHttpServer {
  constructor(port = 0) {
    this.port = port;
    this.server = null;
  }

  async start() {
    if (this.server) return;
    this.server = http.createServer((req, res) => {
      const parsed = new URL(req.url || '/', `http://127.0.0.1:${this.port || 3000}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (parsed.pathname === '/' || parsed.pathname === '/home') {
        res.end(`<!DOCTYPE html><html><head><title>Local Home</title></head><body><h1>Playwright Local Home</h1><a href="/docs/intro">Get Started</a></body></html>`);
        return;
      }
      if (parsed.pathname === '/login') {
        res.end(`<!DOCTYPE html><html><head><title>Login</title></head><body><h1>Playwright Login</h1><form><input name="email" placeholder="Email"><input name="password" placeholder="Password"><button type="submit">Sign in</button></form></body></html>`);
        return;
      }
      if (parsed.pathname === '/dashboard') {
        res.end(`<!DOCTYPE html><html><head><title>Dashboard</title></head><body><h1>Dashboard</h1><main>Quick start content</main></body></html>`);
        return;
      }
      if (parsed.pathname === '/docs/intro') {
        res.end(`<!DOCTYPE html><html><head><title>Docs Intro</title></head><body><h1>Playwright Documentation Intro</h1><section>Documentation content</section></body></html>`);
        return;
      }
      res.statusCode = 404;
      res.end(`<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>404 Not Found</h1></body></html>`);
    });
    await new Promise(resolve => {
      this.server.listen(this.port, '127.0.0.1', () => {
        this.port = this.server.address().port;
        resolve();
      });
    });
  }

  url() {
    return `http://127.0.0.1:${this.port}`;
  }

  async stop() {
    if (!this.server) return;
    await new Promise(resolve => this.server.close(resolve));
    this.server = null;
  }
}

module.exports = LocalHttpServer;
