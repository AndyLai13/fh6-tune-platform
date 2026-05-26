import { test, expect } from '@playwright/test';

const TUNE_SLUG = process.env.SMOKE_TUNE_SLUG ?? 'toyota-supra-mk4-1994-demo04';

test('homepage loads', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/touge\.gg/i);
});

test('/browse loads with tunes', async ({ page }) => {
  const res = await page.goto('/browse');
  expect(res?.status()).toBe(200);
  await expect(page.locator('a[href^="/tune/"]').first()).toBeVisible();
});

test('/sitemap.xml is valid and includes /tracks/', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/xml/);
  const body = await res.text();
  expect(body).toContain('<urlset');
  expect(body).toMatch(/\/tracks\//);
});

test('/feed.xml is valid RSS 2.0', async ({ request }) => {
  const res = await request.get('/feed.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('<rss');
  expect(body).toContain('<channel>');
});

test('tune detail loads with OG image meta and JSON-LD', async ({ page }) => {
  const res = await page.goto(`/tune/${TUNE_SLUG}`);
  expect(res?.status()).toBe(200);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`/og/tune/${TUNE_SLUG}\\.svg$`));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/tune/${TUNE_SLUG}$`));
});

test('OG image SVG endpoint serves valid SVG', async ({ request }) => {
  const res = await request.get(`/og/tune/${TUNE_SLUG}.svg`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/image\/svg\+xml/);
  const body = await res.text();
  expect(body).toMatch(/^<svg/);
});

test('/privacy and /terms are reachable', async ({ request }) => {
  const p = await request.get('/privacy');
  const t = await request.get('/terms');
  expect(p.status()).toBe(200);
  expect(t.status()).toBe(200);
});

test('robots.txt advertises sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/Sitemap:\s*https?:\/\/[^\s]+sitemap\.xml/);
});
