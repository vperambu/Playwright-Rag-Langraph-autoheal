'use strict';

/**
 * orchestration/index.js — public API surface for the multi-agent system.
 *
 * Consumers import what they need:
 *   const { Orchestrator, GroundingAgent } = require('./orchestration');
 */

const Orchestrator    = require('./core/orchestrator');
const AgentBase       = require('./core/agent-base');
const { logger }      = require('./core/logger');
const { withRetry }   = require('./core/retry');
const { CircuitBreaker } = require('./core/circuit-breaker');

const GroundingAgent  = require('./agents/grounding.agent');
const PlannerAgent    = require('./agents/planner.agent');
const CoderAgent      = require('./agents/coder.agent');
const TesterAgent     = require('./agents/tester.agent');
const HealerAgent     = require('./agents/healer.agent');
const ReviewerAgent   = require('./agents/reviewer.agent');
const ReportingAgent  = require('./agents/reporting.agent');

const jiraClient      = require('./jira/jira.client');
const jiraParser      = require('./jira/jira.parser');
const coverageEngine  = require('./coverage/coverage-engine');
const htmlReporter    = require('./reporters/html.reporter');
const jsonReporter    = require('./reporters/json.reporter');
const jiraCommentReporter = require('./reporters/jira-comment.reporter');

module.exports = {
  // Core
  Orchestrator,
  AgentBase,
  logger,
  withRetry,
  CircuitBreaker,

  // Agents
  GroundingAgent,
  PlannerAgent,
  CoderAgent,
  TesterAgent,
  HealerAgent,
  ReviewerAgent,
  ReportingAgent,

  // Services
  jiraClient,
  jiraParser,
  coverageEngine,

  // Reporters
  htmlReporter,
  jsonReporter,
  jiraCommentReporter
};
