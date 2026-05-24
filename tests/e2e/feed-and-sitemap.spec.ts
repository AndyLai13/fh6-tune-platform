import { test, expect } from '@playwright/test';

test('/feed.xml returns RSS 2.0 with seeded tune entries', async ({ request }) => {
  const res = await request.get('/feed.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/xml/);

  const body = await res.text();
  expect(body).toContain('<rss version="2.0">');
  expect(body).toContain('<channel>');
  expect(body).toContain('<title>touge.gg</title>');

  // At least one seeded tune appears as an <item>
  expect(body).toContain('<item>');
  expect(body).toContain('toyota-supra-mk4-1994-demo04');
});
