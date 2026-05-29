const WebSocketTestClient = require('../tests/utils/websocket.client');
(async () => {
  const client = new WebSocketTestClient({ url: process.env.WEBSOCKET_URL || 'wss://echo.websocket.events' });
  await client.connect();
  client.send('stream hello');
  const message = await client.waitForMessage(msg => msg.includes('hello'), { timeoutMs: 5000 });
  console.log('Streaming validation result:', message);
  await client.close();
})();
