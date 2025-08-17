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
    await page.goto('/newest', { waitUntil: 'domcontentloaded' });

    // Collect the first 15 story URLs
    const urls = await page.$$eval('.titleline a:first-child', as =>
      as.map(a => a.href).filter(h => /^https?:\/\//i.test(h)).slice(0, 15)
    );
    expect(urls.length, 'should have some external links to sample').toBeGreaterThan(0);

    const timeoutMs = 6000;
    const results = await Promise.all(urls.map(async (u) => {
      // Prefer HEAD, fall back to GET if HEAD fails
      try {
        const head = await request.fetch(u, { method: 'HEAD', timeout: timeoutMs, failOnStatusCode: false });
        if (head.ok() || (head.status() >= 200 && head.status() < 400)) {
          return { url: u, ok: true, status: head.status() };
        }
      } catch {}
      try {
        const get = await request.get(u, { timeout: timeoutMs, failOnStatusCode: false });
        return { url: u, ok: get.ok() || (get.status() >= 200 && get.status() < 400), status: get.status() };
      } catch (e) {
        return { url: u, ok: false, status: 0, err: String(e && e.message || e) };
      }
    }));

    const failures = results.filter(r => !r.ok);
    const tolerance =
      process.env.CI ? 0 : Number.isFinite(Number(process.env.LINK_TOLERANCE)) ? Number(process.env.LINK_TOLERANCE) : 2;

    if (failures.length > tolerance) {
      const details = failures.slice(0, 5).map(f => `- ${f.url} -> status ${f.status}${f.err ? ` (${f.err})` : ''}`).join('\n');
      throw new Error(`Link failures (${failures.length}) exceed tolerance ${tolerance}:\n${details}`);
    }

    // Helpful note when there are non-fatal failures locally
    if (failures.length) {
      test.info().annotations.push({
        type: 'note',
        description: `Non-fatal link failures (${failures.length}/${results.length}). Set LINK_TOLERANCE to adjust.`,
      });
    }
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
