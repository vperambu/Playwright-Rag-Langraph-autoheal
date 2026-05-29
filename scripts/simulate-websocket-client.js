const WebSocketTestClient = require('../tests/utils/websocket.client');
(async () => {
  const client = new WebSocketTestClient({ url: process.env.WEBSOCKET_URL || 'wss://echo.websocket.events', reconnect: false });
  await client.connect();
  client.send('ping');
  const message = await client.waitForMessage(msg => msg.includes('ping'), { timeoutMs: 5000 });
  console.log('Received echo message:', message);
  await client.close();
})();
