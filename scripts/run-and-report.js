#!/usr/bin/env node
'use strict';

/**
 * run-and-report.js — Unified MultiAgent runner.
 *
 * What it does:
 *   1. Fetches the Jira ticket (reads summary + AC from description)
 *   2. Runs existing Cucumber/Playwright tests
 *   3. Parses the JSON test report
 *   4. Posts a full results comment back to the Jira ticket
 *
 * Usage:
 *   node scripts/run-and-report.js SCRUM-6
 *   node scripts/run-and-report.js PLAY-12 --tags @api
 *   node scripts/run-and-report.js SCRUM-6 --skip-tests   (just post existing results)
 *
 * Requirements:
 *   .env.local with JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PUBLISH_RESULTS=true
 */

const path        = require('path');
const fs          = require('fs');
const { execSync } = require('child_process');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const jiraClient  = require('../orchestration/jira/jira.client');
const jiraParser  = require('../orchestration/jira/jira.parser');
const { logger }  = require('../orchestration/core/logger');
const log         = logger.child('RunAndReport');

// ── CLI args ──────────────────────────────────────────────────────────────────
const ticketId  = process.argv[2] || process.env.TICKET_ID;
const tags      = process.argv.includes('--tags') ? process.argv[process.argv.indexOf('--tags') + 1] : null;
const skipTests = process.argv.includes('--skip-tests');

if (!ticketId) {
  console.error('\n❌  Usage: node scripts/run-and-report.js <TICKET_ID> [--tags @tag] [--skip-tests]\n');
  process.exit(1);
}

const REPORTS_DIR = path.resolve(__dirname, '../reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'cucumber-report.json');

// ── Banner ────────────────────────────────────────────────────────────────────
const LINE = '═'.repeat(62);
console.log(`\n${LINE}`);
console.log(`  🤖  MULTIAGENT RUN & REPORT`);
console.log(`  Ticket  : ${ticketId}`);
console.log(`  Tags    : ${tags || 'all'}`);
console.log(`  Publish : ${process.env.JIRA_PUBLISH_RESULTS === 'true' ? 'YES → will comment on Jira' : 'NO (set JIRA_PUBLISH_RESULTS=true)'}`);
console.log(`${LINE}\n`);

// ── STEP 1: Fetch Jira ticket ─────────────────────────────────────────────────
async function fetchTicket(id) {
  console.log(`📋  STEP 1 — Fetching Jira ticket ${id} ...\n`);
  try {
    const raw     = await jiraClient.getIssue(id);
    const context = jiraParser.parse(raw);
    console.log(`  ✅ Title   : ${context.title}`);
    console.log(`  ✅ Status  : ${context.status}`);
    console.log(`  ✅ Type    : ${context.issueType}`);
    console.log(`  ✅ Domain  : ${context.domain}`);
    console.log(`  ✅ AC count: ${context.acceptanceCriteria.length}`);
    if (context.acceptanceCriteria.length > 0) {
      context.acceptanceCriteria.slice(0, 5).forEach((ac, i) => console.log(`     ${i + 1}. ${ac}`));
    }
    console.log('');
    return context;
  } catch (err) {
    console.warn(`  ⚠️  Could not fetch ticket (${err.message})`);
    console.warn('     Proceeding without Jira context — results will still be posted.\n');
    return { ticketId: id, title: id, domain: 'unknown', acceptanceCriteria: [], requirements: [], status: 'Unknown', issueType: 'Story' };
  }
}

// ── STEP 2: Run existing tests ────────────────────────────────────────────────
function runTests(tagFilter) {
  console.log(`🧪  STEP 2 — Running Cucumber tests ...\n`);
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const tagArg = tagFilter ? `--tags '${tagFilter}'` : '';
  const cmd    = [
    'npx cucumber-js',
    'tests/features/**/*.feature',
    tagArg,
    `--require tests/support/worlds.js`,
    `--require tests/support/hooks/hooks.js`,
    `--require 'tests/step-definitions/**/*.js'`,
    `--format progress-bar`,
    `--format json:${REPORT_JSON}`
  ].filter(Boolean).join(' ');

  console.log(`  Running: ${cmd}\n`);
  const start = Date.now();
  let exitCode = 0;

  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  } catch (err) {
    exitCode = err.status || 1;
  }

  const durationMs = Date.now() - start;
  console.log(`\n  ⏱  Tests finished in ${(durationMs / 1000).toFixed(1)}s\n`);
  return { durationMs, exitCode };
}

