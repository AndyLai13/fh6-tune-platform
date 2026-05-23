import { test, expect } from '@playwright/test';

test('user can submit a review on a tune', async ({ page }) => {
  const slug = 'mazda-mx5-miata-na-1989-demo06';
  await page.goto(`/tune/${slug}`);

  // form is visible
  await expect(page.locator('[data-review-form]')).toBeVisible();

  // pick rating 4
  await page.click('[data-rating="4"]');
  await page.fill('input[name="author_handle"]', 'e2e_tester');
  await page.fill('textarea[name="body"]', '輕量化是真理');

  // wait for turnstile dev widget to ready (test key auto-passes)
  await page.waitForTimeout(800);
  await page.click('[data-review-submit]');

  // success message appears
  await expect(page.locator('[data-review-status]')).toContainText('已送出');
});

test('rating 0 or unselected is rejected client-side', async ({ page }) => {
  const slug = 'mazda-mx5-miata-na-1989-demo06';
  await page.goto(`/tune/${slug}`);
  await page.click('[data-review-submit]');
  await expect(page.locator('[data-review-status]')).toContainText('請選擇評分');
});
