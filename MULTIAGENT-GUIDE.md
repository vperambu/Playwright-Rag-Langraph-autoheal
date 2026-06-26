# 🤖 MultiAgent AI Orchestration Framework

**Run any Jira ticket → execute tests → auto-comment results back to Jira**

---

## ⚡ Quick Start (any ticket)

```bash
node scripts/run-and-report.js SCRUM-6
node scripts/run-and-report.js SCRUM-1
node scripts/run-and-report.js PLAY-42
```

---

## 🛠️ Prerequisites

### 1. Ollama (local LLM)
```bash
# Install
brew install ollama

# Start as background service
brew services start ollama

# Pull the model (one-time, ~2GB)
ollama pull llama3.2

# Verify it's running
npm run ollama:health
```

### 2. Node dependencies
```bash
npm install
```

### 3. `.env.local` (credentials — never commit this file)

Create `.env.local` in the project root:

```env
# Jira
JIRA_BASE_URL=https://vperambu.atlassian.net
JIRA_EMAIL=vperambu@gmail.com
JIRA_API_TOKEN="your-api-token-here"
JIRA_PUBLISH_RESULTS=true

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
USE_LLM=true

# Orchestration
ORCHESTRATION_MODE=live
TICKET_ID=SCRUM-6
GENERATE_FEATURES=true
SKIP_EXECUTION=false
LOG_LEVEL=info
LOG_PRETTY=true

# Framework
TEST_ENV=dev
BASE_URL=https://playwright.dev
API_BASE_URL=https://jsonplaceholder.typicode.com
BROWSER=chromium
HEADLESS=true
```

> **Get your API token:** https://id.atlassian.com/manage-api-tokens

---

## 🚀 Run Commands

### Run with any Jira ticket
```bash
# Full run: fetch ticket → run all tests → post comment to Jira
node scripts/run-and-report.js SCRUM-1

# Run only API tests for a ticket
node scripts/run-and-report.js SCRUM-1 --tags @api

# Run only smoke tests
node scripts/run-and-report.js SCRUM-1 --tags @smoke

# Skip test execution (just post existing results)
node scripts/run-and-report.js SCRUM-1 --skip-tests
```

### NPM shortcuts
```bash
npm run report:scrum6          # Run for SCRUM-6 (all tests)
npm run report:api             # Run @api tests for SCRUM-6
npm run report:smoke           # Run @smoke tests for SCRUM-6
npm run orchestrate:scrum6     # Full AI orchestration pipeline
```

### Run just tests (without Jira reporting)
```bash
npm test                       # All tests
npm run test:api               # API tests only
npm run test:ui                # UI tests only
npm run test:smoke             # Smoke tests only
npm run test:regression        # Regression suite
```

---

## 🏗️ Agent Pipeline

```
Jira Ticket (any key)
        │
        ▼
┌─────────────────┐
│ GroundingAgent  │  ← Fetches ticket from Jira, parses AC & requirements
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TestRunner     │  ← Runs existing Playwright/Cucumber test suite
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ReportingAgent  │  ← Builds pass/fail summary with timings
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ JiraCommentReporter  │  ← Posts full results as comment on Jira ticket
└──────────────────────┘
```

---

## 🧪 What Gets Tested

| Feature File | Tag | Scenarios |
|---|---|---|
| `tests/features/api/posts.feature` | `@api` | Get posts list, Create & delete post |
| `tests/features/api/users.feature` | `@api @smoke` | Get user by ID |
| `tests/features/api/websocket.feature` | `@websocket` | WebSocket echo |
| `tests/features/ui/home.feature` | `@ui` | Playwright home page |
| `tests/features/ui/login.feature` | `@ui @regression` | Login flow |

---

## 🖥️ Running in VS Code

