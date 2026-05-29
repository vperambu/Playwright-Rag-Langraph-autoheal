# Playwright + Cucumber BDD Framework

A scalable test automation framework built with Playwright and Cucumber using CommonJS modules. This repository includes modular UI, API, and WebSocket test flows, observability, self-healing simulation, RAG analysis, and reusable infrastructure for enterprise-grade automation.

## Project Architecture

The framework is organized to separate concerns and support growth across teams:

- `config/`
  - `env.config.js`: Multi-environment configuration loader for `dev`, `qa`, `prod`, `onprem-devint`, `onprem-stage`, and `oncloud-stage`
  - `browser.config.js`: Browser launch helpers for Chromium, Firefox, WebKit, plus persistent context support
  - `device.config.js`: Mobile device emulation setup via Playwright devices and environment variables

- `tests/features/`
  - `ui/`: Gherkin feature files for UI scenarios (`home.feature`, `login.feature`)
  - `api/`: Gherkin feature files for REST API and WebSocket flows

- `tests/step-definitions/`
  - `ui/`: UI step definitions using `this.pages.*` page objects
  - `api/`: API and WebSocket step definitions using `this.clients.*` and `this.webSocketClients.*`

- `tests/pages/`
  - `base.page.js`: Base page object with shared Playwright helpers
  - `home.page.js`, `login.page.js`, `dashboard.page.js`: Domain-specific page objects

- `tests/api/clients/`
  - `posts.client.js`, `users.client.js`: Playwright APIRequestContext wrappers for JSONPlaceholder APIs

- `tests/support/`
  - `custom-world.js`: Custom Cucumber world holds browser, context, page, apiContext, pages, clients, webSocketClients, testData, userManager, and observability
  - `worlds.js`: World constructor registration
  - `user-manager.js`: Load test users from JSON or environment
  - `hooks/hooks.js`: Tag-aware Cucumber hooks for UI/API/WebSocket setup and teardown, screenshot and trace capture, observability flush

- `tests/utils/`
  - `assertion.util.js`: Custom assertion helpers wrapping Playwright expect
  - `file.util.js`: Directory and JSON helpers
  - `websocket.client.js`: Reusable WebSocket client with connect/send/waitForMessage/close and reconnect logic
  - `local-http-server.js`: Local web server for isolated UI execution
  - `local-websocket-server.js`: Local WebSocket echo server for stable websocket tests

- `tests/observability/`
  - `observability.service.js`: Scenario lifecycle observability
  - `metrics-recorder.js`: Step and scenario metrics recording
  - `structured-logger.js`: JSON structured logging
  - `ai-decision-log-store.js`: AI decision logging
  - `flaky-test-detector.js`: Retry-based flaky test detection

- `tests/rag/`
  - `rag.service.js`: RAG orchestration via an in-memory vector store
  - `mock-vector-store.js`: Simulated vector store
  - `text-embedder.js`: Stub text embedding
  - `test-artifact-repository.js`: Artifact persistence
  - `fix-suggestion-engine.js`: Failure suggestion engine
  - `websocket-rag-utils.js`: WebSocket artifact helpers

- `tests/ai/`
  - `test-generation.service.js`: AI-driven test step generation stub
  - `agents/self-healing.agent.js`: Self-healing selector suggestion agent
  - `langchain/`: Mock LangChain-style LLM and validation chain
  - `langgraph/`: Workflow nodes for test execution and healing

- `scripts/`
  - Auth state capture scripts
  - Report generation scripts
  - AI/RAG simulation scripts
  - WebSocket test helpers and simulators

- `.ci/`
  - `github-actions.yml`: CI workflow for install, smoke tests, regression tests, and Allure artifact upload

## Usage

### Install dependencies

```bash
cd playwright-cucumber-framework
export PATH="$PWD/.local/node/bin:$PATH"
npm install
```

If your environment lacks a system Node install, a local Node binary is available under `./.local/node/bin`.

### Run tests

```bash
npm test
```

### Run specific suites

```bash
npm run test:ui
npm run test:api
npm run test:smoke
npm run test:regression
npm run test:chrome
npm run test:firefox
npm run test:webkit
npm run test:headed
npm run test:mobile
npm run test:env:qa
```

### Generate reports

```bash
npm run report
npm run allure:generate
```

### Simulate AI and observability features

```bash
npm run ai:generate-tests
npm run ai:agents
npm run ai:rag
npm run simulate-observability
npm run simulate-rag-analysis
npm run simulate-websocket-rag-analysis
npm run simulate-websocket-client
npm run simulate-chatbot-streaming-websocket-validation
npm run simulate-langgraph-chatbot-flow
```

## Execution Architecture

### UI tests

- `@ui` tagged scenarios launch a Playwright browser context.
- Page objects are initialized in `CustomWorld.initPages()`.
- The local HTTP server provides stable test pages and routes for isolation.
- Screenshots and traces are captured automatically on failure.

### API tests

- `@api` tagged scenarios initialize a Playwright `APIRequestContext`.
- Clients wrap request calls and expose domain-specific actions.
- Test data is shared through `this.testData` in the custom world.

### WebSocket tests

- `@websocket` tagged scenarios create and manage WebSocket connections.
- A local echo server is used when no external `WEBSOCKET_URL` is provided.
- Messages are waited on via predicates and captured via client helper methods.

### Observability

- Each scenario records step duration and status.
- Observability output is written to `test-results/observability/`.
- Flaky tests are detected from retry history.

### RAG and AI simulation

- RAG modules use a mock vector store and embedder to simulate failure analysis.
- AI modules provide stubs for generation, validation, and self-healing workflows.
- These components are designed for early experimentation without real LLM calls.

## Notes

- This framework uses CommonJS (`require` / `module.exports`) so it is compatible with legacy Node.js setups.
- Example API base is `https://jsonplaceholder.typicode.com`.
- Example UI base is `https://playwright.dev`, but local pages are used for deterministic UI test execution.
- The project includes a `.gitignore` to keep auth state, reports, and results out of source control.

---

For more details, inspect the `config/`, `tests/`, and `scripts/` directories. This README is the entry point for using and extending the framework.
