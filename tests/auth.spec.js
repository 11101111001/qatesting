// tests/auth.spec.js
import { test, expect } from '@playwright/test';

/**
 * Simple, validation-safe auth checks.
 * - Does not assert successful login (HN often requires manual validation).
 * - Verifies form presence, fill behavior, and safe handling of bad creds.
 *
 * To skip by default:
 *   SKIP_AUTH=1 npx playwright test
 */

const skipAuth = process.env.SKIP_AUTH === '1';

test.describe('Bonus: login flow (skip if challenged)', () => {
  test.skip(skipAuth, 'Auth tests skipped by SKIP_AUTH=1');

  test('login form renders and accepts input', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/login?goto=news', { waitUntil: 'domcontentloaded' });

    // Scope to the LOGIN (not CREATE) form by submit value
    const loginForm = page.locator('form').filter({
      has: page.locator('input[type="submit"][value="login"]'),
    });

    await expect(loginForm, 'Login form should be visible').toBeVisible();

    const user = loginForm.locator('input[name="acct"]');
    const pass = loginForm.locator('input[name="pw"]');

    await expect(user, 'Username field visible').toBeVisible();
    await expect(pass, 'Password field visible').toBeVisible();

    await user.fill('dummy-user');
    await pass.fill('dummy-pass');
    await expect(user, 'Username should contain typed text').toHaveValue('dummy-user');
  });

  test('invalid login keeps you logged out (shows error banner or remains on form)', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/login?goto=news', { waitUntil: 'domcontentloaded' });

    const loginForm = page.locator('form').filter({
      has: page.locator('input[type="submit"][value="login"]'),
    });

    await expect(loginForm, 'Login form visible before submit').toBeVisible();
    await loginForm.locator('input[name="acct"]').fill('totally-bad-user');
    await loginForm.locator('input[name="pw"]').fill('totally-bad-pass');

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      loginForm.locator('input[type="submit"][value="login"]').click(),
    ]);

    // Hard "not logged in" checks: no logout link
    const loggedOut = !(await page.getByRole('link', { name: /^logout$/i }).isVisible().catch(() => false));
    await expect(loggedOut, 'Should not show a "logout" link after bad login').toBe(true);

    // Accept either banner or remaining on login page
    const badLoginBanner = page.getByText(/bad login/i);
    const validationBanner = page.getByText(/validation required/i);
    const stillOnForm = loginForm.first();

    const anySignal =
      (await badLoginBanner.isVisible().catch(() => false)) ||
      (await validationBanner.isVisible().catch(() => false)) ||
      (await stillOnForm.isVisible().catch(() => false));

    await expect(anySignal, 'Should show "Bad login", or still be on the login form, or see a validation banner').toBe(true);
  });
});
