class TextEmbedder {
  embed(text) {
    const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    return Array.from({ length: 16 }, (_, index) => {
      const charCode = normalized.charCodeAt(index) || 0;
      return (charCode % 10) / 10;
    });
  }
}

module.exports = TextEmbedder;
