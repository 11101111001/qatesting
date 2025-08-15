# Hacker News E2E Test Runner (Playwright + Vue + SSE)

A small project that:

- Scrapes Hacker News **Newest** with Playwright (locator-only).
- Runs a suite of **stable smoke tests** across HN tabs (news, ask, show, jobs, comments, past).
- Streams **live logs** to a local Vue UI via **Server-Sent Events (SSE)**.
- Supports **Run / Abort / Reset** from the UI (like a tiny CI).
- Optionally runs the **login**/**submit** flow when credentials are provided.

> We intentionally **do not** include visual snapshot tests to avoid flakiness from layout drift.

---

## Quick Start

```bash
# 0) Prereqs: Node 18+ (or newer). Then:
npm ci
npx playwright install --with-deps

# 1) Start the UI (http://localhost:3000)
npm run start

# 2) In your browser, open:
#    http://localhost:3000
#    Click “Run” on any test. You can Abort or Reset anytime.
```

---

## Useful Commands

### run all tests

npx playwright test

### run a single file

npx playwright test tests/ordering-full.spec.js

### show last HTML report

npx playwright show-report

---



### macOS/Linux

export HN_USER="your_username"
export HN_PASS="your_password"

``` Windows PowerShell```
``` $env:HN_USER="your_username"; $env:HN_PASS="your_password"```

### Then

npx playwright test tests/auth.spec.js tests/submit.spec.js
