// @ts-check
import { test, expect } from '@playwright/test';

test('story links respond (HEAD/GET sample)', async ({ page, request }) => {
  await page.goto('/newest', { waitUntil: 'domcontentloaded' });

  const links = await page.locator('.titleline a').evaluateAll(anchors =>
    anchors.map(a => a.getAttribute('href') || '').filter(Boolean)
  );

  const sample = links.slice(0, 25); // polite sampling

  for (const url of sample) {
    /** @type {import('@playwright/test').APIResponse | null} */
    let resp = null;
    try {
      const head = await request.head(url);
      if (head.ok()) {
        resp = head;
      } else {
        const getResp = await request.get(url);
        resp = getResp.ok() ? getResp : head;
      }
    } catch {
      resp = null;
    }

    if (!resp) {
      throw new Error(`No response from ${url}`);
    }

    if (resp.status() === 403) {
      console.warn(`Skipping 403 for ${url}`);
      continue;
    }

    expect(resp.status(), `Bad status from ${url}`).toBeLessThan(400);
  }
});
