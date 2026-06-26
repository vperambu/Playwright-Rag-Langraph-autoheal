'use strict';

/**
 * ReviewerAgent
 *
 * Responsibility: static analysis of generated spec files + execution results → quality score.
 *
 * Input:  { coderOutput, testerOutput, ticketId }
 * Output: { ticketId, score, grade, findings[], flakyRisk[], missingAssertions[], recommendations[] }
 *
 * Score: 0–100
 *   -5 per missing assertion
 *   -3 per hardcoded credential risk
 *   -3 per flaky pattern (setTimeout, sleep, fixed waits)
 *   -5 per unawaited async call
 *   -2 per test with no expect() call
 *   +5 for each file with >0 assertions per test
 *   -10 if any test has zero steps generated
 */

const fs  = require('fs');
const AgentBase = require('../core/agent-base');

const FLAKY_PATTERNS = [
  { pattern: /setTimeout\s*\(/g,          label: 'Hardcoded setTimeout — prefer page.waitFor*' },
  { pattern: /sleep\s*\(/g,               label: 'Hardcoded sleep — prefer waitForSelector/networkidle' },
  { pattern: /\bwait\s*\(\s*\d{4,}\s*\)/g, label: 'Large fixed wait (>=1000ms) detected' },
  { pattern: /\.pause\s*\(\s*\d+\s*\)/g,  label: 'page.pause() call — remove before CI' }
];

const HARDCODE_PATTERNS = [
  { pattern: /password\s*=\s*['"][^'"]{4,}['"]/gi, label: 'Possible hardcoded password' },
  { pattern: /token\s*=\s*['"][A-Za-z0-9._-]{20,}['"]/gi, label: 'Possible hardcoded token' },
  { pattern: /apikey\s*=\s*['"][^'"]+['"]/gi,      label: 'Possible hardcoded API key' }
];

const MISSING_AWAIT_PATTERN = /(?<!await\s)(page\.(click|fill|goto|check|uncheck|selectOption|waitForSelector|waitForNavigation))\s*\(/g;

class ReviewerAgent extends AgentBase {
  constructor(opts = {}) {
    super('ReviewerAgent', opts);
  }

  async execute(input) {
    const { coderOutput, testerOutput, ticketId } = input;
    if (!coderOutput) throw new Error('coderOutput is required');

    const { specFiles } = coderOutput;
    const findings         = [];
    const flakyRisk        = [];
    const missingAssertions = [];
    let scoreDeductions    = 0;
    let scoreBonuses       = 0;

    for (const spec of specFiles) {
      if (!fs.existsSync(spec.path)) {
        findings.push({ type: 'error', severity: 'high', file: spec.relativePath, message: 'Spec file not found on disk' });
        scoreDeductions += 10;
        continue;
      }

      const src = fs.readFileSync(spec.path, 'utf8');

      // ── Flaky pattern detection ────────────────────────────────────────────
      for (const { pattern, label } of FLAKY_PATTERNS) {
        if (pattern.test(src)) {
          flakyRisk.push({ file: spec.relativePath, issue: label });
          findings.push({ type: 'flaky', severity: 'medium', file: spec.relativePath, message: label });
          scoreDeductions += 3;
          pattern.lastIndex = 0;
        }
      }

      // ── Hardcoded credential detection ────────────────────────────────────
      for (const { pattern, label } of HARDCODE_PATTERNS) {
        if (pattern.test(src)) {
          findings.push({ type: 'security', severity: 'high', file: spec.relativePath, message: label });
          scoreDeductions += 5;
          pattern.lastIndex = 0;
        }
      }

      // ── Missing await detection ───────────────────────────────────────────
      const missingAwaits = [...src.matchAll(MISSING_AWAIT_PATTERN)];
      if (missingAwaits.length > 0) {
        const count = missingAwaits.length;
        findings.push({ type: 'async', severity: 'high', file: spec.relativePath, message: `${count} unawaited async call(s) detected` });
        scoreDeductions += count * 5;
      }

      // ── Assertion coverage ────────────────────────────────────────────────
      const testBlocks  = src.match(/test\s*\(/g) || [];
      const expectCalls = src.match(/\bexpect\s*\(/g) || [];
      const ratio       = testBlocks.length > 0 ? expectCalls.length / testBlocks.length : 0;

      if (ratio === 0) {
        missingAssertions.push(spec.relativePath);
        findings.push({ type: 'quality', severity: 'high', file: spec.relativePath, message: 'No expect() assertions found in spec' });
        scoreDeductions += 10;
      } else if (ratio < 1) {
        missingAssertions.push(spec.relativePath);
        findings.push({ type: 'quality', severity: 'medium', file: spec.relativePath, message: `Low assertion density: ${ratio.toFixed(1)} expect() per test block` });
        scoreDeductions += 5;
      } else {
        scoreBonuses += 5;
      }

      // ── TODO markers (incomplete generation) ──────────────────────────────
      const todos = (src.match(/\/\/ TODO:/g) || []).length;
      if (todos > 0) {
        findings.push({ type: 'completeness', severity: 'low', file: spec.relativePath, message: `${todos} TODO marker(s) in generated code — manual review needed` });
        scoreDeductions += todos * 2;
      }

      // ── describe block present ────────────────────────────────────────────
      if (!src.includes('test.describe(')) {
        findings.push({ type: 'structure', severity: 'low', file: spec.relativePath, message: 'No test.describe() block — tests lack grouping' });
        scoreDeductions += 2;
      }
    }

    // ── Factor in test execution results ─────────────────────────────────────
    if (testerOutput && testerOutput.summary) {
      const { total, failed } = testerOutput.summary;
      if (total > 0 && failed > 0) {
        const failRate = failed / total;
        scoreDeductions += Math.round(failRate * 20); // up to -20 for 100% failure
        findings.push({
          type: 'execution',
          severity: 'high',
          file: 'all',
          message: `${failed}/${total} spec file(s) failed execution`
        });
      }
    }

    const raw   = Math.max(0, Math.min(100, 80 + scoreBonuses - scoreDeductions));
    const score = raw;
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';

    const recommendations = this._buildRecommendations(findings, missingAssertions, flakyRisk);

    this.log.info('Review complete', { score, grade, findings: findings.length });

    return { ticketId, score, grade, findings, flakyRisk, missingAssertions, recommendations };
  }

  _buildRecommendations(findings, missingAssertions, flakyRisk) {
    const recs = [];
    if (missingAssertions.length) {
      recs.push(`Add explicit expect() assertions to: ${missingAssertions.join(', ')}`);
    }
    if (flakyRisk.length) {
      recs.push('Replace setTimeout/sleep with Playwright waitFor* APIs for deterministic timing');
    }
    const secFindings = findings.filter(f => f.type === 'security');
    if (secFindings.length) {
      recs.push('Move all credentials to environment variables — never hardcode in specs');
    }
    const asyncFindings = findings.filter(f => f.type === 'async');
    if (asyncFindings.length) {
      recs.push('Add await before all Playwright page interactions to prevent race conditions');
    }
    const todos = findings.filter(f => f.message && f.message.includes('TODO'));
    if (todos.length) {
      recs.push('Review and implement all TODO markers before marking tests production-ready');
    }
    if (!recs.length) {
      recs.push('Generated tests meet quality bar — consider adding visual regression coverage');
    }
    return recs;
  }
}

module.exports = ReviewerAgent;
