class SelfHealingAgent {
  constructor() {}

  suggestSelectors(originalSelector) {
    const suggestions = [];
    if (!originalSelector) return suggestions;
    suggestions.push(`aria/${originalSelector}`);
    suggestions.push(`text=${originalSelector}`);
    suggestions.push(`[data-testid='${originalSelector.replace(/[^a-zA-Z0-9_-]/g, '_')}']`);
    return suggestions;
  }

  chooseBestSelector(suggestions) {
    return suggestions[0] || null;
  }
}

module.exports = new SelfHealingAgent();
