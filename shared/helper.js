// shared/hn.js
// Uses Playwright LOCATORS only (no $, no jQuery, no page.evaluate).
// Exposes helpers for scraping Hacker News "newest" pages.

/**
 * @typedef {Object} HNItem
 * @property {number} index     // 1-based index within the collected slice
 * @property {string|null} id   // story row id (Hacker News post id)
 * @property {string} title     // title text
 * @property {string} iso       // ISO string for the post age (derived from @title or relative text)
 * @property {number} ts        // Unix epoch ms for sorting comparisons
 * @property {string} href      // href of the title link (external or item?id=...)
 */

const { expect } = require('@playwright/test');

/**
 * Parse a relative age like "3 minutes ago" / "yesterday" into an epoch ms timestamp.
 * Falls back to NaN if it can't parse.
 * @param {string} text
 * @param {number} [nowMs]
 * @returns {number}
 */
function parseRelAge(text, nowMs = Date.now()) {
  const s = String(text).trim().toLowerCase();
  if (s === 'just now') return nowMs;
  if (s === 'yesterday') return nowMs - 24 * 60 * 60 * 1000;
  const m = s.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  const unit = m[2];
  const unitMs = {
    second: 1_000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 30 * 86_400_000,  // coarse approx; adequate for ordering checks
    year: 365 * 86_400_000
  }[unit];
  return nowMs - n * unitMs;
}

/**
 * Collects exactly `limit` items from /newest across pagination using Playwright locators.
 * Performs web-first assertions which also act as waits (stabilizes scraping).
 * @param {import('@playwright/test').Page} page
 * @param {{ limit?: number, verbose?: boolean }} [opts]
 * @returns {Promise<HNItem[]>}
 */

async function collectItems(page, { limit = 100, verbose = true } = {}) {
  /** @type {HNItem[]} */
  const items = [];
  const nowFixed = Date.now();

  while (items.length < limit) {
    // Basic page shape sanity (these expects auto-wait for the DOM to be ready)
    await expect(page).toHaveURL(/\/newest/);
    await expect(page.locator('tr.athing').first()).toBeVisible();

    const rows = page.locator('tr.athing');
    const count = await rows.count();

    // NOTE: `count` is a number, not a Locator; use `i < count`
    for (let i = 0; i < count && items.length < limit; i++) {
      const row = rows.nth(i);

      // Row must expose an id attribute (the HN post id)
      await expect(row).toHaveAttribute('id', /.+/);
      const id = await row.getAttribute('id');

      // Title link sits under `.titleline a`
      const titleLink = row.locator('.titleline').getByRole('link').first();
      await expect(titleLink).toBeVisible();
      const title = (await titleLink.innerText()).trim();
      const href = (await titleLink.getAttribute('href')) || '';

      // The meta/subtext row is the immediate next <tr>
      const metaRow = row.locator('xpath=following-sibling::tr[1]');
      const age = metaRow.locator('span.age');
      await expect(age).toBeVisible();

      // Prefer ISO from @title on <span.age> or its child <a>
      let iso =
        (await age.getAttribute('title')) ||
        (await age.getByRole('link').getAttribute('title')) ||
        '';
      let ts = Number.NaN;

      if (iso) {
        const d = new Date(iso);
        ts = d.getTime();
        await expect.soft(age).toHaveAttribute('title', /.+/);
      }
      // Fallback: parse the visible relative time text
      if (!Number.isFinite(ts)) {
        const rel = await age.innerText();
        await expect.soft(age).toHaveText(/ago|just now|yesterday/i);
        ts = parseRelAge(rel, nowFixed);
        // Round to the nearest second to avoid ms jitter from nowFixed creation time
        ts = Math.floor(ts / 1000) * 1000;
        isoOut = new Date(ts).toISOString();
      }

      if (verbose) {
        // eslint-disable-next-line no-console
        console.log(`${String(items.length + 1).padStart(3)} | ${id} | ${iso} | ${title}`);
      }

      items.push({ index: items.length + 1, id, title, iso, ts, href });
    }

    // Click "More" if we still need more items
    if (items.length < limit) {
      const more = page.locator('a.morelink[rel="next"]');
      await expect(more).toBeVisible();
      
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        more.click(),
      ]);
    }
  }

  return items;
}

/**
 * Verify timestamps are non-increasing (newest → oldest), allowing ties.
 * @param {HNItem[]} items
 * @returns {{ ok: boolean, idx: number }} idx is the first offending index, or -1 if ok
 */
function isNonIncreasingTimestamps(items) {
  for (let i = 1; i < items.length; i++) {
    if (items[i].ts > items[i - 1].ts) return { ok: false, idx: i };
  }
  return { ok: true, idx: -1 };
}

module.exports = { parseRelAge, collectItems, isNonIncreasingTimestamps };
