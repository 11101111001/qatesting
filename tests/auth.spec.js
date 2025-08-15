// @ts-check
import { test, expect } from '@playwright/test';

// HN creds are optional: set HN_USER and HN_PASS in your env to run the "valid" path.
// In CI (GitHub Actions), store them as encrypted secrets.
const HN_USER = process.env.HN_USER || '';
const HN_PASS = process.env.HN_PASS || '';

test.describe('login flow', () => {
  test('invalid login shows error/does not log in', async ({ page }) => {
    await page.goto('/login?goto=news', { waitUntil: 'domcontentloaded' });

    // Inputs are named "acct" and "pw"
    await page.locator('input[name="acct"]').fill('definitely-not-a-real-user');
    await page.locator('input[name="pw"]').fill('wrong-password');
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('input[type="submit"][value="login"]').click(),
    ]);

    // Stay on /login or get sent back there; logout link should NOT be present
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('link', { name: 'logout' })).toHaveCount(0);
  });

  test.skip(!HN_USER || !HN_PASS, 'valid login skipped (provide HN_USER & HN_PASS env vars to enable)');
  test('valid login succeeds and logout works', async ({ page }) => {
    await page.goto('/login?goto=news', { waitUntil: 'domcontentloaded' });

    await page.locator('input[name="acct"]').fill(HN_USER);
    await page.locator('input[name="pw"]').fill(HN_PASS);
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('input[type="submit"][value="login"]').click(),
    ]);

    // After login, a "logout" link should be visible in topbar
    await expect(page.getByRole('link', { name: 'logout' })).toBeVisible();

    // Log out (don’t leave sessions around in CI)
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.getByRole('link', { name: 'logout' }).click(),
    ]);

    // After logout, we should no longer see the logout link
    await expect(page.getByRole('link', { name: 'logout' })).toHaveCount(0);
  });
});
