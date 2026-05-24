import { test, expect } from '@playwright/test';

test('/compare with two valid slugs renders both tune headers', async ({ page }) => {
  await page.goto('/compare?a=toyota-supra-mk4-1994-demo04&b=mazda-mx5-miata-na-1989-demo06');

  // Both tune names visible
  await expect(page.locator('main')).toContainText('2JZ 1500 Snake');
  await expect(page.locator('main')).toContainText('Lightweight Touge');

  // Both share codes visible
  await expect(page.locator('main')).toContainText('707-202-815');
  await expect(page.locator('main')).toContainText('128-444-657');

  // Both TuneValuesGrid render (2 instances of '輪胎' section title)
  const tireHeadings = page.locator('text=輪胎');
  expect(await tireHeadings.count()).toBeGreaterThanOrEqual(2);
});

test('/compare with missing slug shows hint', async ({ page }) => {
  await page.goto('/compare');
  await expect(page.locator('[data-compare-hint]')).toBeVisible();
});

test('/compare with one invalid slug shows error inline', async ({ page }) => {
  await page.goto('/compare?a=toyota-supra-mk4-1994-demo04&b=does-not-exist-zzz');
  await expect(page.locator('[data-compare-missing]')).toBeVisible();
});
