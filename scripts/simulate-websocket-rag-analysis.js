const { buildWebSocketIssueArtifact } = require('../tests/rag/websocket-rag-utils');
const artifact = buildWebSocketIssueArtifact('wss://echo.websocket.events', ['hello', 'hello']);
console.log('WebSocket RAG artifact:', artifact);
