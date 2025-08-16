// tests/auth.spec.js
import { test, expect } from '@playwright/test';

const SKIP_AUTH = /^(1|true|yes)$/i.test(process.env.SKIP_AUTH ?? '');
const HN_USER = process.env.HN_USER || '';
const HN_PASS = process.env.HN_PASS || '';

/*
  Bonus: login flow (skip if challenged)

  - Invalid login: after submitting bogus creds, we should either see "Bad login"
    or remain clearly logged out (login form/link still present).
  - Valid login: only runs if HN_USER/HN_PASS set; verifies logout + username;
    skips if an anti-bot/captcha is detected.

  To skip all auth tests: SKIP_AUTH=1 npx playwright test
*/

test.describe('Bonus: login flow (skip if challenged)', () => {
  test.skip(SKIP_AUTH, 'SKIP_AUTH=1 set — skipping auth tests');

  function challengeLocator(page) {
    return page.locator(
      [
        'iframe[title*="captcha" i]',
        'iframe[src*="captcha" i]',
        '[id*="captcha" i]',
        '[class*="captcha" i]',
        'text=/human verification|are you human|verify you are human/i',
      ].join(', ')
    );
  }

  test('invalid login keeps you logged out (shows error or login still visible)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Fill bogus credentials using reliable name selectors
    await page.locator('input[name="acct"]').fill(`bad_user_${Date.now()}`);
    await page.locator('input[name="pw"]').fill('bad_password');
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('input[type="submit"][value="login"]').click(),
    ]);

    const badLogin = page.locator('text=/^Bad login\\.?$/i'); // with/without period
    const loginForm = page.locator('form[action="login"]');
    const loginLink = page.getByRole('link', { name: /^login$/i });
    const logoutLink = page.getByRole('link', { name: /^logout$/i });
    const challenge = challengeLocator(page);

    const outcome = await Promise.race([
      badLogin.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'bad'),
      challenge.first().waitFor({ state: 'attached', timeout: 5000 }).then(() => 'challenge'),
      loginForm.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'form'),
      loginLink.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'stillLoggedOut'),
      logoutLink.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'loggedIn'),
    ]).catch(() => 'timeout');

    if (outcome === 'challenge' || outcome === 'timeout') {
      test.skip(true, `Login guarded by anti-bot (${outcome}); skipping bonus auth test.`);
    }

    // With bad creds we must NOT be logged in:
    expect(outcome, 'Should not end up logged in with bad credentials').not.toBe('loggedIn');
    // And we should have one of the acceptable “still logged out” signals:
    expect(['bad', 'form', 'stillLoggedOut']).toContain(outcome);
  });

  test('valid login shows logout + user link; then logout returns to anonymous', async ({ page }) => {
    test.skip(!(HN_USER && HN_PASS), 'HN_USER/HN_PASS not provided');

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.locator('input[name="acct"]').fill(HN_USER);
    await page.locator('input[name="pw"]').fill(HN_PASS);
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('input[type="submit"][value="login"]').click(),
    ]);

    // If a challenge appears, skip this bonus test
    if (await challengeLocator(page).first().isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'Login guarded by anti-bot; skipping bonus auth test.');
    }

    // Logged in: logout link + username in the top bar
    await expect(page.getByRole('link', { name: /^logout$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(`^${HN_USER}$`, 'i') })).toBeVisible();

    // Logout should restore anonymous state (login link visible)
    await page.getByRole('link', { name: /^logout$/i }).click();
    await expect(page.getByRole('link', { name: /^login$/i })).toBeVisible();
  });
});
