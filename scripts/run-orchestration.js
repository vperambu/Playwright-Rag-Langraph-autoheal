#!/usr/bin/env node
'use strict';

/**
 * run-orchestration.js — CLI entry point for the multi-agent orchestration pipeline.
 *
 * Usage:
 *   node scripts/run-orchestration.js [ticketId] [mode]
 *
 * Examples:
 *   node scripts/run-orchestration.js JIRA-1234 mock
 *   node scripts/run-orchestration.js JIRA-1234 live
 *   TICKET_ID=JIRA-5678 ORCHESTRATION_MODE=ci node scripts/run-orchestration.js
 *
 * Environment variables (see .env.example):
 *   TICKET_ID             — Jira ticket ID (overridden by CLI arg)
 *   ORCHESTRATION_MODE    — mock | live | ci  (default: mock)
 *   JIRA_BASE_URL         — https://yourorg.atlassian.net  (live/ci only)
 *   JIRA_EMAIL            — user@company.com  (live/ci only)
 *   JIRA_API_TOKEN        — Jira API token  (live/ci only)
 *   JIRA_PUBLISH_RESULTS  — true to post comment back to Jira
 *   GENERATE_FEATURES     — true to also write .feature files (default: true)
 *   SKIP_EXECUTION        — true to skip TesterAgent (code-only run)
 */

const path = require('path');
// Load credentials — .env.local overrides .env (both are gitignored)
// Order: .env.local → .env  (first-loaded wins with dotenv's override:false default)
try {
  const dotenv = require('dotenv');
  // .env.local: real credentials (API tokens, etc.) — NEVER committed
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  // .env: non-secret defaults (browser, timeouts, etc.)
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
} catch { /* dotenv optional — env vars may be injected by CI */ }

const { Orchestrator } = require('../orchestration');

// ── Resolve inputs ────────────────────────────────────────────────────────────

const ticketId = process.argv[2] || process.env.TICKET_ID;
const mode     = (process.argv[3] || process.env.ORCHESTRATION_MODE || 'mock').toLowerCase();

const VALID_MODES = ['mock', 'live', 'ci'];

function bail(msg) {
  console.error(`\n❌  Error: ${msg}\n`);
  console.error('Usage: node scripts/run-orchestration.js <TICKET_ID> [mock|live|ci]');
  console.error('   or: TICKET_ID=JIRA-1234 ORCHESTRATION_MODE=mock node scripts/run-orchestration.js\n');
  process.exit(1);
}

if (!ticketId)               bail('TICKET_ID is required (arg or env var)');
if (!VALID_MODES.includes(mode)) bail(`mode must be one of: ${VALID_MODES.join(', ')}`);

// ── Validate env for live/ci mode ─────────────────────────────────────────────

if (mode !== 'mock') {
  const missing = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'].filter(v => !process.env[v]);
  if (missing.length) {
    bail(`Live/CI mode requires env vars: ${missing.join(', ')}`);
  }
}

// ── Options ───────────────────────────────────────────────────────────────────

const opts = {
  generateFeatures: process.env.GENERATE_FEATURES !== 'false',
  skipExecution:    process.env.SKIP_EXECUTION    === 'true'
};

// ── Run ───────────────────────────────────────────────────────────────────────

const orchestrator = new Orchestrator(opts);

orchestrator.run(ticketId, mode)
  .then(state => {
    const exitCode = state.status === 'completed' ? 0 : 1;
    if (exitCode !== 0) {
      console.error('⚠  Pipeline completed with partial results');
    }
    process.exit(exitCode);
  })
  .catch(err => {
    console.error(`\n💥  Fatal error: ${err.message}`);
    if (process.env.LOG_LEVEL === 'debug') console.error(err.stack);
    process.exit(2);
  });