### Option 1 — Integrated Terminal
1. Open project: `File → Open Folder → Playwright-Rag-Langraph-autoheal`
2. Open terminal: `` Ctrl+` `` (backtick)
3. Run:
   ```bash
   node scripts/run-and-report.js SCRUM-1
   ```

### Option 2 — VS Code Task (one-click run)

Create `.vscode/tasks.json` in the project root:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run & Report: SCRUM-6",
      "type": "shell",
      "command": "node scripts/run-and-report.js SCRUM-6",
      "group": { "kind": "test", "isDefault": true },
      "presentation": { "reveal": "always", "panel": "new" }
    },
    {
      "label": "Run & Report: Custom Ticket",
      "type": "shell",
      "command": "node scripts/run-and-report.js ${input:ticketId}",
      "group": "test",
      "presentation": { "reveal": "always", "panel": "new" }
    },
    {
      "label": "Run API Tests Only",
      "type": "shell",
      "command": "node scripts/run-and-report.js ${input:ticketId} --tags @api",
      "group": "test",
      "presentation": { "reveal": "always", "panel": "new" }
    }
  ],
  "inputs": [
    {
      "id": "ticketId",
      "type": "promptString",
      "description": "Enter Jira ticket ID (e.g. SCRUM-1)",
      "default": "SCRUM-6"
    }
  ]
}
```

Then run via: `Terminal → Run Task → Run & Report: Custom Ticket` → type any ticket ID.

### Option 3 — launch.json (Debug mode)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run & Report (SCRUM-6)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/scripts/run-and-report.js",
      "args": ["SCRUM-6"],
      "envFile": "${workspaceFolder}/.env.local",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Jira Connection",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/orchestration/debug-jira.js",
      "envFile": "${workspaceFolder}/.env.local",
      "console": "integratedTerminal"
    }
  ]
}
```

Press **F5** to run with debugger attached.

---

## 🔁 For a New Jira Ticket

When given a NEW ticket (e.g. `SCRUM-1`):

1. **If ticket has Acceptance Criteria in description** — the framework reads them and maps test results to each AC in the Jira comment
2. **If ticket has no AC** — tests still run and results are posted (with a note that no AC were found)

To add AC to a ticket, put this in the Jira description:

```
h2. Acceptance Criteria
* User can do X
* System shows Y when Z happens
* Error message appears for invalid input
```

Then the agent will extract, map, and report against each one.

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| `ollama: command not found` | `brew install ollama` |
| `Could not connect to ollama` | `brew services start ollama` |
| Jira 404 | Check `.env.local` email matches your Atlassian login |
| Jira 401 | Regenerate token at https://id.atlassian.com/manage-api-tokens |
| `0 scenarios generated` | Add Acceptance Criteria to the Jira ticket description |
| Tests fail | Check `BASE_URL` and `API_BASE_URL` in `.env.local` |

---

## 📁 Project Structure

```
├── orchestration/
│   ├── agents/
│   │   ├── grounding.agent.js    ← Fetches & parses Jira ticket
│   │   ├── planner.agent.js      ← Generates test plan from AC
│   │   ├── coder.agent.js        ← Generates Playwright specs
│   │   ├── tester.agent.js       ← Executes tests
│   │   ├── reviewer.agent.js     ← Code quality review
│   │   └── reporting.agent.js    ← Builds final report
│   ├── core/
│   │   ├── orchestrator.js       ← Main state machine
│   │   ├── agent-base.js         ← Base class for all agents
│   │   ├── circuit-breaker.js    ← Resilience layer
│   │   └── retry.js              ← Retry logic
│   ├── jira/
│   │   ├── jira.client.js        ← Jira REST API client
│   │   └── jira.parser.js        ← ADF → plain text parser
│   ├── llm/
│   │   └── ollama.client.js      ← Local Ollama LLM client
│   └── reporters/
│       ├── jira-comment.reporter.js  ← Posts results to Jira
│       ├── html.reporter.js          ← HTML report
│       └── json.reporter.js          ← JSON report
├── scripts/
│   ├── run-and-report.js         ← ⭐ Main entry point
│   └── run-orchestration.js      ← Full AI generation pipeline
├── tests/
│   ├── features/                 ← Cucumber .feature files
│   ├── step-definitions/         ← Step implementations
│   └── ai/                       ← LangGraph / LangChain agents
├── .env.local                    ← Your credentials (never commit)
└── MULTIAGENT-GUIDE.md           ← This file
```

---

*MultiAgent AI Orchestration Framework v2.0 — Powered by Ollama (llama3.2) + LangGraph + Playwright*
