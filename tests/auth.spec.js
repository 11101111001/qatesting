// tests/auth.spec.js
import { test, expect } from '@playwright/test';

/**
 * Bonus: login flow (skip if challenged)
 *
 * What we do
 * - Invalid login: prove we are NOT authenticated afterward. Treat "Validation required"
 *   as a NOT-logged-in signal as well.
 * - Valid login: only runs when HN_USER/HN_PASS are set AND no validation gate appears.
 *   If the gate appears, we skip to avoid flakes.
 *
 * Notes
 * - No beforeAll with { page } — page/context are per-test fixtures.
 * - The selectors are scoped to the LOGIN form (the one whose submit value is "login").
 */

async function gotoLogin(page) {
  await page.goto('/login?goto=news', { waitUntil: 'domcontentloaded' });

  // If HN shows a validation gate, surface that to the caller.
  const gated = await page.getByText(/validation required/i).isVisible().catch(() => false);

  // Find the login form specifically (not the account creation form).
  const loginForm = page.locator('form').filter({
    has: page.locator('input[type="submit"][value="login"]'),
  });

  return { gated, loginForm };
}

test.describe('Bonus: login flow (skip if challenged)', () => {
  test('invalid login keeps you logged out (shows error or login still visible)', async ({ page }) => {
    const { gated, loginForm } = await gotoLogin(page);

    // If we are gated, that's already "not logged in" — no need to submit.
    if (!gated) {
      // Fill with obviously bad credentials (do not collide with real accounts).
      await loginForm.locator('input[name="acct"]').first().fill(`_invalid_${Date.now()}`);
      await loginForm.locator('input[name="pw"]').first().fill('badpassword123');

      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        loginForm.locator('input[type="submit"][value="login"]').first().click(),
      ]);
    }

    // Signals that we are *still anonymous*:
    const badBanner = await page.getByText(/bad login/i).isVisible().catch(() => false);
    const stillOnLogin = /\/login\b/i.test(page.url());
    const headerLoginLink = await page.getByRole('link', { name: /^login$/i }).isVisible().catch(() => false);
    const loginFormVisible = await page
      .locator('form')
      .filter({ has: page.locator('input[type="submit"][value="login"]') })
      .isVisible()
      .catch(() => false);

    const validationGate = await page.getByText(/validation required/i).isVisible().catch(() => false);

    const anonymous =
      badBanner ||
      stillOnLogin ||
      headerLoginLink ||
      loginFormVisible ||
      validationGate;

    if (!anonymous) {
      const snippet = (await page.locator('body').innerText().catch(() => '') || '').slice(0, 200);
      throw new Error(`Should see "Bad login", or still be on the login form, or see the "login" link.\nurl=${page.url()}\nsnippet="${snippet}"`);
    }
  });

  test('valid login shows logout + user link; then logout returns to anonymous', async ({ page }) => {
    // Allow skipping via env var or missing creds.
    const SKIP = process.env.SKIP_AUTH === '1' || process.env.HN_SKIP_AUTH === '1';
    test.skip(SKIP, 'Auth is disabled via SKIP_AUTH/HN_SKIP_AUTH');

    const user = process.env.HN_USER;
    const pass = process.env.HN_PASS;
    test.skip(!user || !pass, 'HN_USER/HN_PASS not set');

    const { gated, loginForm } = await gotoLogin(page);
    test.skip(gated, 'Validation gate present — skipping auth test to avoid flakiness');

    // Fill and submit
    await loginForm.locator('input[name="acct"]').first().fill(user);
    await loginForm.locator('input[name="pw"]').first().fill(pass);
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      loginForm.locator('input[type="submit"][value="login"]').first().click(),
    ]);

    // Prove we are logged in
    await expect(page.getByRole('link', { name: /^logout$/i })).toBeVisible();

    // Optional: username appears in top bar when logged in (link to /user?id=<name>)
    await expect(page.getByRole('link', { name: new RegExp(`^${user}$`, 'i') })).toBeVisible();

    // Log out and ensure we return to anonymous
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.getByRole('link', { name: /^logout$/i }).click(),
    ]);
    await expect(page.getByRole('link', { name: /^login$/i })).toBeVisible();
  });
});