// ── STEP 3: Parse test results ────────────────────────────────────────────────
function parseResults() {
  console.log(`📊  STEP 3 — Parsing results ...\n`);
  if (!fs.existsSync(REPORT_JSON)) {
    console.warn('  ⚠️  No report JSON found — returning empty results\n');
    return { total: 0, passed: 0, failed: 0, skipped: 0, scenarios: [] };
  }

  const raw       = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
  const scenarios = [];
  let passed = 0, failed = 0, skipped = 0;

  for (const feature of raw) {
    for (const sc of (feature.elements || [])) {
      const steps    = sc.steps || [];
      const allPass  = steps.every(s => s.result && s.result.status === 'passed');
      const anyFail  = steps.some(s  => s.result && s.result.status === 'failed');
      const anySkip  = steps.some(s  => s.result && s.result.status === 'skipped');
      const status   = anyFail ? 'failed' : anySkip ? 'skipped' : 'passed';
      const duration = steps.reduce((sum, s) => sum + (s.result?.duration || 0), 0);

      if (status === 'passed')  passed++;
      else if (status === 'failed') failed++;
      else skipped++;

      scenarios.push({
        feature:  feature.name,
        name:     sc.name,
        status,
        durationMs: Math.round(duration / 1e6),
        failedStep: anyFail
          ? steps.find(s => s.result?.status === 'failed')?.name
          : null,
        errorMsg: anyFail
          ? steps.find(s => s.result?.status === 'failed')?.result?.error_message?.split('\n')[0]
          : null
      });
    }
  }

  const total = passed + failed + skipped;
  console.log(`  Total    : ${total}`);
  console.log(`  ✅ Passed : ${passed}`);
  console.log(`  ❌ Failed : ${failed}`);
  console.log(`  ⏭  Skipped: ${skipped}\n`);

  return { total, passed, failed, skipped, scenarios };
}

// ── STEP 4: Build & post Jira comment ────────────────────────────────────────
async function postComment(ticketCtx, results, runInfo) {
  console.log(`💬  STEP 4 — Building Jira comment ...\n`);

  const { total, passed, failed, skipped, scenarios } = results;
  const overallStatus = failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`;
  const runDate       = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  // Build scenario table rows
  const scenarioRows = scenarios.map(sc => {
    const icon = sc.status === 'passed' ? '✅' : sc.status === 'failed' ? '❌' : '⏭';
    const err  = sc.errorMsg ? `\n    ↳ ${sc.errorMsg.slice(0, 120)}` : '';
    return `  ${icon} ${sc.name} (${sc.durationMs}ms)${err}`;
  }).join('\n');

  // AC coverage check
  const acLines = ticketCtx.acceptanceCriteria.length > 0
    ? ticketCtx.acceptanceCriteria.map((ac, i) => `  ${i + 1}. ${ac}`).join('\n')
    : '  (No acceptance criteria found in ticket description)';

  const comment = [
    `🤖 *Automated Test Run — ${ticketCtx.ticketId}*`,
    `*Run at:* ${runDate}  |  *Duration:* ${(runInfo.durationMs / 1000).toFixed(1)}s`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `📋 *Ticket:* ${ticketCtx.title}`,
    `📌 *Status:* ${ticketCtx.status}  |  *Domain:* ${ticketCtx.domain}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `${overallStatus}`,
    `  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}  |  Skipped: ${skipped}`,
    '',
    '📝 *Scenario Results:*',
    scenarioRows || '  (No scenarios executed)',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📌 *Acceptance Criteria (from ticket):*',
    acLines,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '_Generated by MultiAgent AI Orchestration Framework v2.0_',
    `_Powered by: GroundingAgent → TestRunner → ReportingAgent → JiraCommentReporter_`
  ].join('\n');

  console.log('  Comment preview:\n');
  console.log(comment);
  console.log('');

  const shouldPublish = process.env.JIRA_PUBLISH_RESULTS === 'true';
  if (shouldPublish) {
    try {
      console.log(`  📤 Publishing comment to ${ticketCtx.ticketId} ...`);
      await jiraClient.addComment(ticketCtx.ticketId, comment);
      console.log(`  ✅ Comment posted to: ${process.env.JIRA_BASE_URL}/browse/${ticketCtx.ticketId}\n`);
    } catch (err) {
      console.error(`  ❌ Failed to post comment: ${err.message}\n`);
      // Save locally as fallback
      const fallback = path.resolve(REPORTS_DIR, `jira-comment-${ticketCtx.ticketId}.txt`);
      fs.writeFileSync(fallback, comment, 'utf8');
      console.log(`  💾 Comment saved locally: ${fallback}\n`);
    }
  } else {
    console.log('  ℹ️  JIRA_PUBLISH_RESULTS is not "true" — comment NOT posted.\n');
    console.log('     Set JIRA_PUBLISH_RESULTS=true in .env.local to enable auto-posting.\n');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const ticketCtx = await fetchTicket(ticketId);

    let runInfo = { durationMs: 0, exitCode: 0 };
    if (!skipTests) {
      runInfo = runTests(tags);
    } else {
      console.log('⏭  STEP 2 — Skipping test run (--skip-tests flag)\n');
    }

    const results = parseResults();
    await postComment(ticketCtx, results, runInfo);

    console.log(`${LINE}`);
    console.log(`  🎉  PIPELINE COMPLETE`);
    console.log(`  Ticket  : ${ticketId}`);
    console.log(`  Results : ${results.passed} passed / ${results.failed} failed / ${results.skipped} skipped`);
    console.log(`  Comment : ${process.env.JIRA_PUBLISH_RESULTS === 'true' ? 'Posted to Jira ✓' : 'Not posted (set JIRA_PUBLISH_RESULTS=true)'}`);
    console.log(`${LINE}\n`);

    process.exit(runInfo.exitCode);
  } catch (err) {
    console.error(`\n💥  Fatal: ${err.message}`);
    if (process.env.LOG_LEVEL === 'debug') console.error(err.stack);
    process.exit(2);
  }
})();
