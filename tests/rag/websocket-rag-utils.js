function summarizeWebSocketMessages(messages) {
  return messages.map((msg, index) => ({ index, length: msg.length, snippet: msg.slice(0, 80) }));
}

function buildWebSocketIssueArtifact(url, messages) {
  return { url, summary: summarizeWebSocketMessages(messages), count: messages.length };
}

module.exports = {
  summarizeWebSocketMessages,
  buildWebSocketIssueArtifact
};
