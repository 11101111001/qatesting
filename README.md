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
Users on **windows** must run this in WSL due to test pathing requirements.

---

## Test Catalog (what each file checks)

### `takehomeassign.spec.js` (Original test asked for in the take home)

- Uses **locator-only** scraping across pagination to collect the first **100** newest items.
- Normalizes timestamps (prefers ISO in `title` attr; falls back to parsing relative age).
- Asserts timestamps are **non-increasing** (newest → oldest), allowing ties.

### `ask-show-hueristics.spec.js`

- /show: grabs the first ~20 titles and asserts that a strong portion start with “Show HN” (threshold + sanity minimum).
- /ask: grabs the first ~20 titles and asserts that a strong portion start with “Ask HN” (threshold + sanity minimum).
- Guarantees at least one visible row before evaluating counts.

### `auth.spec.js`

- This test **may** fail if many attempts have been made or if HN throws a reCAPTCHA.
- **Invalid login**: stays unauthenticated; shows the **login** link.
- **Valid login**: logs in, then logs out (best-effort).
- If a CAPTCHA/human-check is detected **or** credentials are missing, tests **skip** (environmental).

### `console.spec.js`

- Captures browser console logs on `/newest` and fails if any **console.error** occurs.

### `content.spec.js`

- Every story row has:
  - a non-empty `id`,
  - a visible title link with `href` and text,
  - a visible relative age (e.g., “3 hours ago”).
- All `id`s on the page are **unique**.

### `footer-search.spec.js`

- From /newest, uses the footer search form (field q) to search for “apple”.
- Verifies redirect to hn.algolia.com/?q=apple.
- Asserts Algolia results render: container visible and multiple article.Story cards present.

### `header.spec.js`

- A direct HTTP GET to `https://news.ycombinator.com/newest`:
  - returns 2xx and `Content-Type: text/html`.
  - includes a `Cache-Control` header.
- `https://news.ycombinator.com/robots.txt` exists and is non-empty.

### `host-badges.spec.js`

- On /newest, among the first ~30 rows, counts visible host/domain badges near titles (e.g., span.sitebit).
- Expects at least a handful to show host badges (internal posts like Ask/Show HN won’t have them).

### `item-structure.spec.js`

- From /newest, navigates to an item with N comments (falls back to age link if necessary).
- On the item page:
  - verifies header (table.fatitem),
  - title link, author (hnuser), and age link are visible,
  - comment rows (tr.comtr) are listed when applicable.

### `links.spec.js`

- On `/newest`, collects a small sample of story links (be polite).
- Tries `HEAD`, falls back to `GET`.
- Treats major bot blocks (e.g., 403) as **skips**; otherwise expects **< 400** status.

> Some publishers gate with 400/403/anti-bot; the test logs these and continues.

### `newcomment.spec.js`

- Visits /newcomments and verifies that each of the first ~10 comment rows has:
  - a visible username (a.hnuser),
  - a visible age link (span.age a),
  - visible comment text (non-empty).

### `past-navigation`

- Visits /front and clicks a day link (/front?day=YYYY-MM-DD).
- On the chosen day page, asserts the item table renders and at least one story row is visible.

### `performance.spec.js`

- Reports Navigation Timing metrics for `/newest` (`domContentLoaded`, `load`, `transferSize`, etc.).
- Verifies we can enumerate `performance` resource entries.

### `profile-ordering.spec.js`

- User submissions ordering on /submitted?id=user (default dang; override with HN_PROFILE_USER=pg).
- Extracts timestamps from the meta row (relative “ago”, on … absolute, or title attribute).
- Asserts newest → oldest, allowing ties (same bucket label) and tiny jitter.
- If user does not have submissions, test will fail.

### `profile.spec.js`

- Profile page (/user?id=user): asserts core fields (user id, created/karma) and presence of Submissions / Comments / Favorites links.
- Submissions tab: shows a visible list of submission rows with title links.
- Comments tab: shows visible comment rows/snippets.
- Favorites tab: loads and shows either favorites or a valid empty state.

### `search-ordering.spec.js`

- Algolia query “apple” with type=story:
  - Sort by Date (all time): collects timestamps from each result and asserts descending order (ties + small jitter allowed).
  - Sort by Date (Past Week): asserts all results are within the last 7 days and descending.
- Timestamps parsed from each result’s “X units ago” anchor or absolute date.

### `search.spec.js`

- Algolia basic visibility at https://hn.algolia.com/?q=apple:
  - results container visible,
  - multiple article.Story cards,
  - each card has a visible title link with http(s) href,
  - and an HN discussion link (news.ycombinator.com/item?id=…).

### `smoke.spec.js`

- `/newest` loads and URL matches.
- Header link “Hacker News” is visible.
- Clicking **More** changes the first row (sanity pagination check).

### `submit.spec.js`

- Anonymous user: visiting /submit redirects to the login page.
- Authenticated (when HN_USER/HN_PASS provided and no human-check): the submit form is visible.
- If a validation/CAPTCHA flow is detected, the test skips rather than fails.

### `tabs.spec.js`

- **Ask HN**: page shows posts; (best-effort) looks for pagination if present.
- **Show HN**: page shows posts and **More**.
- **Jobs**: page loads and paginates.
- **Comments**: list of recent comments exists.
- **Past**: front page with days displays and paginates.

> These are written to be **resilient** to content changes; they assert presence of key elements rather than exact text.

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

### Shell environment

Set environment variables (recommended for CI/local shell):

### macOS/Linux

```bash
HN_USER="username" HN_PASS="password" node auth-check.js
```

### Windows PowerShell

```powershell
$env:HN_USER="your_username"; $env:HN_PASS="your_password"; node auth-check.js
```

## Notes

- Hacker News may present a **human-check / CAPTCHA**. When detected, the tests **skip** (do not fail) and log why.
- We never persist credentials to disk or log them.

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
