// tests/profile-ordering.spec.js
import { test, expect } from '@playwright/test';

/**
 * Verify a user’s submitted stories are newest → oldest.
 * Override user with: HN_PROFILE_USER=pg npx playwright test
 */
const USER = process.env.HN_PROFILE_USER || 'dang';
const GRACE_MS = 2000; // allow tiny timestamp jitter

// "3 hours ago" / "yesterday" / "just now" → epoch ms
function parseRelativeAgeToMs(text) {
  const s = (text || '').trim().toLowerCase();
  const now = Date.now();
  if (!s) return NaN;
  if (/\bjust now\b/.test(s)) return now;
  if (/\byesterday\b/.test(s)) return now - 86_400_000;

  const m = s.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/);
  if (!m) return NaN;

  const n = Number(m[1]);
  const unitMs = {
    second: 1_000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 30 * 86_400_000,   // coarse is fine for ordering checks
    year: 365 * 86_400_000,   // coarse is fine for ordering checks
  }[m[2]];
  return unitMs ? now - n * unitMs : NaN;
}

// "on April 19, 2024" / "on 2024-04-19" → epoch ms
function parseAbsoluteOnDate(text) {
  if (!text) return NaN;
  let s = text.trim().replace(/^on\s+/i, '');
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1').replace(/,/g, '');
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

// Pull first usable timestamp + its display label from the meta row.
async function extractTimeAndLabel(meta, rowIndex) {
  // Prefer relative “ago”
  const rel = meta.getByRole('link', { name: /\b(ago|yesterday|just now)\b/i }).first();
  if (await rel.count()) {
    const txt = (await rel.textContent())?.trim() || '';
    const t = parseRelativeAgeToMs(txt);
    if (Number.isFinite(t)) return { t, label: txt.toLowerCase() };
  }

  // Then absolute “on …”
  const abs = meta.getByRole('link', { name: /^on\s+/i }).first();
  if (await abs.count()) {
    const txt = (await abs.textContent())?.trim() || '';
    const t = parseAbsoluteOnDate(txt);
    if (Number.isFinite(t)) return { t, label: txt.toLowerCase() };
  }

  // Finally, a title attribute (e.g., "YYYY-MM-DD HH:mm")
  const titled = meta.locator('a[title]').first();
  if (await titled.count()) {
    const title = await titled.getAttribute('title');
    if (title) {
      const iso = title.includes('T') ? title : title.replace(' ', 'T');
      const t = Date.parse(iso);
      if (Number.isFinite(t)) return { t, label: title.toLowerCase() };
    }
  }

  const snippet = (await meta.innerText().catch(() => '')).slice(0, 160).replace(/\s+/g, ' ');
  throw new Error(`submission row[${rowIndex}] should yield a valid timestamp (meta: "${snippet || 'n/a'}")`);
}

// Non-increasing order w/ ties (same bucket label) or tiny positive jitter allowed.
function expectDescendingAllowTies(rows) {
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (a.t >= b.t) continue;

    const sameBucket = a.label && b.label && a.label === b.label;
    const delta = b.t - a.t;

    expect(
      sameBucket || delta <= GRACE_MS,
      `Ordering broke at index ${i}: ${new Date(a.t).toISOString()} -> ${new Date(b.t).toISOString()} (+${delta}ms); labels: "${a.label}" vs "${b.label}"`
    ).toBe(true);
  }
}

test.describe('User submissions ordering', () => {
  test(`submitted by "${USER}" is descending by time`, async ({ page }) => {
    await page.goto(`https://news.ycombinator.com/submitted?id=${encodeURIComponent(USER)}`, {
      waitUntil: 'domcontentloaded',
    });

    const rows = page.locator('tr.athing.submission');
    await expect(rows.first(), 'At least one submission row should be visible').toBeVisible();

    const take = Math.min(await rows.count(), 20);
    expect(take, 'Expected at least a few submissions to test ordering').toBeGreaterThanOrEqual(5);

    const results = [];
    for (let i = 0; i < take; i++) {
      // meta row is immediate sibling with .subtext
      const meta = rows.nth(i).locator(':scope + tr .subtext');
      await expect(meta, `meta row should be present for row[${i}]`).toBeVisible();

      const { t, label } = await extractTimeAndLabel(meta, i);
      results.push({ t, label });
    }

    expectDescendingAllowTies(results);
  });
});
