'use strict';

/**
 * ReportingAgent
 *
 * Responsibility: gather all agent outputs → invoke reporters → emit final package.
 *
 * Input:  full orchestration state (all previous agent outputs)
 * Output: { htmlPath, jsonPath, jiraComment, coveragePercent, summary }
 */

const AgentBase          = require('../core/agent-base');
const htmlReporter       = require('../reporters/html.reporter');
const jsonReporter       = require('../reporters/json.reporter');
const jiraCommentReporter = require('../reporters/jira-comment.reporter');
const coverageEngine     = require('../coverage/coverage-engine');

class ReportingAgent extends AgentBase {
  constructor(opts = {}) {
    super('ReportingAgent', opts);
  }

  async execute(input) {
    const { ticketId, state } = input;
    if (!state)    throw new Error('state is required');
    if (!ticketId) throw new Error('ticketId is required');

    // Compute coverage from requirements + scenarios
    const requirements = state.plannerResult ? state.plannerResult.requirements : [];
    const scenarios    = state.plannerResult ? state.plannerResult.scenarios    : [];
    const coverage     = coverageEngine.compute(requirements, scenarios);

    // Inject coverage into state for reporters
    const fullState = { ...state, coverageReport: coverage };

    // Generate Jira comment (may publish if env flag set)
    const jiraComment = await jiraCommentReporter.generate(fullState);
    fullState.jiraComment = jiraComment;

    // Write HTML report
    let htmlPath;
    try {
      htmlPath = htmlReporter.write(fullState);
      this.log.info('HTML report written', { path: htmlPath });
    } catch (err) {
      this.log.error('HTML report failed', { error: err.message });
      htmlPath = null;
    }

    // Write JSON report
    let jsonPath;
    try {
      jsonPath = jsonReporter.write(fullState);
      this.log.info('JSON report written', { path: jsonPath });
    } catch (err) {
      this.log.error('JSON report failed', { error: err.message });
      jsonPath = null;
    }

    return {
      ticketId,
      htmlPath,
      jsonPath,
      jiraComment,
      coveragePercent: coverage.coveragePercent,
      coverageReport:  coverage,
      summary: {
        ticketId,
        domain:          state.groundingResult ? state.groundingResult.domain    : 'unknown',
        title:           state.groundingResult ? state.groundingResult.title     : '',
        scenariosCount:  scenarios.length,
        requirementsCount: requirements.length,
        coveragePercent: coverage.coveragePercent,
        testSummary:     state.testerResult   ? state.testerResult.summary       : null,
        qualityScore:    state.reviewerResult ? state.reviewerResult.score       : null,
        qualityGrade:    state.reviewerResult ? state.reviewerResult.grade       : null,
        jiraPublished:   jiraComment.published
      }
    };
  }
}

module.exports = ReportingAgent;
