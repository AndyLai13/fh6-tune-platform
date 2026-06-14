import { test, expect } from '@playwright/test';

test('/car/{slug} renders car header and tune cards for a car with tunes', async ({ page }) => {
  await page.goto('/car/toyota-supra-mk4-1994');
  await expect(page.locator('main h1')).toContainText('Toyota Supra MK4');
  await expect(page.locator('main h1')).toContainText('1994');
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]').first()).toBeVisible();
  // JSON-LD CollectionPage injected
  const ldJson = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ldJson).toContain('"@type":"CollectionPage"');
  expect(ldJson).toContain('Toyota Supra MK4');
  // Canonical points at /car/<slug>
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/car\/toyota-supra-mk4-1994$/);
});

test('/car/{slug} shows empty state for a car with no tunes', async ({ page }) => {
  await page.goto('/car/porsche-911-carrera-rs-1973');
  await expect(page.locator('main h1')).toContainText('Porsche');
  await expect(page.locator('[data-empty-state]')).toBeVisible();
  await expect(page.locator('[data-empty-state]')).toContainText('還沒有調校上線');
});

test('/car/{unknown} returns 404', async ({ page }) => {
  const response = await page.goto('/car/this-car-does-not-exist');
  expect(response?.status()).toBe(404);
});

test('/browse?car={slug} alone canonicalises to /car/{slug}', async ({ page }) => {
  await page.goto('/browse?car=toyota-supra-mk4-1994');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/car\/toyota-supra-mk4-1994$/);
});

test('/browse?car={slug}&type=touge keeps self-canonical (multiple filters)', async ({ page }) => {
  await page.goto('/browse?car=toyota-supra-mk4-1994&type=touge');
  const canonicalHref = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonicalHref).not.toMatch(/\/car\//);
});
