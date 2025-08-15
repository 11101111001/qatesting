// @ts-check
import { test, expect } from '@playwright/test';

const HN_USER = process.env.HN_USER || '';
const HN_PASS = process.env.HN_PASS || '';

test('submit redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/submit', { waitUntil: 'domcontentloaded' });
  // Unauthed users get sent to /login?goto=submit
  await expect(page).toHaveURL(/\/login\?goto=submit/);
  // Basic login form presence
  await expect(page.locator('input[name="acct"]')).toBeVisible();
  await expect(page.locator('input[name="pw"]')).toBeVisible();
});

test.skip(!HN_USER || !HN_PASS, 'skipping submit form check without creds');
test('submit form is visible when authenticated', async ({ page }) => {
  // Login quickly
  await page.goto('/login?goto=news', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="acct"]').fill(HN_USER);
  await page.locator('input[name="pw"]').fill(HN_PASS);
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.locator('input[type="submit"][value="login"]').click(),
  ]);

  // Now go to /submit
  await page.goto('/submit', { waitUntil: 'domcontentloaded' });

  // Form fields: title/url/text exist (don’t actually submit!)
  await expect(page.locator('input[name="title"]')).toBeVisible();
  // url or text can be used (self-posts), assert at least one is present
  await expect(page.locator('input[name="url"], textarea[name="text"]')).toBeVisible();
});
