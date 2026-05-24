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

test('/sitemap.xml uses /tracks/ (plural) not /track/', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  // No singular /track/ URLs
  expect(body).not.toMatch(/\/track\/[a-z]/);
  // Plural /tracks/ URLs present
  expect(body).toMatch(/\/tracks\/[a-z]/);
  // /tracks listing URL present
  expect(body).toContain('/tracks</loc>');
});

test('/sitemap.xml includes tuner profile URLs', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  const body = await res.text();
  // At least one seeded tuner handle (two_j_zee is the 2JZ Supra author)
  expect(body).toContain('/tuner/two_j_zee');
});
