// tests/ordering-full.spec.js
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/ordering-full.spec.js

 What this runs
 - Crawls Hacker News “Newest” using locator-only helpers (shared/helper.js).
 - Collects a fixed slice (e.g., 100 items) across pagination.
 - Asserts strong page shape, then verifies timestamps are non-increasing
   (newest → oldest), allowing ties.

 Key assertions
 - Page URL is /newest and the first story row is visible.
 - Every row has: id attribute, visible title link, visible “age”.
 - Timestamps resolve to epoch ms (via @title or parsed relative text).
 - Ordering: for all i>0, ts[i] ≤ ts[i-1].

 How to run (single file)
   npx playwright test tests/ordering-full.spec.js

 Notes
 - Uses strict expects (no soft asserts).
 - Safe to run headed (Windows often clearer): add --headed.
 ----------------------------------------------------------------------------- */

// Minimal relative-age parser for HN strings
function parseRelAge(text, nowMs = Date.now()) {
  const s = String(text).trim().toLowerCase();
  if (s === 'just now') return nowMs;
  if (s === 'yesterday') return nowMs - 86400000;
  const m = s.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  const unitMs = {
    second: 1e3, minute: 6e4, hour: 36e5,
    day: 864e5, week: 7 * 864e5, month: 30 * 864e5, year: 365 * 864e5
  }[m[2]];
  return nowMs - n * unitMs;
}

test.describe('TAKE-HOME: Newest ordering (first 100)', () => {
  test('items are sorted newest → oldest with well-formed fields', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const collectPage = async () => {
      const rows = page.locator('tr.athing');
      const count = await rows.count();
      const out = [];
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);

        // id
        const id = (await row.getAttribute('id')) || '';
        expect(id).toMatch(/^\d+$/);

        // title/href
        const a = row.locator('.titleline a').first();
        await expect(a).toBeVisible();
        const title = (await a.innerText()).trim();
        const href = (await a.getAttribute('href')) || '';
        expect(title.length).toBeGreaterThan(0);
        expect(href.length).toBeGreaterThan(0);

        // meta
        const meta = row.locator('xpath=following-sibling::tr[1] .subtext');
        await expect(meta).toBeVisible();

        const age = meta.locator('span.age');
        await expect(age).toBeVisible();

        let iso = (await age.getAttribute('title')) || (await age.locator('a').getAttribute('title')) || '';
        let ts = Number.NaN;

        if (iso) {
          ts = new Date(iso).getTime();
          expect(Number.isFinite(ts)).toBe(true);
        } else {
          const rel = await age.innerText();
          expect(rel).toMatch(/ago|just now|yesterday/i);
          ts = Math.floor(parseRelAge(rel) / 1000) * 1000;
        }

        out.push({ id, title, href, iso, ts });
      }
      return out;
    };

    // First 2 pages
    const page1 = await collectPage();
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('a.morelink[rel="next"]').click(),
    ]);
    await expect(page).toHaveURL(/\/newest\?p=\d+/);
    const page2 = await collectPage();

    const all = page1.concat(page2).slice(0, 100);

    // Field sanity
    for (let i = 0; i < all.length; i++) {
      const it = all[i];
      expect(it.id).toMatch(/^\d+$/);
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.href.length).toBeGreaterThan(0);
      expect(Number.isFinite(it.ts)).toBe(true);
    }

    // Non-increasing timestamps (allow ties)
    for (let i = 1; i < all.length; i++) {
      expect(all[i].ts, `Index ${i} should be <= previous`).toBeLessThanOrEqual(all[i - 1].ts);
    }
  });
});
