'use strict';

/**
 * CoverageEngine
 *
 * Maps Jira requirements → generated scenarios to compute test coverage.
 *
 * Algorithm:
 *  1. Tokenise each requirement into keywords (stop-words removed)
 *  2. For each scenario, score keyword overlap with each requirement
 *  3. A requirement is "covered" if ≥1 scenario scores above threshold
 *  4. Compute coverage % = covered / total
 *
 * Output: CoverageReport
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
  'but', 'not', 'with', 'this', 'that', 'are', 'was', 'be', 'as', 'by', 'from',
  'user', 'system', 'should', 'must', 'will', 'can', 'may', 'after', 'before',
  'when', 'then', 'given', 'and'
]);

const COVERAGE_THRESHOLD = 1; // minimum keyword overlap to count as "covered"

class CoverageEngine {
  /**
   * @param {string[]}  requirements  - from GroundingContext
   * @param {Scenario[]} scenarios    - from TestPlan
   * @returns {CoverageReport}
   */
  compute(requirements, scenarios) {
    if (!requirements || !requirements.length) {
      return this._empty();
    }

    const matrix = [];
    let coveredCount = 0;

    for (const req of requirements) {
      const reqTokens  = this._tokenise(req);
      const mappings   = [];
      let   maxScore   = 0;

      for (const sc of scenarios) {
        const scTokens = this._tokenise(sc.title + ' ' + (sc.requirementRef || ''));
        const score    = this._overlap(reqTokens, scTokens);
        if (score > 0) {
          mappings.push({ scenarioId: sc.id, scenarioTitle: sc.title, score });
          maxScore = Math.max(maxScore, score);
        }
      }

      // Sort by score descending
      mappings.sort((a, b) => b.score - a.score);

      const covered = maxScore >= COVERAGE_THRESHOLD;
      if (covered) coveredCount++;

      matrix.push({
        requirement: req,
        covered,
        confidence: this._confidence(maxScore, reqTokens.length),
        mappedScenarios: mappings.slice(0, 3), // top 3
        assumption: covered
          ? null
          : `No scenario directly maps to "${req.slice(0, 60)}..." — manual test recommended`
      });
    }

    const percent = requirements.length > 0
      ? Math.round((coveredCount / requirements.length) * 100)
      : 0;

    const uncoveredRequirements = matrix
      .filter(m => !m.covered)
      .map(m => m.requirement);

    return {
      totalRequirements: requirements.length,
      coveredRequirements: coveredCount,
      uncoveredRequirements,
      coveragePercent: percent,
      matrix,
      computedAt: new Date().toISOString()
    };
  }

  _tokenise(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  }

  _overlap(tokensA, tokensB) {
    const setB = new Set(tokensB);
    return tokensA.filter(t => setB.has(t)).length;
  }

  _confidence(score, reqTokenCount) {
    if (reqTokenCount === 0) return 'none';
    const ratio = score / reqTokenCount;
    if (ratio >= 0.6) return 'high';
    if (ratio >= 0.3) return 'medium';
    if (ratio >  0)   return 'low';
    return 'none';
  }

  _empty() {
    return {
      totalRequirements:   0,
      coveredRequirements: 0,
      uncoveredRequirements: [],
      coveragePercent: 0,
      matrix: [],
      computedAt: new Date().toISOString()
    };
  }
}

module.exports = new CoverageEngine();
