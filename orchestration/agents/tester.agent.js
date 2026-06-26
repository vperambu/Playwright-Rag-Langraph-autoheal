'use strict';

/**
 * TesterAgent
 *
 * Responsibility: run generated Playwright specs and capture results.
 *
 * Input:  { coderOutput, ticketId, mode }
 * Output: { ticketId, mode, results[], summary }
 *
 * Execution modes:
 *   mock  — syntax-check files with `node --check`, no browser launch
 *   live  — real Playwright execution (headed or headless from env)
 *   ci    — headless, exports artifacts, strict exit codes
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const AgentBase = require('../core/agent-base');

class TesterAgent extends AgentBase {
  constructor(opts = {}) {
    super('TesterAgent', opts);
  }

  async execute(input) {
    const { coderOutput, ticketId, mode } = input;
    if (!coderOutput) throw new Error('coderOutput is required');

    const { specFiles } = coderOutput;
    if (!specFiles || !specFiles.length) {
      return this._emptyResult(ticketId, mode, 'No spec files to execute');
    }

    const results = [];

    if (mode === 'mock') {
      // Dry-run: syntax validation only
      for (const spec of specFiles) {
        const result = this._syntaxCheck(spec);
        results.push(result);
      }
    } else {
      // Real execution: live or ci
      for (const spec of specFiles) {
        const result = await this._runSpec(spec, ticketId, mode);
        results.push(result);
      }
    }

    const summary = this._summarise(results);

    this.log.info('Test run complete', { ...summary, mode });

    return { ticketId, mode, results, summary };
  }

  // ── Syntax check (mock mode) ─────────────────────────────────────────────────

  _syntaxCheck(spec) {
    const start = Date.now();
    try {
      if (!fs.existsSync(spec.path)) {
        return this._resultRecord(spec, 'skipped', 0, [], 'File not written (dryRun mode)');
      }
      execFileSync(process.execPath, ['--check', spec.path], { stdio: 'pipe' });
      return this._resultRecord(spec, 'passed', Date.now() - start, []);
    } catch (err) {
      return this._resultRecord(spec, 'failed', Date.now() - start, [
        { message: err.stderr?.toString() || err.message }
      ]);
    }
  }

  // ── Real Playwright execution (live / ci) ────────────────────────────────────

  async _runSpec(spec, ticketId, mode) {
    const start      = Date.now();
    const reportDir  = path.resolve(__dirname, '../../orchestration/generated/reports', ticketId);
    fs.mkdirSync(reportDir, { recursive: true });

    const jsonReport = path.join(reportDir, `pw-results-${spec.type}.json`);
    const isCI       = mode === 'ci';
    const headless   = isCI || process.env.HEADLESS !== 'false';

    // Build playwright CLI args
    const args = [
      'test',
      spec.path,
      '--reporter=json',
      `--output=${reportDir}`,
      headless ? '--headed=false' : '--headed',
      '--timeout=30000',
      '--retries=1'
    ];

    // Locate npx / playwright
    const playwrightBin = this._resolveBin('playwright');

    try {
      const stdout = execFileSync(playwrightBin, args, {
        cwd:     process.cwd(),
        env:     { ...process.env },
        stdio:   'pipe',
        timeout: 120000
      });

      // Save JSON output
      try { fs.writeFileSync(jsonReport, stdout); } catch { /* ignore */ }

      const parsed   = this._parsePlaywrightJson(stdout.toString());
      const failures = parsed.failures || [];
      const status   = failures.length === 0 ? 'passed' : 'failed';
      return this._resultRecord(spec, status, Date.now() - start, failures, '', jsonReport);
    } catch (err) {
      const stderr  = err.stderr?.toString() || err.message;
      const stdout2 = err.stdout?.toString() || '';
      // Try to parse partial output
      const parsed   = this._parsePlaywrightJson(stdout2);
      const failures = parsed.failures || [{ message: stderr.slice(0, 500) }];
      return this._resultRecord(spec, 'failed', Date.now() - start, failures, stderr, jsonReport);
    }
  }

  _resolveBin(name) {
    // Try local node_modules/.bin first, then npx fallback
    const local = path.resolve(process.cwd(), 'node_modules', '.bin', name);
    if (fs.existsSync(local)) return local;
    return 'npx'; // fallback — caller must pass args starting with name
  }

  _parsePlaywrightJson(raw) {
    try {
      const data     = JSON.parse(raw);
      const failures = [];
      for (const suite of data.suites || []) {
        for (const spec of suite.specs || []) {
          for (const test of spec.tests || []) {
            if (test.status !== 'expected') {
              failures.push({ title: spec.title, message: test.results?.[0]?.error?.message || 'Unknown failure' });
            }
          }
        }
      }
      return { failures };
    } catch {
      return { failures: [] };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _resultRecord(spec, status, durationMs, failures, stderr = '', reportPath = '') {
    return {
      specFile:    spec.relativePath || spec.path,
      type:        spec.type,
      status,
      durationMs,
      failures,
      stderr:      stderr.slice(0, 1000),
      reportPath,
      scenarioIds: spec.scenarioIds || []
    };
  }

  _summarise(results) {
    return {
      total:   results.length,
      passed:  results.filter(r => r.status === 'passed').length,
      failed:  results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };
  }

  _emptyResult(ticketId, mode, reason) {
    return {
      ticketId,
      mode,
      results: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      reason
    };
  }
}

module.exports = TesterAgent;
