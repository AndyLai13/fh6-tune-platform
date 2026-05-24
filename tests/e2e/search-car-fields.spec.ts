import { test, expect } from '@playwright/test';

test('search for car make returns matching tunes', async ({ page }) => {
  await page.goto('/browse?q=supra');
  // TuneCard's overlay <a> has no text content; assert the tune slug link exists AND the page shows Supra-related text
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
  await expect(page.locator('main')).toContainText(/supra|2jz/i);
});

test('search for car model returns matching tunes', async ({ page }) => {
  await page.goto('/browse?q=miata');
  await expect(page.locator('a[href="/tune/mazda-mx5-miata-na-1989-demo06"]')).toBeVisible();
  await expect(page.locator('main')).toContainText(/miata|mx-5/i);
});
