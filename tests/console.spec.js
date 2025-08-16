// @ts-check
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/console.spec.js

 What this runs
 - Ensures /newest does not emit browser console errors during initial load.

 Key assertions
 - Collects all console events of type “error” after DOMContentLoaded and
   asserts the list is empty.

 How to run (single file)
   npx playwright test tests/console.spec.js

 Notes
 - Keeps noise out of smoke runs and helps catch unexpected JS regressions.
 ----------------------------------------------------------------------------- */

test('no console errors on newest', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/newest');
  await page.waitForLoadState('domcontentloaded');

  expect(errors, `Console errors:\n${errors.join('\n')}`).toHaveLength(0);
});
