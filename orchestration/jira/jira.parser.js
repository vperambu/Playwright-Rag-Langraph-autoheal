'use strict';

/**
 * JiraParser — converts raw Jira REST API issue JSON into a normalized context object.
 *
 * Handles:
 *  - Jira Cloud Atlassian Document Format (ADF) → plain text
 *  - Plain-text fallbacks for Jira Server / Data Center
 *  - Acceptance Criteria extraction (looks for AC / Acceptance Criteria sections)
 *  - Domain keyword detection (chat, AEM, analytics, generic-ui, api, websocket)
 *  - Risk + constraint signal extraction
 */

const DOMAIN_KEYWORDS = {
  chat:       ['chat', 'message', 'websocket', 'ws://', 'wss://', 'chatbot', 'conversation'],
  aem:        ['aem', 'adobe experience', 'content fragment', 'dam', 'dispatcher', 'sling'],
  analytics:  ['analytics', 'tracking', 'gtm', 'google tag', 'mixpanel', 'amplitude', 'segment', 'event tracking'],
  api:        ['api', 'rest', 'endpoint', 'payload', 'request', 'response', 'status code', 'json'],
  websocket:  ['websocket', 'ws://', 'wss://', 'socket.io', 'real-time', 'streaming'],
  'generic-ui': ['login', 'button', 'form', 'modal', 'navigation', 'page', 'click', 'input', 'dropdown']
};

const RISK_SIGNALS   = ['race condition', 'flaky', 'timing', 'async', 'timeout', 'retry', 'rate limit', 'auth', 'token'];
const CONSTRAINT_SIGNALS = ['must not', 'should not', 'forbidden', 'required', 'mandatory', 'compliance', 'gdpr', 'pci'];

class JiraParser {
  /**
   * Main entry — converts raw Jira issue JSON → GroundingContext.
   * @param {object} issue  Raw JSON from Jira REST API
   * @returns {NormalizedIssue}
   */
  parse(issue) {
    const f = issue.fields || {};

    const title       = f.summary || issue.key || 'Untitled';
    const descText    = this._adfToText(f.description);
    const comments    = this._parseComments(f.comment);
    const allText     = [title, descText, ...comments].join('\n');

    const ac          = this._extractAcceptanceCriteria(descText, comments);
    const domain      = this._detectDomain(allText);
    const risks       = this._extractSignals(allText, RISK_SIGNALS);
    const constraints = this._extractSignals(allText, CONSTRAINT_SIGNALS);
    const requirements = this._extractRequirements(descText, ac);

    return {
      ticketId:   issue.key,
      title,
      description: descText,
      acceptanceCriteria: ac,
      requirements,
      comments,
      domain,
      risks,
      constraints,
      labels:     f.labels || [],
      status:     f.status?.name || 'Unknown',
      priority:   f.priority?.name || 'Medium',
      issueType:  f.issuetype?.name || 'Story',
      rawIssue:   issue
    };
  }

  /**
   * Convert Atlassian Document Format (ADF) to plain text.
   * Falls back gracefully to string content for Jira Server (plain text) format.
   */
  _adfToText(content) {
    if (!content) return '';
    // Jira Server: content is a plain string
    if (typeof content === 'string') return content.trim();
    // Jira Cloud: content is ADF JSON object
    if (typeof content === 'object') return this._walkAdf(content);
    return '';
  }

  _walkAdf(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;

    const parts = [];
    if (node.text) parts.push(node.text);

    if (Array.isArray(node.content)) {
      node.content.forEach(child => parts.push(this._walkAdf(child)));
    }

    // Add newline after block-level nodes
    const BLOCK_TYPES = ['paragraph', 'bulletList', 'orderedList', 'listItem', 'heading', 'rule', 'codeBlock', 'blockquote'];
    if (BLOCK_TYPES.includes(node.type)) {
      parts.push('\n');
    }
    return parts.join('');
  }

  _parseComments(comment) {
    if (!comment || !Array.isArray(comment.comments)) return [];
    return comment.comments.map(c => this._adfToText(c.body)).filter(Boolean);
  }

  /** Extract Acceptance Criteria lines from description + comments */
  _extractAcceptanceCriteria(descText, comments) {
    const AC_HEADERS = /acceptance criteria|ac:|given|scenario|gherkin|definition of done/i;
    const STOP_HEADERS = /technical notes|technical detail|implementation|notes|background|context/i;
    const allBlocks  = [descText, ...comments];
    const ac         = [];

    for (const block of allBlocks) {
      const lines = block.split('\n');
      let inAcSection = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (AC_HEADERS.test(trimmed)) { inAcSection = true; continue; }

        // Stop AC section if we hit another non-AC heading
        if (inAcSection && STOP_HEADERS.test(trimmed)) {
          inAcSection = false;
          continue;
        }

        if (inAcSection) {
          // Accept: prefixed bullets, Gherkin keywords, OR plain non-heading lines
          // (ADF list items arrive as plain text without bullet prefix)
          const isBullet   = trimmed.startsWith('-') || trimmed.startsWith('*');
          const isNumbered = /^\d+\./.test(trimmed);
          const isGherkin  = /^(Given|When|Then|And)\s/i.test(trimmed);
          const isHeading  = /^#{1,4}\s/.test(trimmed) || trimmed.length < 5;

          if (!isHeading && (isBullet || isNumbered || isGherkin || trimmed.length > 10)) {
            const clean = trimmed.replace(/^[-*\d.]+\s*/, '').trim();
            if (clean.length > 5) ac.push(clean);
          }
        }
      }
    }

    // Deduplicate and cap
    return [...new Set(ac)].slice(0, 20);
  }

  /** Extract numbered/bulleted requirements from description */
  _extractRequirements(descText, ac) {
    const reqs = new Set();
    // Add AC as requirements
    ac.forEach(a => reqs.add(a));
    // Also pick up numbered lines from description
    descText.split('\n').forEach(line => {
      const m = line.trim().match(/^(\d+)\.\s+(.+)/);
      if (m) reqs.add(m[2].trim());
    });
    return [...reqs].slice(0, 30); // cap at 30
  }

  _detectDomain(text) {
    const lower = text.toLowerCase();
    const scores = {};
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      scores[domain] = keywords.filter(k => lower.includes(k)).length;
    }
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > 0 ? sorted[0][0] : 'generic-ui';
  }

  _extractSignals(text, signals) {
    const lower = text.toLowerCase();
    return signals.filter(s => lower.includes(s));
  }
}

module.exports = new JiraParser();
