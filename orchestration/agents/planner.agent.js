'use strict';

/**
 * PlannerAgent
 *
 * Responsibility: GroundingContext → prioritized TestPlan.
 *
 * Input:  { groundingContext: GroundingContext, mode, ticketId }
 * Output: TestPlan { ticketId, scenarios[], requirements[] }
 *
 * When USE_LLM=true (Ollama live):
 *   - Uses llama3.2 to generate richer, context-aware step descriptions
 *   - Falls back to rule-based generation if Ollama is unreachable
 *
 * When USE_LLM=false (mock):
 *   - Pure rule-based generation (no network calls)
 */

const path      = require('path');
const AgentBase = require('../core/agent-base');

// Lazy-load LlmService so mock mode never touches Ollama
let _llmService = null;
function getLlm() {
  if (!_llmService) {
    try { _llmService = require(path.resolve(__dirname, '../../tests/ai/langchain/llm.service')); }
    catch { _llmService = null; }
  }
  return _llmService;
}

const DOMAIN_TEMPLATES = {
  'generic-ui': {
    edge: [
      'Verify page behaviour with JavaScript disabled',
      'Verify form submission with maximum field length values',
      'Verify keyboard-only navigation (Tab + Enter) completes the flow',
      'Verify back-button behaviour after successful action'
    ]
  },
  chat: {
    edge: [
      'Verify WebSocket reconnection after network drop',
      'Verify message order under high-frequency sends',
      'Verify chat UI with empty message body',
      'Verify connection status indicator during latency'
    ]
  },
  api: {
    edge: [
      'Verify API response schema matches contract',
      'Verify API handles malformed JSON body gracefully',
      'Verify rate-limit response (HTTP 429) is surfaced correctly',
      'Verify API timeout triggers correct error UI'
    ]
  },
  aem: {
    edge: [
      'Verify component renders correctly without author-mode classes',
      'Verify content fragment fields are nullable without breaking render',
      'Verify dispatcher cache invalidation after publish'
    ]
  },
  analytics: {
    edge: [
      'Verify analytics event fires exactly once per user action',
      'Verify no duplicate tracking calls on page reload',
      'Verify event payload contains required dimensions'
    ]
  },
  websocket: {
    edge: [
      'Verify graceful degradation when WebSocket server is unavailable',
      'Verify message delivery guarantee after reconnect',
      'Verify binary frame handling alongside text frames'
    ]
  }
};

let scenarioCounter = 0;
function nextId(ticketId) {
  scenarioCounter++;
  return `${ticketId}-SC-${String(scenarioCounter).padStart(3, '0')}`;
}

class PlannerAgent extends AgentBase {
  constructor(opts = {}) {
    super('PlannerAgent', opts);
  }

