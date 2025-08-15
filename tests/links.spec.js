// @ts-check
import { test, expect } from '@playwright/test';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

test('story links respond (HEAD/GET sample)', async ({ page, request }) => {
  await page.goto('/newest', { waitUntil: 'domcontentloaded' });

  const hrefs = await page.locator('.titleline a').evaluateAll(anchors =>
    anchors.map(a => a.getAttribute('href') || '').filter(Boolean)
  );

  // Small sample to be polite & fast
  const sample = hrefs.slice(0, 20);

  const toAbsolute = (u) =>
    /^https?:\/\//i.test(u) ? u : new URL(u, 'https://news.ycombinator.com/').href;

  for (const raw of sample) {
    const url = toAbsolute(raw);
    /** @type {import('@playwright/test').APIResponse | null} */
    let resp = null;

    const opts = { timeout: 8000, headers: { 'user-agent': UA } };

    try {
      // Try HEAD first
      const head = await request.head(url, opts);
      if (head && head.ok()) {
        resp = head;
      } else {
        // Fallback to GET
        const getResp = await request.get(url, opts);
        resp = getResp ?? head;
      }
    } catch {
      resp = null;
    }

    if (!resp) {
      console.warn(`Skipping unreachable ${url}`);
      continue;
    }

    // Some sites block bots: skip these so the suite isn’t flaky
    if (resp.status() === 403 || resp.status() === 429) {
      console.warn(`Skipping blocked ${url} (status ${resp.status()})`);
      continue;
    }

    // Accept 2xx/3xx; fail on 4xx/5xx except those we skipped above
    expect(resp.status(), `Bad status from ${url}`).toBeLessThan(400);
  }
});
