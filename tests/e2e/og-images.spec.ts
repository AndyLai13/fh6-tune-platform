import { test, expect } from '@playwright/test';

test('GET /og/tune/[slug].svg returns SVG with tune metadata', async ({ request }) => {
  const res = await request.get('/og/tune/toyota-supra-mk4-1994-demo04.svg');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/image\/svg\+xml/);
  const body = await res.text();
  expect(body).toMatch(/^<svg/);
  expect(body).toContain('Supra');
  expect(body).toContain('touge');
});

test('GET /og/tune/unknown-slug.svg returns 404', async ({ request }) => {
  const res = await request.get('/og/tune/this-slug-does-not-exist.svg');
  expect(res.status()).toBe(404);
});

test('GET /og-default.svg returns the default OG image', async ({ request }) => {
  const res = await request.get('/og-default.svg');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/image\/svg\+xml/);
  const body = await res.text();
  expect(body).toContain('touge');
});
