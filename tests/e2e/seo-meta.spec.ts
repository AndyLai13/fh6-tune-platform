import { test, expect } from '@playwright/test';

test('homepage has canonical + og:* + twitter:card meta tags', async ({ page }) => {
  await page.goto('/');
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', /^https?:\/\/[^/]+\/$/);

  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /touge\.gg/);
  await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
});

test('tune detail passes custom ogImage and canonical', async ({ page }) => {
  await page.goto('/tune/toyota-supra-mk4-1994-demo04');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/tune\/toyota-supra-mk4-1994-demo04$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/tune\/toyota-supra-mk4-1994-demo04\.svg$/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');

  // Description should reflect the tune (either real description prefix or the type/PI fallback)
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', /\S/);
});

test('Plausible script absent when PLAUSIBLE_DOMAIN unset (dev default)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('script[data-domain]')).toHaveCount(0);
});
