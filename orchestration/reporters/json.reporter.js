'use strict';

/**
 * JsonReporter — serializes the full orchestration state to machine-readable JSON.
 * Saved to orchestration/generated/reports/<ticketId>/report.json
 */

const fs   = require('fs');
const path = require('path');

class JsonReporter {
  /**
   * @param {object} state  Full orchestration state
   * @returns {string}      Absolute path of written file
   */
  write(state) {
    const { ticketId } = state;
    const dir  = path.resolve(__dirname, '../../orchestration/generated/reports', ticketId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'report.json');

    const payload = {
      _meta: {
        generatedBy: 'MultiAgent Orchestration System',
        version:     '1.0.0',
        generatedAt: new Date().toISOString(),
        ticketId
      },
      summary:        this._buildSummary(state),
      grounding:      this._safeData(state.groundingResult),
      plan:           this._safeData(state.plannerResult),
      coder:          this._safeData(state.coderResult),
      tester:         this._safeData(state.testerResult),
      reviewer:       this._safeData(state.reviewerResult),
      coverage:       state.coverageReport,
      agentTimings:   state.agentTimings || {}
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
  }

  _buildSummary(state) {
    const tr = state.testerResult;
    const rv = state.reviewerResult;
    const cv = state.coverageReport;
    return {
      ticketId:        state.ticketId,
      mode:            state.mode,
      status:          state.status,
      testSummary:     tr ? tr.summary : null,
      qualityScore:    rv ? rv.score : null,
      qualityGrade:    rv ? rv.grade : null,
      coveragePercent: cv ? cv.coveragePercent : null,
      scenarioCount:   state.plannerResult ? state.plannerResult.scenarios.length : 0
    };
  }

  _safeData(result) {
    if (!result) return null;
    // Omit raw Jira issue to keep file size reasonable
    if (result.rawIssue) {
      const { rawIssue, ...rest } = result; // eslint-disable-line no-unused-vars
      return rest;
    }
    return result;
  }
}

module.exports = new JsonReporter();
