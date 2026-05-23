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
  await expect(page.locator('a[href*="/tune/"]').first()).toBeVisible();
  // The Supra demo tune should appear
  const links = await page.locator('a[href*="/tune/"]').allTextContents();
  expect(links.some((t) => /supra|2jz/i.test(t))).toBe(true);
});

test('browse with no results shows empty state', async ({ page }) => {
  await page.goto('/browse?q=zzzzznotunesmatchthis');
  await expect(page.locator('[data-empty-state]')).toBeVisible();
});
