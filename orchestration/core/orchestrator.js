'use strict';

/**
 * Orchestrator — main state machine for the multi-agent workflow.
 *
 * Flow:
 *   GroundingAgent → PlannerAgent → CoderAgent → TesterAgent → ReviewerAgent → ReportingAgent
 *
 * Each agent receives { ticketId, mode, ...previousOutputs }.
 * On agent failure: logs error, sets status='partial', continues remaining agents.
 * Final state always written to generated/reports/<ticketId>/state.json.
 */

const path = require('path');
const fs   = require('fs');

const GroundingAgent  = require('../agents/grounding.agent');
const PlannerAgent    = require('../agents/planner.agent');
const CoderAgent      = require('../agents/coder.agent');
const TesterAgent     = require('../agents/tester.agent');
const HealerAgent     = require('../agents/healer.agent');
const ReviewerAgent   = require('../agents/reviewer.agent');
const ReportingAgent  = require('../agents/reporting.agent');
const { logger }      = require('./logger');

const orchLog = logger.child('Orchestrator');

// Agent run modes
const VALID_MODES = ['mock', 'live', 'ci'];

class Orchestrator {
  /**
   * @param {object} opts
   * @param {boolean} [opts.generateFeatures=true] - also generate Gherkin .feature files
   * @param {boolean} [opts.skipExecution=false]   - skip TesterAgent (plan + code only)
   */
  constructor(opts = {}) {
    this.generateFeatures = opts.generateFeatures !== false;
    this.skipExecution    = opts.skipExecution    || false;
  }

  /**
   * Run the full pipeline for a ticket.
   * @param {string} ticketId   e.g. 'JIRA-1234'
   * @param {string} mode       'mock' | 'live' | 'ci'
   * @returns {Promise<FinalState>}
   */
  async run(ticketId, mode = 'mock') {
    if (!ticketId) throw new Error('ticketId is required');
    if (!VALID_MODES.includes(mode)) throw new Error(`mode must be one of: ${VALID_MODES.join(', ')}`);

    const done = orchLog.startTimer('full-pipeline', { ticketId, mode });
    this._printBanner(ticketId, mode);

    const state = {
      ticketId,
      mode,
      status:           'running',
      startedAt:        new Date().toISOString(),
      groundingResult:  null,
      plannerResult:    null,
      coderResult:      null,
      testerResult:     null,
      healerResult:     null,
      reviewerResult:   null,
      reportingResult:  null,
      coverageReport:   null,
      agentTimings:     {}
    };

    // ── 1. GroundingAgent ───────────────────────────────────────────────────────
    await this._runAgent(
      new GroundingAgent(),
      { ticketId, mode },
      state,
      'groundingResult',
      result => { state.groundingResult = result.data; }
    );

    // ── 2. PlannerAgent ────────────────────────────────────────────────────────
    if (state.groundingResult) {
      await this._runAgent(
        new PlannerAgent(),
        { ticketId, mode, groundingContext: state.groundingResult },
        state,
        'plannerResult',
        result => { state.plannerResult = result.data; }
      );
    }

    // ── 3. CoderAgent ──────────────────────────────────────────────────────────
    if (state.plannerResult) {
      await this._runAgent(
        new CoderAgent({ generateFeatures: this.generateFeatures }),
        { ticketId, mode, testPlan: state.plannerResult },
        state,
        'coderResult',
        result => { state.coderResult = result.data; }
      );
    }

    // ── 4. TesterAgent ─────────────────────────────────────────────────────────
    if (state.coderResult && !this.skipExecution) {
      await this._runAgent(
        new TesterAgent(),
        { ticketId, mode, coderOutput: state.coderResult },
        state,
        'testerResult',
        result => { state.testerResult = result.data; }
      );
    }

    // ── 5. HealerAgent (auto-heal test failures) ──────────────────────────────
    if (state.testerResult && state.testerResult.summary.failed > 0) {
      await this._runAgent(
        new HealerAgent(),
        { ticketId, mode, testerResult: state.testerResult },
        state,
        'healerResult',
        result => { state.healerResult = result.data; }
      );
    }

    // ── 6. ReviewerAgent ───────────────────────────────────────────────────────
    if (state.coderResult) {
      await this._runAgent(
        new ReviewerAgent(),
        { ticketId, coderOutput: state.coderResult, testerOutput: state.testerResult },
        state,
        'reviewerResult',
        result => { state.reviewerResult = result.data; }
      );
    }

    // ── 7. ReportingAgent ──────────────────────────────────────────────────────
    await this._runAgent(
      new ReportingAgent(),
      { ticketId, state },
      state,
      'reportingResult',
      result => {
        state.reportingResult = result.data;
        state.coverageReport  = result.data ? result.data.coverageReport : null;
      }
    );

    // ── Finalise ───────────────────────────────────────────────────────────────
    state.status      = 'completed';
    state.completedAt = new Date().toISOString();
    const totalMs     = done({ ticketId, status: 'completed' });
    state.totalDurationMs = totalMs;

    this._persistState(ticketId, state);
    this._printSummary(state);

    return state;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  async _runAgent(agent, input, state, key, onSuccess) {
    const agentDone = orchLog.startTimer(agent.name);
    orchLog.info(`Running ${agent.name}`, { ticketId: input.ticketId });

    try {
      const result = await agent.run(input);
      state.agentTimings[agent.name] = result.durationMs;

      if (result.status === 'success') {
        onSuccess(result);
        orchLog.info(`${agent.name} succeeded`, { durationMs: result.durationMs });
      } else {
        orchLog.error(`${agent.name} returned error`, { error: result.error?.message });
        state.status = 'partial';
      }
      agentDone({ agent: agent.name, status: result.status });
    } catch (err) {
      orchLog.error(`${agent.name} threw`, { error: err.message });
      state.status = 'partial';
      agentDone({ agent: agent.name, status: 'threw' });
    }
  }

  _persistState(ticketId, state) {
    try {
      const dir  = path.resolve(__dirname, '../../orchestration/generated/reports', ticketId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'state.json'),
        JSON.stringify(state, null, 2),
        'utf8'
      );
    } catch (err) {
      orchLog.warn('Could not persist state', { error: err.message });
    }
  }

