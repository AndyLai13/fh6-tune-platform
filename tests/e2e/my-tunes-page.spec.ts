import { test, expect } from '@playwright/test';

test('my page shows seeded localStorage entries', async ({ page }) => {
  await page.goto('/my');
  await page.evaluate(() => {
    localStorage.setItem('mytunes', JSON.stringify([
      { slug: 'toyota-supra-mk4-1994-demo04', editUrl: '/edit/toyota-supra-mk4-1994-demo04', savedAt: Date.now() - 86400000 },
      { slug: 'mazda-mx5-miata-na-1989-demo06', editUrl: '/edit/mazda-mx5-miata-na-1989-demo06', savedAt: Date.now() }
    ]));
  });
  await page.reload();
  await expect(page.locator('[data-my-tune]')).toHaveCount(2);
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
  await expect(page.locator('a[href="/edit/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
});

test('my page shows empty state when localStorage is empty', async ({ page }) => {
  await page.goto('/my');
  await page.evaluate(() => localStorage.removeItem('mytunes'));
  await page.reload();
  await expect(page.locator('[data-my-empty]')).toBeVisible();
});
