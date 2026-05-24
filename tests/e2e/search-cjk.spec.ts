import { test, expect } from '@playwright/test';

test('CJK chars in search query do not crash and return results when indexed text matches', async ({ page }) => {
  // The seed Bayshore Hunter tune's description contains '灣岸'. After unicode61 + CJK-friendly
  // sanitizer, /browse?q=灣岸 should return at least one tune.
  await page.goto('/browse?q=' + encodeURIComponent('灣岸'));
  // h1 reflects the search query
  await expect(page.locator('main h1')).toContainText('搜尋');
  // The Bayshore Hunter tune should appear (its description contains 灣岸)
  await expect(page.locator('a[href="/tune/nissan-skyline-gtr-r34-1999-demo03"]')).toBeVisible({ timeout: 3000 });
});
