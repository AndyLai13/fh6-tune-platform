import { test, expect } from '@playwright/test';

// Depends on the wusyong-pack-7400.sql output being applied to local D1.
const SHARE_CODE_ONLY_SLUG = 'nissan-silvia-ks-1989-wusyong-c-touge';
const FULL_VALUES_SLUG = 'toyota-supra-mk4-1994-demo04';

test('share-code-only tune detail page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  const response = await page.goto(`/tune/${SHARE_CODE_ONLY_SLUG}`);
  expect(response?.status()).toBe(200);

  // ShareCodeBox renders the share code with data-share-box wrapper
  await expect(page.locator('[data-share-box]').first()).toBeVisible();

  // TuneValuesGrid section is not rendered
  await expect(page.locator('text=全部數值')).toHaveCount(0);

  // share-code-only banner is rendered
  await expect(page.locator('[data-share-code-only-banner]')).toBeVisible();

  // source link is visible inside the banner
  const sourceLink = page.locator('[data-share-code-only-banner] a[href*="forum.gamer.com.tw"]');
  await expect(sourceLink).toBeVisible();

  // give the page a moment for any deferred scripts to throw if they're going to
  await page.waitForLoadState('domcontentloaded');
  expect(errors).toEqual([]);
});

test('regular tune detail page still renders TuneValuesGrid', async ({ page }) => {
  await page.goto(`/tune/${FULL_VALUES_SLUG}`);
  await expect(page.locator('text=全部數值')).toBeVisible();
  // share-code-only banner should NOT be present
  await expect(page.locator('[data-share-code-only-banner]')).toHaveCount(0);
});