  _printBanner(ticketId, mode) {
    const line = '═'.repeat(60);
    console.log('\n' + line);
    console.log(`  🤖  MULTI-AGENT ORCHESTRATION`);
    console.log(`  Ticket : ${ticketId}`);
    console.log(`  Mode   : ${mode.toUpperCase()}`);
    console.log(`  Time   : ${new Date().toISOString()}`);
    console.log(line + '\n');
  }

  _printSummary(state) {
    const rr = state.reportingResult;
    const tr = state.testerResult;
    const rv = state.reviewerResult;
    const cv = state.coverageReport;

    const line = '─'.repeat(60);
    console.log('\n' + line);
    console.log('  📊  WORKFLOW SUMMARY');
    console.log(line);
    if (rr && rr.summary) {
      const s = rr.summary;
      console.log(`  Domain          : ${s.domain}`);
      console.log(`  Scenarios       : ${s.scenariosCount} generated`);
      console.log(`  Coverage        : ${s.coveragePercent}% (${s.requirementsCount} requirements)`);
      console.log(`  Quality Score   : ${s.qualityScore}/100  Grade: ${s.qualityGrade}`);
    }
    if (tr) {
      console.log(`  Test Results    : ${tr.summary.passed} passed / ${tr.summary.failed} failed`);
    }
    if (rr) {
      console.log(`  HTML Report     : ${rr.htmlPath}`);
      console.log(`  JSON Report     : ${rr.jsonPath}`);
      if (rr.jiraComment && rr.jiraComment.published) {
        console.log(`  Jira Comment    : Published ✓`);
      }
    }
    console.log(`  Total Time      : ${state.totalDurationMs}ms`);
    console.log(line);
    console.log('\n  WORKFLOW COMPLETE\n');
  }
}

module.exports = Orchestrator;
