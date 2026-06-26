'use strict';

/**
 * HtmlReporter — self-contained HTML report (no CDN, no external deps).
 * Saved to orchestration/generated/reports/<ticketId>/report.html
 */

const fs   = require('fs');
const path = require('path');

class HtmlReporter {
  write(state) {
    const { ticketId } = state;
    const dir  = path.resolve(__dirname, '../../orchestration/generated/reports', ticketId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'report.html');
    fs.writeFileSync(filePath, this._buildHtml(state), 'utf8');
    return filePath;
  }

  _buildHtml(state) {
    const { ticketId, mode, groundingResult: gr, plannerResult: pl,
            testerResult: tr, reviewerResult: rv, coverageReport: cv } = state;

    const ts    = new Date().toISOString();
    const title = gr ? gr.title : ticketId;
    const score = rv ? rv.score : 'N/A';
    const grade = rv ? rv.grade : 'N/A';
    const covPct = cv ? cv.coveragePercent : 0;
    const tSummary = tr ? tr.summary : { total: 0, passed: 0, failed: 0, skipped: 0 };
    const scenarios = pl ? pl.scenarios : [];

    const gradeColor = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' }[grade] || '#64748b';
    const covColor   = covPct >= 80 ? '#22c55e' : covPct >= 60 ? '#eab308' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test Report — ${ticketId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6}
  .container{max-width:1200px;margin:0 auto;padding:24px}
  header{background:linear-gradient(135deg,#1e3a5f,#1e293b);border-radius:12px;padding:32px;margin-bottom:24px;border:1px solid #334155}
  header h1{font-size:1.8rem;color:#f8fafc;margin-bottom:4px}
  header .meta{color:#94a3b8;font-size:0.9rem}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600;margin:4px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;text-align:center}
  .card .value{font-size:2.5rem;font-weight:700;display:block}
  .card .label{color:#94a3b8;font-size:0.85rem;margin-top:4px}
  .section{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:24px;margin-bottom:20px}
  .section h2{font-size:1.1rem;color:#f1f5f9;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  table{width:100%;border-collapse:collapse;font-size:0.85rem}
  th{background:#0f172a;color:#94a3b8;padding:10px 12px;text-align:left;font-weight:600}
  td{padding:10px 12px;border-bottom:1px solid #1e293b;vertical-align:top}
  tr:hover td{background:#162032}
  .tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:500;margin:2px}
  .positive{background:#065f46;color:#6ee7b7}
  .negative{background:#7f1d1d;color:#fca5a5}
  .edge{background:#4c1d95;color:#c4b5fd}
  .passed{color:#22c55e} .failed{color:#ef4444} .skipped{color:#94a3b8}
  .high{color:#ef4444} .medium{color:#f97316} .low{color:#eab308}
  .cov-bar{height:8px;background:#1e3a5f;border-radius:4px;margin-top:4px}
  .cov-fill{height:100%;border-radius:4px;background:${covColor}}
  .finding{padding:8px 12px;border-radius:6px;margin-bottom:6px;font-size:0.85rem}
  .finding.high{background:#450a0a;border-left:3px solid #ef4444}
  .finding.medium{background:#431407;border-left:3px solid #f97316}
  .finding.low{background:#422006;border-left:3px solid #eab308}
  .rec{padding:8px 12px;background:#172554;border-left:3px solid #3b82f6;border-radius:0 6px 6px 0;margin-bottom:6px;font-size:0.85rem}
  .footer{text-align:center;color:#475569;font-size:0.8rem;margin-top:32px;padding-top:16px;border-top:1px solid #1e293b}
  .p0{background:#1c1917;color:#fbbf24} .p1{background:#1c1917;color:#94a3b8} .p2{background:#1c1917;color:#6b7280}
</style>
</head>
<body>
<div class="container">

<!-- Header -->
<header>
  <h1>🤖 Test Report — ${this._esc(ticketId)}</h1>
  <div class="meta">${this._esc(title)}</div>
  <div class="meta" style="margin-top:8px">
    <span class="badge" style="background:#1e3a5f;color:#60a5fa">Mode: ${mode.toUpperCase()}</span>
    <span class="badge" style="background:#1e3a5f;color:#60a5fa">Domain: ${gr ? gr.domain : 'N/A'}</span>
    <span class="badge" style="background:#1e3a5f;color:#60a5fa">Generated: ${ts}</span>
  </div>
</header>

<!-- KPI Cards -->
<div class="cards">
  <div class="card">
    <span class="value" style="color:${covColor}">${covPct}%</span>
    <div class="label">Requirement Coverage</div>
    <div class="cov-bar"><div class="cov-fill" style="width:${covPct}%"></div></div>
  </div>
  <div class="card">
    <span class="value" style="color:#22c55e">${tSummary.passed}</span>
    <div class="label">Specs Passed</div>
  </div>
  <div class="card">
    <span class="value" style="color:#ef4444">${tSummary.failed}</span>
    <div class="label">Specs Failed</div>
  </div>
  <div class="card">
    <span class="value">${scenarios.length}</span>
    <div class="label">Scenarios Generated</div>
  </div>
  <div class="card">
    <span class="value" style="color:${gradeColor}">${grade}</span>
    <div class="label">Quality Grade (${score}/100)</div>
  </div>
</div>

<!-- Coverage Matrix -->
<div class="section">
  <h2>📋 Requirement Coverage Matrix</h2>
  ${cv && cv.matrix.length ? `
  <table>
    <thead><tr><th>#</th><th>Requirement</th><th>Covered</th><th>Confidence</th><th>Mapped Scenarios</th></tr></thead>
    <tbody>
    ${cv.matrix.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${this._esc(m.requirement)}</td>
        <td>${m.covered ? '<span class="passed">✓ Yes</span>' : '<span class="failed">✗ No</span>'}</td>
        <td class="${m.confidence === 'high' ? 'passed' : m.confidence === 'medium' ? 'medium' : 'low'}">${m.confidence}</td>
        <td>${m.mappedScenarios.map(s => `<span class="tag positive">${this._esc(s.scenarioId)}</span>`).join('') || '<span class="failed">None</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p style="color:#64748b">No coverage data available</p>'}
</div>

<!-- Scenarios -->
<div class="section">
  <h2>🧪 Generated Test Scenarios (${scenarios.length})</h2>
  <table>
    <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Priority</th><th>Tags</th></tr></thead>
    <tbody>
    ${scenarios.map(s => `
      <tr>
        <td style="font-family:monospace;color:#60a5fa">${s.id}</td>
        <td>${this._esc(s.title)}</td>
        <td><span class="tag ${s.type}">${s.type}</span></td>
        <td><span class="tag ${s.priority.toLowerCase()}">${s.priority}</span></td>
        <td>${(s.tags || []).map(t => `<span class="tag" style="background:#1e3a5f;color:#94a3b8">@${t}</span>`).join('')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- Quality Findings -->
${rv && rv.findings.length ? `
<div class="section">
  <h2>🔍 Quality Findings</h2>
  ${rv.findings.map(f => `
    <div class="finding ${f.severity}">
      <strong>[${f.severity.toUpperCase()}]</strong> ${this._esc(f.message)}
      <span style="color:#64748b;font-size:0.8rem;float:right">${this._esc(f.file)}</span>
    </div>`).join('')}
</div>` : ''}

<!-- Recommendations -->
${rv && rv.recommendations.length ? `
<div class="section">
  <h2>💡 Recommendations</h2>
  ${rv.recommendations.map(r => `<div class="rec">${this._esc(r)}</div>`).join('')}
</div>` : ''}

<!-- Execution Results -->
${tr && tr.results.length ? `
<div class="section">
  <h2>⚡ Execution Results</h2>
  <table>
    <thead><tr><th>Spec File</th><th>Type</th><th>Status</th><th>Duration</th><th>Failures</th></tr></thead>
    <tbody>
    ${tr.results.map(r => `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem">${this._esc(r.specFile)}</td>
        <td><span class="tag ${r.type}">${r.type}</span></td>
        <td class="${r.status}">${r.status.toUpperCase()}</td>
        <td>${r.durationMs}ms</td>
        <td>${r.failures.length ? r.failures.map(f => `<div class="failed">${this._esc((f.message || '').slice(0, 100))}</div>`).join('') : '<span class="passed">None</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- Jira Comment Preview -->
${state.jiraComment ? `
<div class="section">
  <h2>📝 Jira Comment Preview</h2>
  <pre style="background:#0f172a;padding:16px;border-radius:8px;font-size:0.8rem;overflow-x:auto;white-space:pre-wrap;color:#94a3b8">${this._esc(state.jiraComment.text)}</pre>
  ${state.jiraComment.published ? `<p style="color:#22c55e;margin-top:8px">✓ Published to Jira: ${state.jiraComment.url}</p>` : `<p style="color:#64748b;margin-top:8px">Not published (set JIRA_PUBLISH_RESULTS=true to enable)</p>`}
</div>` : ''}

<div class="footer">
  Generated by MultiAgent Orchestration System v1.0 &nbsp;|&nbsp; Playwright + LangGraph Autoheal Framework<br>
  ${ts}
</div>
</div>
</body>
</html>`;
  }

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

module.exports = new HtmlReporter();
