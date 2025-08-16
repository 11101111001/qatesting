// tests/takehomeassign.spec.js
import { test, expect } from '@playwright/test';

/**
 * TAKE-HOME: Newest ordering (first 100)
 *
 * Robustness tweaks for a live feed:
 * - Freeze a baseline "now" PER PAGE when parsing relative ages.
 * - Validate non-increasing order WITHIN each page (tiny jitter tolerated).
 * - At page boundaries, use a slightly larger tolerance since content may shift
 *   while we click "More".
 *
 * Tunables (env):
 *   TAKEHOME_TOLERANCE_MS         default 1000  (within a page)
 *   TAKEHOME_BOUNDARY_MS          default 5000  (across page boundaries)
 *   TAKEHOME_MAX_PAGES            default 4     (4*~30 ≈ 120; we trim to 100)
 */

const TOLERANCE_MS =
  Number(process.env.TAKEHOME_TOLERANCE_MS ?? 1000);
const BOUNDARY_MS =
  Number(process.env.TAKEHOME_BOUNDARY_MS ?? 5000);
const MAX_PAGES =
  Number(process.env.TAKEHOME_MAX_PAGES ?? 4);

function parseRelativeAge(text, baseNow) {
  const s = (text || '').trim().toLowerCase();
  if (!s) return NaN;
  if (/\bjust now\b/.test(s)) return baseNow;
  if (/\byesterday\b/.test(s)) return baseNow - 24 * 60 * 60 * 1000;

  const m = s.match(/(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days)\s+ago/);
  if (!m) return NaN;

  const n = parseInt(m[1], 10);
  const unit = m[2];
  const unitMs = {
    second: 1000, seconds: 1000,
    minute: 60 * 1000, minutes: 60 * 1000,
    hour: 60 * 60 * 1000, hours: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000, days: 24 * 60 * 60 * 1000,
  }[unit];

  if (!unitMs) return NaN;
  return baseNow - n * unitMs;
}

async function ensureTableWithStories(page) {
  await page.waitForLoadState('domcontentloaded');

  const itemlist = page.locator('table.itemlist').first();
  if (await itemlist.count()) return itemlist;

  const fallback = page.locator('table').filter({ has: page.locator('tr.athing') }).first();
  if (await fallback.count()) return fallback;

  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });

  const itemlist2 = page.locator('table.itemlist').first();
  if (await itemlist2.count()) return itemlist2;

  return page.locator('table').filter({ has: page.locator('tr.athing') }).first();
}

async function collectOnePage(page, baseNow) {
  const table = await ensureTableWithStories(page);
  await expect(table, 'itemlist-like table should exist').toBeVisible();

  const rows = table.locator('tr.athing');
  const count = await rows.count();
  expect(count, 'should have at least one story row').toBeGreaterThan(0);

  const items = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    await expect(row).toBeVisible();

    // Main story anchor only (strict-mode safe)
    const titleLink = row.locator('.titleline > a').first();
    await expect(titleLink, 'title link visible').toBeVisible();
    const titleText = (await titleLink.textContent())?.trim() || '';

    // Immediate sibling meta row
    const meta = row.locator(':scope + tr .subtext');
    await expect(meta, 'meta (subtext) row visible').toBeVisible();

    // Age: prefer absolute via title attribute; else relative using frozen baseNow
    const ageLink = meta.locator('span.age a').first();
    await expect(ageLink, 'age link visible').toBeVisible();

    const isoRaw = await ageLink.getAttribute('title');
    let ts = NaN;

    if (isoRaw) {
      const normalized = isoRaw.includes('T') ? isoRaw : isoRaw.replace(' ', 'T');
      const parsed = Date.parse(normalized);
      if (Number.isFinite(parsed)) ts = parsed;
    }

    if (!Number.isFinite(ts)) {
      const rel = (await ageLink.textContent())?.trim() || '';
      ts = parseRelativeAge(rel, baseNow);
      expect(
        Number.isFinite(ts),
        `Could not parse timestamp for "${titleText}". title="${isoRaw || ''}", text="${rel}"`
      ).toBe(true);
    }

    // Author usually present on /newest
    await expect(meta.locator('a.hnuser').first(), 'author (hnuser) should be present').toBeVisible();

    items.push({
      id: (await row.getAttribute('id')) || '',
      title: titleText,
      ts,
    });
  }

  return items;
}

test.describe('TAKE-HOME: Newest ordering (first 100)', () => {
  test('items are sorted newest → oldest with well-formed fields', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    // Collect pages separately to allow boundary-aware checks.
    const pages = [];
    for (let pi = 0; pi < MAX_PAGES && pages.flat().length < 100; pi++) {
      const nowBase = Date.now(); // freeze baseline per PAGE
      const pageItems = await collectOnePage(page, nowBase);
      pages.push(pageItems);

      // Stop if we’ve got enough
      if (pages.flat().length >= 100) break;

      const more = page.locator('a.morelink').first();
      if (await more.count()) {
        await Promise.all([
          page.waitForLoadState('domcontentloaded'),
          more.click(),
        ]);
      } else {
        break;
      }
    }

    const items = pages.flat().slice(0, 100);
    expect(items.length, 'should have gathered some items').toBeGreaterThan(0);

    // 1) Within-page ordering (tight tolerance)
    for (let p = 0; p < pages.length; p++) {
      const list = pages[p];
      const badInPage = [];
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i], b = list[i + 1];
        const ok = a.ts + TOLERANCE_MS >= b.ts;
        if (!ok) {
          badInPage.push({ i, a: { t: a.title, ts: a.ts }, b: { t: b.title, ts: b.ts } });
        }
      }
      expect(
        badInPage.length,
        badInPage.length
          ? `Within page ${p + 1}, found ${badInPage.length} out-of-order pairs (> ${TOLERANCE_MS}ms)`
          : ''
      ).toBe(0);
    }

    // 2) At page boundaries (looser tolerance)
    const boundaryIssues = [];
    for (let p = 0; p < pages.length - 1; p++) {
      const last = pages[p][pages[p].length - 1];
      const firstNext = pages[p + 1][0];
      if (last && firstNext) {
        const ok = last.ts + BOUNDARY_MS >= firstNext.ts;
        if (!ok) {
          boundaryIssues.push({
            boundary: p + 1,
            last: { t: last.title, iso: new Date(last.ts).toISOString() },
            next: { t: firstNext.title, iso: new Date(firstNext.ts).toISOString() },
            deltaMs: firstNext.ts - last.ts
          });
        }
      }
    }

    expect(
      boundaryIssues.length,
      boundaryIssues.length
        ? `Boundary inversions (> ${BOUNDARY_MS}ms):\n` +
          boundaryIssues.map(x =>
            `  [between page ${x.boundary}→${x.boundary + 1}] "${x.last.t}" (${x.last.iso})  ->  "${x.next.t}" (${x.next.iso})  Δ=${x.deltaMs}ms`
          ).join('\n')
        : ''
    ).toBe(0);
  });
});
