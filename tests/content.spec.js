// @ts-check
import { test, expect } from '@playwright/test';

test('each row has id, title link, and age', async ({ page }) => {
  await page.goto('/newest');

  const rows = page.locator('tr.athing');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    await expect.soft(row).toHaveAttribute('id', /.+/);

    const titleLink = row.locator('.titleline a').first();
    await expect(titleLink).toBeVisible();
    await expect(titleLink).toHaveAttribute('href', /.+/);
    await expect(titleLink).toHaveText(/.+/);

    const metaRow = row.locator('xpath=following-sibling::tr[1]');
    const age = metaRow.locator('span.age');
    await expect(age).toBeVisible();
    await expect.soft(age).toContainText(/ago|just now|yesterday/i);
  }
});

test('IDs are unique on the page', async ({ page }) => {
  await page.goto('/newest');
  const ids = await page.locator('tr.athing').evaluateAll(nodes =>
    nodes.map(n => n.getAttribute('id') || '')
  );
  const unique = new Set(ids);
  expect(unique.size).toBe(ids.length);
});
