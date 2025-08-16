// tests/content.spec.js
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/content.spec.js

 What this runs
 - Spot-checks structural integrity of /newest content.

 Key assertions
 - Page has ≥ 1 story row.
 - Each row exposes:
   • id attribute (post id)
   • .titleline a (visible, has href and non-empty text)
   • the immediate following meta row contains span.age (visible, contains a
     relative label like “X minutes ago / yesterday / just now”)
 - All row ids on the page are unique.

 How to run (single file)
   npx playwright test tests/content.spec.js
 ----------------------------------------------------------------------------- */

test.describe('Core: Newest table details', () => {
  test('table + rows + meta content are well-formed', async ({ page }) => {
    await page.goto('/newest', { waitUntil: 'domcontentloaded' });

    // Wait up to 15s for any story rows to appear (HN sometimes throttles).
    await expect(page.locator('tr.athing').first()).toBeVisible({ timeout: 15000 });

    // Prefer asserting the table when present; otherwise assert rows exist.
    const table = page.locator('table.itemlist');
    const tableCount = await table.count();
    if (tableCount > 0) {
      await expect(table.first(), 'Item list table should be visible').toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'table.itemlist not found; proceeding with row-level assertions (likely transient throttling).'
      });
    }

    // Rows
    const rows = page.locator('tr.athing');
    const rowCount = await rows.count();
    expect(rowCount, 'Should render at least one story row').toBeGreaterThan(0);

    // Validate the first few rows have expected structure
    const sample = Math.min(rowCount, 10);
    for (let i = 0; i < sample; i++) {
      const row = rows.nth(i);
      await expect(row, `Row #${i + 1} should have id`).toHaveAttribute('id', /.+/);

      const titleLink = row.locator('.titleline a').first();
      await expect(titleLink, `Row #${i + 1} title link visible`).toBeVisible();
      await expect(titleLink, `Row #${i + 1} title link href`).toHaveAttribute('href', /.+/);
      await expect(titleLink, `Row #${i + 1} title text`).toHaveText(/.+/);

      const metaRow = row.locator('xpath=following-sibling::tr[1]');
      const age = metaRow.locator('span.age');
      await expect(age, `Row #${i + 1} age visible`).toBeVisible();
      await expect.soft(age, `Row #${i + 1} age text`).toContainText(/ago|just now|yesterday/i);
    }
  });

  test('IDs are unique on the page', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const ids = await page.locator('tr.athing').evaluateAll(nodes =>
      nodes.map(n => n.getAttribute('id') || '')
    );
    const unique = new Set(ids);
    expect(unique.size, 'Row IDs must be unique').toBe(ids.length);
  });
});
