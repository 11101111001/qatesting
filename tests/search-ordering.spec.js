// tests/search-ordering.spec.js
import { test, expect } from '@playwright/test';

const ALGOLIA = 'https://hn.algolia.com/';

// --- helpers ----------------------------------------------------------------

function parseRelativeAgeToMs(text, nowRef) {
  const s = (text || '').trim().toLowerCase();
  const now = Number.isFinite(nowRef) ? nowRef : Date.now();
  if (!s) return NaN;
  if (/\bjust now\b/.test(s)) return now;
  if (/\byesterday\b/.test(s)) return now - 24 * 60 * 60 * 1000;

  const m = s.match(/(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago/);
  if (!m) return NaN;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const ms = {
    second: 1_000, seconds: 1_000,
    minute: 60_000, minutes: 60_000,
    hour: 3_600_000, hours: 3_600_000,
    day: 86_400_000, days: 86_400_000,
    week: 7 * 86_400_000, weeks: 7 * 86_400_000,
    month: 30 * 86_400_000, months: 30 * 86_400_000,
    year: 365 * 86_400_000, years: 365 * 86_400_000,
  }[unit];
  return ms ? now - n * ms : NaN;
}

// Return the list of story cards (ensures the page is ready)
async function getStoryCards(page) {
  const container = page.locator('div.SearchResults_container');
  await expect(container, 'results container should be visible').toBeVisible({ timeout: 15000 });

  const cards = container.locator('article.Story');
  await expect(cards.first(), 'first story card should be visible').toBeVisible({ timeout: 15000 });
  return cards;
}

// Extract a timestamp (ms) from one story card
async function tsFromStoryCard(card, nowRef) {
  const timeLink = card
    .locator('a[href*="news.ycombinator.com/item?id="]')
    .filter({ hasText: /\b(ago|yesterday)\b/i })
    .first();

  if (await timeLink.count()) {
    await expect(timeLink, 'time/age link visible').toBeVisible();
    const txt = (await timeLink.textContent() || '').trim();

    // Prefer relative parsing with a fixed reference "now"
    const rel = parseRelativeAgeToMs(txt, nowRef);
    if (Number.isFinite(rel)) return rel;

    // Fallback: absolute date string in the text
    const abs = Date.parse(txt);
    if (Number.isFinite(abs)) return abs;
  }

  // Last fallback: any text with "ago/yesterday" in the card
  const any = await card.getByText(/\b(ago|yesterday)\b/i).first().textContent().catch(() => null);
  if (any) {
    const rel = parseRelativeAgeToMs(any, nowRef);
    if (Number.isFinite(rel)) return rel;
    const abs = Date.parse(any);
    if (Number.isFinite(abs)) return abs;
  }

  return NaN;
}

// Assert timestamps are non-increasing (newest → oldest)
function expectDescending(ts, ctx = 'timestamps should be non-increasing', toleranceMs = 1500) {
  for (let i = 0; i < ts.length - 1; i++) {
    const a = ts[i], b = ts[i + 1];
    const ok = a >= b || (b - a) <= toleranceMs; // allow near-ties
    expect(
      ok,
      `${ctx}; break at index ${i}: ${new Date(a).toISOString()} -> ${new Date(b).toISOString()} (Δ=${b - a}ms)`
    ).toBe(true);
  }
}

// --- tests ------------------------------------------------------------------

test.describe('Algolia Search: stories/results ordering', () => {
  test('“apple” sorted by Date (all time) is descending by time', async ({ page }) => {
    await page.goto(
      `${ALGOLIA}?q=apple&type=story&sort=byDate&dateRange=all`,
      { waitUntil: 'domcontentloaded' }
    );
    await expect(page).toHaveURL(/[?&](q|query)=apple.*type=story.*sort=byDate.*dateRange=all/i);

    const cards = await getStoryCards(page);
    const take = Math.min(await cards.count(), 25);
    expect(take, 'should have at least a few results').toBeGreaterThan(3);

    const ts = [];
    for (let i = 0; i < take; i++) {
      const card = cards.nth(i);
      const t = await tsFromStoryCard(card);
      expect(Number.isFinite(t), `result[${i}] should expose a valid timestamp`).toBe(true);
      ts.push(t);
    }
    expectDescending(ts, 'search(byDate, all time) ordering');
  });

  test('“apple” Past Week (by date) returns only last 7d and is descending', async ({ page }) => {
    await page.goto(
      `${ALGOLIA}?q=apple&type=story&sort=byDate&dateRange=pastWeek`,
      { waitUntil: 'domcontentloaded' }
    );
    await expect(page).toHaveURL(/[?&](q|query)=apple.*type=story.*sort=byDate.*dateRange=pastWeek/i);

    const cards = await getStoryCards(page);
    const take = Math.min(await cards.count(), 25);
    expect(take, 'should have at least a few results').toBeGreaterThan(3);

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const slack = 2 * 60 * 60 * 1000; // 2h tolerance

    const ts = [];
    for (let i = 0; i < take; i++) {
      const card = cards.nth(i);
      const t = await tsFromStoryCard(card);
      expect(Number.isFinite(t), `result[${i}] should expose a valid timestamp`).toBe(true);
      expect(now - t <= weekMs + slack, `result[${i}] should be within the last week (got ${new Date(t).toISOString()})`).toBe(true);
      ts.push(t);
    }
    expectDescending(ts, 'search(byDate, pastWeek) ordering');
  });
});
