// @ts-check
import { test, expect } from '@playwright/test';

test('page loads and has site link', async ({ page }) => {
  await page.goto('/newest', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/newest/);
  await expect(page.getByRole('link', { name: 'Hacker News' })).toBeVisible();
});

test('"More" pagination changes first row', async ({ page }) => {
  await page.goto('/newest');
  const firstRow = page.locator('tr.athing').first();
  await expect(firstRow).toBeVisible();

  const firstId = await firstRow.getAttribute('id');
  await page.getByRole('link', { name: 'More' }).click();
  await page.waitForURL(/newest\?p=\d+/, { waitUntil: 'domcontentloaded' });

  const newFirstId = await page.locator('tr.athing').first().getAttribute('id');
  expect(newFirstId).not.toBe(firstId);
});
