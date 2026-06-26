'use strict';

/**
 * GroundingAgent
 *
 * Responsibility: fetch Jira ticket → parse → emit normalized GroundingContext.
 *
 * Input:  { ticketId: string, mode: 'mock'|'live'|'ci' }
 * Output: GroundingContext (see jira.parser.js for shape)
 *
 * Mock mode: loads fixtures/mock-ticket.json (deterministic, no network).
 * Live / CI : calls JiraClient → JiraParser.
 */

const path       = require('path');
const AgentBase  = require('../core/agent-base');
const jiraClient = require('../jira/jira.client');
const jiraParser = require('../jira/jira.parser');

class GroundingAgent extends AgentBase {
  constructor(opts = {}) {
    super('GroundingAgent', opts);
  }

  async execute(input) {
    const { ticketId, mode } = input;

    if (!ticketId) throw new Error('ticketId is required');

    let rawIssue;

    if (mode === 'mock') {
      this.log.info('Mock mode — loading fixture', { ticketId });
      // Load the fixture but override the key so the ticket ID matches
      const fixture = require(path.resolve(__dirname, '../fixtures/mock-ticket.json'));
      rawIssue = { ...fixture, key: ticketId };
    } else {
      this.log.info('Live mode — fetching from Jira', { ticketId });
      rawIssue = await jiraClient.getIssue(ticketId);
    }

    const context = jiraParser.parse(rawIssue);

    this.log.info('Grounding complete', {
      ticketId,
      domain:   context.domain,
      acCount:  context.acceptanceCriteria.length,
      reqCount: context.requirements.length
    });

    return context;
  }
}

module.exports = GroundingAgent;
