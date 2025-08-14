// @ts-check
import { test, expect } from '@playwright/test';

test('no console errors on newest', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/newest');
  await page.waitForLoadState('domcontentloaded');

  expect(errors, `Console errors:\n${errors.join('\n')}`).toHaveLength(0);
});
