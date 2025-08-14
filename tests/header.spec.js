// @ts-check
import { test, expect } from '@playwright/test';

test('responds over HTTPS with sane content-type', async ({ request }) => {
  const resp = await request.get('https://news.ycombinator.com/newest');
  expect(resp.ok()).toBeTruthy();

  const ct = resp.headers()['content-type'] || '';
  expect(ct).toMatch(/text\/html/i);

  const cache = resp.headers()['cache-control'];
  expect(cache).toBeDefined();
});

test('robots.txt exists', async ({ request }) => {
  const resp = await request.get('https://news.ycombinator.com/robots.txt');
  expect(resp.status()).toBe(200);
  const text = await resp.text();
  expect(text.length).toBeGreaterThan(0);
});
