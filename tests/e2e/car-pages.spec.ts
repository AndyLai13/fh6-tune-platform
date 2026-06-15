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

test('/car/{slug} renders hand-written description (Layer 1) for hero car', async ({ page }) => {
  await page.goto('/car/nissan-skyline-gtr-r34-1999');
  // 手寫段落會 render 在 leading-relaxed 的 <p> 內，長度應 ≥ 60 字
  const paragraph = page.locator('main .leading-relaxed p').first();
  await expect(paragraph).toBeVisible();
  const text = (await paragraph.textContent()) ?? '';
  expect(text.length).toBeGreaterThanOrEqual(60);
  // Layer 1 不該帶 Layer 2 組裝句的標誌字串
  expect(text).not.toContain('（底盤 R34）是');
});

test('/car/{slug} renders structured assembly (Layer 2) for auto-pipeline car', async ({ page }) => {
  await page.goto('/car/ferrari-f40-1987');
  const main = page.locator('main');
  // Layer 2 組裝句固定含「（底盤」或「是 {era} 的{country}{body_style}」
  const text = await main.textContent();
  expect(text).toMatch(/（底盤 [A-Z0-9]+）|是[\s\S]+?的[一-鿿]/);
});
