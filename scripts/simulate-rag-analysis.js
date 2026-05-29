const ragService = require('../tests/rag/rag.service');
ragService.ingestArtifact('api-failure', 'POST /users returned 500', { fixSuggestion: 'Verify request body and auth headers' });
const suggestions = ragService.analyzeFailure('Failed to create user due to 500 internal server error');
console.log('RAG suggestions:', suggestions);
