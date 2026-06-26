'use strict';

/**
 * JiraClient — thin wrapper over Jira Cloud REST API v3.
 * Uses Node built-in `https` — no axios or node-fetch required.
 *
 * Required env vars (never hardcoded):
 *   JIRA_BASE_URL   e.g. https://yourorg.atlassian.net
 *   JIRA_EMAIL      e.g. user@company.com
 *   JIRA_API_TOKEN  Jira API token (not password)
 */

const https  = require('https');
const { URL } = require('url');
const { withRetry }     = require('../core/retry');
const { CircuitBreaker } = require('../core/circuit-breaker');
const { logger }        = require('../core/logger');

const jiraLog = logger.child('JiraClient');

class JiraClient {
  constructor() {
    const base = process.env.JIRA_BASE_URL || '';
    if (base) {
      try { this.baseUrl = new URL(base).origin; }
      catch { this.baseUrl = ''; }
    } else {
      this.baseUrl = '';
    }
    this.email    = process.env.JIRA_EMAIL    || '';
    this.apiToken = process.env.JIRA_API_TOKEN || '';
    this._cb      = new CircuitBreaker({ name: 'jira', failureThreshold: 3, resetTimeoutMs: 20000 });
  }

  /** Returns base64 Basic auth header value */
  _auth() {
    if (!this.email || !this.apiToken) {
      throw new Error('JIRA_EMAIL and JIRA_API_TOKEN env vars are required for live Jira calls');
    }
    return Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
  }

  /**
   * Raw HTTPS request helper.
   * @param {string} method  GET | POST | PUT
   * @param {string} path    API path, e.g. /rest/api/3/issue/JIRA-1
   * @param {object} [body]  JSON body for POST/PUT
   * @returns {Promise<object>}
   */
  _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      if (!this.baseUrl) {
        return reject(new Error('JIRA_BASE_URL is not set'));
      }
      const url     = new URL(path, this.baseUrl);
      const payload = body ? JSON.stringify(body) : null;
      const options = {
        hostname: url.hostname,
        port:     url.port || 443,
        path:     url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Basic ${this._auth()}`,
          'Accept':        'application/json',
          'Content-Type':  'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      };

      const req = https.request(options, res => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            const err = new Error(`Jira API ${res.statusCode}: ${raw.slice(0, 300)}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          try {
            resolve(raw ? JSON.parse(raw) : {});
          } catch {
            resolve({ raw });
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Fetch a Jira issue — tries v3 API first, falls back to v2, then JQL search.
   * @param {string} ticketId  e.g. SCRUM-6
   */
  async getIssue(ticketId) {
    const fields = 'summary,description,comment,labels,status,priority,issuetype,reporter,assignee,created,updated';
    jiraLog.info('Fetching issue', { ticketId });

    // 1️⃣ Try REST API v3
    try {
      return await withRetry(
        () => this._cb.call(() => this._request('GET', `/rest/api/3/issue/${ticketId}?fields=${fields}`)),
        { attempts: 2, baseDelayMs: 500, retryIf: err => !err.statusCode || (err.statusCode !== 404 && err.statusCode !== 403) }
      );
    } catch (err) {
      jiraLog.warn('v3 API failed, trying v2', { error: err.message });
    }

    // 2️⃣ Fall back to v2 API (Jira Data Center / older cloud)
    try {
      return await this._request('GET', `/rest/api/2/issue/${ticketId}?fields=${fields}`);
    } catch (err) {
      jiraLog.warn('v2 API failed, trying JQL search', { error: err.message });
    }

    // 3️⃣ Fall back to JQL search (handles team-managed projects)
    const jql = encodeURIComponent(`key = "${ticketId}"`);
    const searchUrl = `/rest/api/3/search?jql=${jql}&fields=${fields}&maxResults=1`;
    const result = await this._request('GET', searchUrl);
    if (result.issues && result.issues.length > 0) {
      jiraLog.info('Found ticket via JQL search', { ticketId });
      return result.issues[0];
    }
    throw new Error(`Ticket ${ticketId} not found via v3, v2 or JQL search`);
  }

  /**
   * Post a comment to a Jira issue.
   * @param {string} ticketId
   * @param {string} text  Plain-text comment body (converted to ADF internally)
   */
  async addComment(ticketId, text) {
    jiraLog.info('Adding comment', { ticketId });
    const body = {
      body: {
        type:    'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text }]
        }]
      }
    };
    return withRetry(
      () => this._cb.call(() => this._request('POST', `/rest/api/3/issue/${ticketId}/comment`, body)),
      { attempts: 2, baseDelayMs: 500 }
    );
  }

  get circuitBreakerStats() {
    return this._cb.stats();
  }
}

// Singleton — one client per process
module.exports = new JiraClient();
