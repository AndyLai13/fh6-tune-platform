import { test, expect } from '@playwright/test';

test('typing in header search and submitting goes to /browse?q=', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-search-input]', 'supra');
  await page.press('[data-search-input]', 'Enter');
  await page.waitForURL(/\/browse\?q=supra/);
});

test('browse with ?q= shows search results', async ({ page }) => {
  // Search by "2jz" — the tune name "2JZ 1500 Snake" is indexed in FTS
  await page.goto('/browse?q=2jz');
  await expect(page.locator('h1').first()).toContainText('搜尋');
  // TuneCard's overlay <a> is empty; assert via main-content text + a specific tune link
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
  await expect(page.locator('main')).toContainText(/supra|2jz/i);
});

test('browse with no results shows empty state', async ({ page }) => {
  await page.goto('/browse?q=zzzzznotunesmatchthis');
  await expect(page.locator('[data-empty-state]')).toBeVisible();
});
