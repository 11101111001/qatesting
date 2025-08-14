// @ts-check
import { test, expect } from '@playwright/test';

function parseRelAge(text, nowMs = Date.now()) {
  const s = String(text).trim().toLowerCase();
  if (s === 'just now') return nowMs;
  if (s === 'yesterday') return nowMs - 86400000;
  const m = s.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  const unitMs = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 7 * 864e5, month: 30 * 864e5, year: 365 * 864e5 }[m[2]];
  return nowMs - n * unitMs;
}

test('timestamps are non-increasing across first two pages', async ({ page }) => {
  await page.goto('/newest', { waitUntil: 'domcontentloaded' });

  const collectPage = async () => {
    const rows = page.locator('tr.athing');
    const count = await rows.count();
    const stamps = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const metaRow = row.locator('xpath=following-sibling::tr[1]');
      const age = metaRow.locator('span.age');
      const iso = await age.getAttribute('title');
      const ts = iso ? new Date(iso).getTime() : parseRelAge(await age.innerText());
      stamps.push(ts);
    }
    return stamps;
  };

  const page1 = await collectPage();
  await Promise.all([
    page.waitForURL(/newest\?p=\d+/, { waitUntil: 'domcontentloaded' }),
    page.getByRole('link', { name: 'More' }).click()
  ]);
  const page2 = await collectPage();

  const all = page1.concat(page2);
  for (let i = 1; i < all.length; i++) {
    expect(all[i]).toBeLessThanOrEqual(all[i - 1]);
  }
});
