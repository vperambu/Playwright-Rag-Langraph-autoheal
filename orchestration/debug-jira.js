#!/usr/bin/env node
'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const https = require('https');

const email   = process.env.JIRA_EMAIL;
const token   = process.env.JIRA_API_TOKEN;
const auth    = Buffer.from(`${email}:${token}`).toString('base64');

// Try multiple base URL formats
const hosts = [
  'vperambu.atlassian.net',
  'api.atlassian.com'
];

function req(hostname, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname, port: 443, path: urlPath, method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const r = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function safeJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

(async () => {
  console.log(`\nEmail : ${email}`);
  console.log(`Token : ...${token ? token.slice(-10) : 'MISSING'}\n`);

  // 1. Myself endpoint
  console.log('──── 1. GET /rest/api/3/myself ──────────────────');
  const me = await req('vperambu.atlassian.net', 'GET', '/rest/api/3/myself');
  const mj = safeJson(me.body);
  if (mj && mj.emailAddress) {
    console.log(`  ✅ Authenticated as: ${mj.emailAddress} (${mj.displayName})`);
  } else {
    console.log(`  ❌ Status ${me.status} — body: ${me.body.slice(0,300)}`);
    console.log('  Location header:', me.headers.location || 'none');
  }

  // 2. List projects
  console.log('\n──── 2. GET /rest/api/3/project ─────────────────');
  const p = await req('vperambu.atlassian.net', 'GET', '/rest/api/3/project');
  const pj = safeJson(p.body);
  if (Array.isArray(pj)) {
    console.log(`  ✅ ${pj.length} project(s) accessible:`);
    pj.forEach(x => console.log(`     ${x.key.padEnd(12)} ${x.name}  [${x.projectTypeKey}]`));
  } else {
    console.log(`  ❌ Status ${p.status} — body: ${p.body.slice(0,300)}`);
  }

  // 3. JQL search for any SCRUM issue
  console.log('\n──── 3. JQL search: project = SCRUM ─────────────');
  const jql = encodeURIComponent('project = SCRUM ORDER BY created DESC');
  const s = await req('vperambu.atlassian.net', 'GET', `/rest/api/3/search?jql=${jql}&maxResults=5&fields=summary,status`);
  const sj = safeJson(s.body);
  if (sj && sj.issues) {
    console.log(`  ✅ ${sj.total} issues in SCRUM project`);
    sj.issues.forEach(i => console.log(`     ${i.key}  ${i.fields.summary}`));
  } else {
    console.log(`  ❌ Status ${s.status} — body: ${s.body.slice(0,300)}`);
  }

  // 4. Direct SCRUM-6 fetch
  console.log('\n──── 4. GET /rest/api/3/issue/SCRUM-6 ──────────');
  const i = await req('vperambu.atlassian.net', 'GET', '/rest/api/3/issue/SCRUM-6?fields=summary,status');
  const ij = safeJson(i.body);
  if (ij && ij.fields) {
    console.log(`  ✅ Found: ${ij.fields.summary} [${ij.fields.status.name}]`);
  } else {
    console.log(`  ❌ Status ${i.status} — body: ${i.body.slice(0,300)}`);
  }

  // 5. Post comment test
  if (i.status === 200) {
    console.log('\n──── 5. POST comment to SCRUM-6 ─────────────────');
    const cb = { body: { type:'doc', version:1, content:[{ type:'paragraph', content:[{ type:'text', text:'🤖 MultiAgent framework — permission test comment' }] }] } };
    const c = await req('vperambu.atlassian.net', 'POST', '/rest/api/3/issue/SCRUM-6/comment', cb);
    const cj = safeJson(c.body);
    if (c.status === 201) {
      console.log('  ✅ Comment posted! id:', cj.id);
    } else {
      console.log(`  ❌ Status ${c.status} — body: ${c.body.slice(0,300)}`);
    }
  }

  console.log('');
})().catch(e => console.error('Fatal:', e.message));
