import { test, expect } from '@playwright/test';

// iPhone SE viewport only (Chromium-rendered) — the project's playwright config runs Chromium only,
// so we avoid `devices['iPhone SE']` which requires WebKit.
test.use({ viewport: { width: 375, height: 667 } });

test('homepage h1 fits within viewport on mobile', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('main h1').first();
  const box = await h1.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(375);
  const docOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(docOverflow).toBeLessThanOrEqual(0);
});

test('browse page stacks tune cards single column on mobile', async ({ page }) => {
  await page.goto('/browse');
  const cards = page.locator('a[href*="/tune/"]');
  await cards.first().waitFor();
  const b0 = await cards.nth(0).boundingBox();
  const b1 = await cards.nth(1).boundingBox();
  if (b0 && b1) expect(b0.x).toBe(b1.x);
});

test('upload form fields stack on mobile', async ({ page }) => {
  await page.goto('/upload');
  const nameBox = await page.locator('input[name="name"]').boundingBox();
  const codeBox = await page.locator('input[name="share_code"]').boundingBox();
  if (nameBox && codeBox) {
    expect(codeBox.y).toBeGreaterThan(nameBox.y + nameBox.height - 5);
  }
});

test('tune detail share box stacks below header on mobile', async ({ page }) => {
  await page.goto('/tune/toyota-supra-mk4-1994-demo04');
  const h1 = await page.locator('main h1').boundingBox();
  const shareBox = await page.locator('[data-share-box]').boundingBox();
  if (h1 && shareBox) expect(shareBox.y).toBeGreaterThan(h1.y + h1.height - 5);
});
