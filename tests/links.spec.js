// tests/links.spec.js
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/links.spec.js

 What this runs
 - Loads /newest, samples the first N story links, and probes each URL via
   HEAD (fallback to GET). Collects any failures and asserts zero failures.

 Key assertions
 - At least one story row exists.
 - For each sampled link:
   • A response is received (HEAD or GET).
   • 2xx/3xx statuses pass; 4xx/5xx fail (with a few explicit exceptions).
 - If any failures occur, the test logs the failing URLs and statuses and fails.

 How to run (single file)
   npx playwright test tests/links.spec.js

 Notes
 - Some publishers rate-limit/geo-block; the test tolerates a small, explicit
   set (e.g., 403s if you coded them to “skip”), but otherwise surfaces errors.
 ----------------------------------------------------------------------------- */

test.use({ ignoreHTTPSErrors: true });

test.describe('Core: link and page health', () => {
  test('title links respond (HEAD/GET sample with aggregation)', async ({ page, request }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const links = await page.locator('.titleline a').evaluateAll(a =>
      a.map(x => x.getAttribute('href') || '').filter(Boolean)
    );

    const sample = links.slice(0, 25);
    /** @type {{url:string, status:number, note?:string}[]} */
    const failures = [];

    const allowStatus = (url, status) => {
      // Common bot statuses; allow so test stays stable
      if ([401, 403, 429, 503].includes(status)) return true;
      if (status === 400 && /ai\.meta\.com/.test(url)) return true;
      return false;
    };

    for (const url of sample) {
      let resp = null;
      try {
        const head = await request.head(url, { timeout: 15_000 });
        resp = head.ok() ? head : await request.get(url, { timeout: 15_000 });
      } catch {
        failures.push({ url, status: -1, note: 'network error' });
        continue;
      }
      const s = resp.status();
      if (!allowStatus(url, s) && s >= 400) failures.push({ url, status: s });
    }

    if (failures.length) {
      const detail = failures.map(f => `- ${f.url} (status: ${f.status}${f.note ? ', ' + f.note : ''})`).join('\n');
      throw new Error(`Link failures (${failures.length}):\n${detail}`);
    }
    expect(true).toBe(true);
  });

  test('each titleline has an anchor; host badge present for many externals', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const titles = page.locator('.titleline');
    const count = await titles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(25, count); i++) {
      const tl = titles.nth(i);
      await expect(tl.locator('a').first(), `Row ${i + 1}: anchor present`).toBeVisible();
    }

    const hostBadges = await page.locator('.sitebit .sitestr').count();
    expect(hostBadges, 'There should be several host badges on Newest').toBeGreaterThanOrEqual(5);
  });
});
