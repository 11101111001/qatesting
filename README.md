# Hacker News E2E Test Runner (Playwright + Vue + SSE)

A compact project that:

- Scrapes Hacker News **Newest** using Playwright **locators only** (no `evaluate`).
- Runs a suite of **stable smoke tests** across HN (newest, ask, show, jobs, comments, past).
- Streams **live logs** to a local Vue UI via **Server-Sent Events (SSE)**.
- Supports **Run / Abort / Reset** from the UI (mini CI vibe).
- Optionally tests **login** (and submit) when credentials are provided.
- Includes a CLI to validate **ordering** of the first N items.

> We intentionally **exclude** screenshot/snapshot tests to avoid flakiness from layout drift.

---

## Quick Start

```bash
# 0) Prereqs:
#    - Node 18+ (LTS or newer)
#    - macOS/Linux/WSL recommended

# 1) Install deps and Playwright browsers
npm ci
npx playwright install --with-deps

# 2) Start the local UI (http://localhost:3000)
npm run start
```

Open **http://localhost:3000** and click **Run** on any test. You can **Abort** a running test or **Reset** all statuses/logs at any time.

---

## Test Catalog (what each file checks)

### `smoke.spec.js`

- `/newest` loads and URL matches.
- Header link “Hacker News” is visible.
- Clicking **More** changes the first row (sanity pagination check).

### `console.spec.js`

- Captures browser console logs on `/newest` and fails if any **console.error** occurs.

### `content.spec.js`

- Every story row has:
  - a non-empty `id`,
  - a visible title link with `href` and text,
  - a visible relative age (e.g., “3 hours ago”).
- All `id`s on the page are **unique**.

### `header.spec.js`

- A direct HTTP GET to `https://news.ycombinator.com/newest`:
  - returns 2xx and `Content-Type: text/html`.
  - includes a `Cache-Control` header.
- `https://news.ycombinator.com/robots.txt` exists and is non-empty.

### `links.spec.js`

- On `/newest`, collects a small sample of story links (be polite).
- Tries `HEAD`, falls back to `GET`.
- Treats major bot blocks (e.g., 403) as **skips**; otherwise expects **< 400** status.
  > Some publishers gate with 400/403/anti-bot; the test logs these and continues.

### `ordering-full.spec.js`

- Uses **locator-only** scraping across pagination to collect the first **100** newest items.
- Normalizes timestamps (prefers ISO in `title` attr; falls back to parsing relative age).
- Asserts timestamps are **non-increasing** (newest → oldest), allowing ties.

### `performance.spec.js`

- Reports Navigation Timing metrics for `/newest` (`domContentLoaded`, `load`, `transferSize`, etc.).
- Verifies we can enumerate `performance` resource entries.

### `tabs.spec.js`

- **Ask HN**: page shows posts; (best-effort) looks for pagination if present.
- **Show HN**: page shows posts and **More**.
- **Jobs**: page loads and paginates.
- **Comments**: list of recent comments exists.
- **Past**: front page with days displays and paginates.

> These are written to be **resilient** to content changes; they assert presence of key elements rather than exact text.

### `auth.spec.js`

- **Invalid login**: stays unauthenticated; shows the **login** link.
- **Valid login**: logs in, then logs out (best-effort).
- If a CAPTCHA/human-check is detected **or** credentials are missing, tests **skip** (environmental).

---

## Running Tests

### Run all

```bash
npx playwright test
```

### Run a single file

```bash
npx playwright test tests/ordering-full.spec.js
```

### Show the last HTML report

```bash
npx playwright show-report
```

---

## The UI (Run / Abort / Reset + Live Logs)

- **Run** starts a test and streams logs to the card via SSE.
- **Abort** sends a kill to the underlying process (stops the run quickly).
- **Reset** clears all test statuses/logs in the UI.
- Click **Show Logs** on any card to expand/collapse raw output.

> The experience resembles a slimmed-down GitHub Actions view: activity spinner while running, success/fail badges on completion.

---

## Login & Submit (optional)

### Option A — Shell environment

Set environment variables (recommended for CI/local shell):

### macOS/Linux

```bash
export HN_USER="your_username"
export HN_PASS="your_password"
npx playwright test tests/auth.spec.js
```

### Windows PowerShell

```powershell
$env:HN_USER="your_username"; $env:HN_PASS="your_password"
npx playwright test tests/auth.spec.js
```

### Option B — From the UI

- Use the **Credentials** card to enter username/password and click **Save**.
- The server stores them **in memory** for this session and uses them only to spawn the test process with `HN_USER` / `HN_PASS`.

## Notes

- Hacker News may present a **human-check / CAPTCHA**. When detected, the tests **skip** (do not fail) and log why.
- We never persist credentials to disk or log them.

---

## CLI: Ordering Check

There’s a simple CLI that verifies **ordering** of the first N items on `/newest` and can write a Markdown report.

```bash
# Headless (default), first 100, write a report
node index.js --limit=100 --report newest.md

# With a screenshot of /newest
node index.js --limit=50 --screenshot newest.png

# Turn off headless if you want to watch the browser
node index.js --limit=100 --headless=false
```

Exit code is **0** when ordering looks correct, **1** otherwise.

---

## Troubleshooting

- **UI shows Tailwind CDN warning**  
  That’s expected in dev. If you want zero warnings, swap CDN for a local Tailwind build (PostCSS/CLI). Not required for this project.

- **“No tests found”**  
  Make sure the path/regex is correct. Example:

  ```bash
  npx playwright test tests/auth.spec.js 
  ```

- **Login tests fail or time out**  
  Likely a CAPTCHA/human-check. Our tests detect this and call `test.skip(...)`. If you still see a failure, re-run or try a different network.

- **External links fail in `links.spec.js`**  
  Publishers may return `400/403` for headless requests. The test logs and skips common blocks; occasional failures can be excluded by domain if needed.

- **Abort doesn’t stop immediately**  
  The process is killed, but the browser may take a moment to close. The UI swaps **Abort → Run** as soon as the process exits.

---

## Scripts

```bash
npm run start   # starts Express + SSE runner (http://localhost:3000)
npm run test    # alias for `playwright test` (if defined)
```

---

## Tech Stack

- **Playwright** for E2E (Chromium, Firefox, WebKit).
- **Vue 3** (CDN build) for a no-build control panel.
- **Express** for SSE test streaming and process orchestration.