  async execute(input) {
    const { groundingContext, ticketId, mode } = input;
    if (!groundingContext) throw new Error('groundingContext is required');

    scenarioCounter = 0; // reset per run
    const ctx       = groundingContext;
    const scenarios = [];

    // Determine if we should use LLM for step enrichment
    const llm     = getLlm();
    const useLlm  = llm && llm.isLive && mode !== 'mock';
    if (useLlm) {
      this.log.info('LLM enrichment ENABLED via Ollama', { model: process.env.OLLAMA_MODEL || 'llama3.2' });
    }

    // ── Positive scenarios (one per AC) ───────────────────────────────────────
    for (const ac of ctx.acceptanceCriteria) {
      const steps = useLlm
        ? await this._llmSteps(llm, ac, 'positive', ctx)
        : this._derivePositiveSteps(ac, ctx);

      scenarios.push({
        id:              nextId(ticketId),
        title:           `[POSITIVE] ${ac}`,
        type:            'positive',
        priority:        'P0',
        requirementRef:  ac,
        steps,
        testData:        this._deriveTestData(ac, 'positive'),
        expectedOutcome: this._deriveExpectedOutcome(ac),
        tags:            ['smoke', 'regression', ctx.domain]
      });
    }

    // ── Negative scenarios (invert each AC) ───────────────────────────────────
    for (const ac of ctx.acceptanceCriteria) {
      const neg = useLlm
        ? await this._llmNegateAc(llm, ac, ctx)
        : this._negateAc(ac);
      if (neg) {
        scenarios.push({
          id:              nextId(ticketId),
          title:           `[NEGATIVE] ${neg.title}`,
          type:            'negative',
          priority:        'P1',
          requirementRef:  ac,
          steps:           neg.steps,
          testData:        this._deriveTestData(ac, 'negative'),
          expectedOutcome: neg.expected,
          tags:            ['regression', ctx.domain]
        });
      }
    }

    // ── Edge scenarios (domain templates + risk signals) ──────────────────────
    const domainEdges = (DOMAIN_TEMPLATES[ctx.domain] || DOMAIN_TEMPLATES['generic-ui']).edge;
    for (const edge of domainEdges) {
      scenarios.push({
        id:              nextId(ticketId),
        title:           `[EDGE] ${edge}`,
        type:            'edge',
        priority:        'P2',
        requirementRef:  null,
        steps:           [
          `Given the application is in a state where: ${edge}`,
          'When the user triggers the boundary condition',
          'Then the system handles it gracefully without crashing'
        ],
        testData:        {},
        expectedOutcome: 'No unhandled error or data loss',
        tags:            ['edge', ctx.domain]
      });
    }

    // Risk-derived edge scenarios
    for (const risk of ctx.risks.slice(0, 3)) {
      scenarios.push({
        id:              nextId(ticketId),
        title:           `[EDGE] Risk — ${risk}`,
        type:            'edge',
        priority:        'P2',
        requirementRef:  null,
        steps:           [
          `Given the application encounters a ${risk} condition`,
          'When the user continues their workflow',
          'Then the system recovers or shows a meaningful error'
        ],
        testData:        {},
        expectedOutcome: 'Graceful handling with user-facing message',
        tags:            ['edge', 'risk', ctx.domain]
      });
    }

    this.log.info('Plan complete', {
      positive: scenarios.filter(s => s.type === 'positive').length,
      negative: scenarios.filter(s => s.type === 'negative').length,
      edge:     scenarios.filter(s => s.type === 'edge').length
    });

    return {
      ticketId,
      domain:       ctx.domain,
      title:        ctx.title,
      requirements: ctx.requirements,
      scenarios
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  _derivePositiveSteps(ac, ctx) {
    const lower = ac.toLowerCase();
    const steps = [`Given the user navigates to the ${ctx.domain} page`];

    if (lower.includes('enter') || lower.includes('input') || lower.includes('fill')) {
      steps.push('When the user fills in the required fields with valid data');
    }
    if (lower.includes('click') || lower.includes('submit') || lower.includes('button')) {
      steps.push('When the user clicks the submit button');
    }
    if (lower.includes('login') || lower.includes('credential')) {
      steps.push('When the user enters valid credentials');
      steps.push('And submits the login form');
    }
    if (lower.includes('redirect') || lower.includes('navigate')) {
      steps.push(`Then the user is redirected to the expected page`);
    }
    if (lower.includes('error') || lower.includes('message') || lower.includes('show')) {
      steps.push('Then the appropriate message is displayed');
    }
    if (steps.length < 3) {
      steps.push('When the user performs the action described in the requirement');
      steps.push('Then the expected outcome matches acceptance criteria');
    }
    return steps;
  }

  _negateAc(ac) {
    const lower = ac.toLowerCase();

    if (lower.includes('valid') || lower.includes('correct')) {
      return {
        title:    `${ac.replace(/valid|correct/gi, 'invalid')}`,
        steps:    [
          'Given the user is on the relevant page',
          'When the user enters invalid or missing data',
          'And submits the form'
        ],
        expected: 'Validation error is shown; no redirect occurs'
      };
    }
    if (lower.includes('redirect') || lower.includes('navigates')) {
      return {
        title:    `Verify NO redirect occurs on failed action`,
        steps:    [
          'Given the user is on the relevant page',
          'When the prerequisite condition is NOT met',
          'And the user attempts the action'
        ],
        expected: 'User remains on current page with an error indicator'
      };
    }
    if (lower.includes('error') || lower.includes('message')) {
      return {
        title:    `Verify correct error message for invalid input`,
        steps:    [
          'Given the user triggers an invalid state',
          'When the system processes the request'
        ],
        expected: 'Exact error message text matches specification'
      };
    }
    if (lower.includes('expires') || lower.includes('timeout') || lower.includes('lock')) {
      return {
        title:    `Verify boundary — exactly at expiry/lock threshold`,
        steps:    [
          'Given the user is 1 second before the expiry threshold',
          'When the threshold is crossed',
          'Then the timeout/lock is enforced'
        ],
        expected: 'System enforces limit at exact boundary'
      };
    }
    // Generic fallback negative
    return {
      title:    `Verify system rejects invalid state for: ${ac.slice(0, 60)}`,
      steps:    [
        'Given the precondition for the requirement is deliberately unmet',
        'When the user interacts with the feature',
        'Then the system rejects the action with a clear error'
      ],
      expected: 'Error state handled gracefully'
    };
  }

  _deriveTestData(ac, type) {
    const lower = ac.toLowerCase();
    if (type === 'positive') {
      const data = {};
      if (lower.includes('email')) data.email = process.env.TEST_USER_EMAIL || 'testuser@example.com';
      if (lower.includes('password')) data.password = 'ValidPassword123!';
      if (lower.includes('otp') || lower.includes('code')) data.otp = '123456';
      if (lower.includes('30 days') || lower.includes('remember')) data.rememberMe = true;
      return data;
    }
    // negative
    const data = {};
    if (lower.includes('email')) data.email = 'not-an-email';
    if (lower.includes('password')) data.password = '';
    if (lower.includes('otp') || lower.includes('code')) data.otp = '000000';
    return data;
  }

  // ── LLM-powered helpers (live/ci mode only) ─────────────────────────────────

  async _llmSteps(llm, ac, type, ctx) {
    const system = `You are a senior QA engineer writing Playwright BDD test steps.
Output ONLY a JSON array of 3-5 step strings starting with Given/When/Then/And.
No explanation, no markdown. Example: ["Given the user is on the login page","When the user fills valid credentials","Then the user is redirected to dashboard"]`;

    const user = `Write ${type} Playwright test steps for this acceptance criterion:
"${ac}"
Domain: ${ctx.domain}
Ticket: ${ctx.title}`;

    try {
      const result = await llm.completeJson(user, { system });
      if (Array.isArray(result) && result.length > 0) return result;
    } catch (err) {
      this.log.warn('LLM step generation failed, using rule-based fallback', { error: err.message });
    }
    // Fallback to rule-based
    return type === 'positive'
      ? this._derivePositiveSteps(ac, ctx)
      : ['Given an invalid precondition', 'When the user attempts the action', 'Then an appropriate error is shown'];
  }

  async _llmNegateAc(llm, ac, ctx) {
    const system = `You are a senior QA engineer. Given an acceptance criterion, produce a negative test scenario.
Output ONLY valid JSON: {"title":"...","steps":["...","...","..."],"expected":"..."}
No markdown, no explanation.`;

    const user = `Create a negative test scenario for:
"${ac}"
Domain: ${ctx.domain}`;

    try {
      const result = await llm.completeJson(user, { system });
      if (result && result.title && Array.isArray(result.steps)) return result;
    } catch (err) {
      this.log.warn('LLM negate failed, using rule-based fallback', { error: err.message });
    }
    return this._negateAc(ac);
  }

  _deriveExpectedOutcome(ac) {
    const lower = ac.toLowerCase();
    if (lower.includes('redirect') || lower.includes('dashboard')) return 'User is on the dashboard page';
    if (lower.includes('error') || lower.includes('message'))      return 'Correct error message is visible';
    if (lower.includes('locked'))                                   return 'Account locked message is shown';
    if (lower.includes('otp') || lower.includes('code'))           return 'OTP verification step is completed';
    if (lower.includes('remember'))                                 return 'Session cookie persists for 30 days';
    return `Requirement satisfied: ${ac.slice(0, 80)}`;
  }
}

module.exports = PlannerAgent;
