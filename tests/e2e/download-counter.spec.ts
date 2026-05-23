import { test, expect } from '@playwright/test';

// These tests must run serially: the rate-limit test exhausts the quota,
// which would silently block the click-counter test if they ran in parallel.
// Within a Playwright file, tests are serial by default, but `test.describe.serial`
// makes the dependency explicit and ensures the order is enforced even if
// Playwright's defaults change or the file is run in a parallel shard.
test.describe.serial('download counter', () => {
  test('POST to non-existent slug returns 404', async ({ request }) => {
    // This test does not burn rate-limit quota because the rate-limit check
    // happens after the slug lookup in the endpoint — 404 exits early.
    const res = await request.post('/api/tunes/this-slug-does-not-exist-xyz/download', {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(404);
  });

  test('clicking copy button increments download counter', async ({ page, request, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const slug = 'toyota-supra-mk4-1994-demo04';
    const before = await request.get(`/api/tunes?limit=100`);
    const beforeJson = await before.json();
    const beforeRow = beforeJson.results.find((r: any) => r.slug === slug);
    const beforeCount = beforeRow?.download_count ?? 0;

    await page.goto(`/tune/${slug}`);

    // Wait for the actual download POST to complete rather than sleeping an
    // arbitrary 500 ms — makes the assertion deterministic.
    const downloadResponse = page.waitForResponse(
      (res) => res.url().includes('/download') && res.request().method() === 'POST'
    );
    await page.click('[data-copy-btn]');
    await downloadResponse;

    const after = await request.get(`/api/tunes?limit=100`);
    const afterJson = await after.json();
    const afterRow = afterJson.results.find((r: any) => r.slug === slug);
    expect(afterRow.download_count).toBe(beforeCount + 1);
  });

  test('download endpoint rate-limits per IP', async ({ request }) => {
    const slug = 'toyota-supra-mk4-1994-demo04';
    // 50/hour is the cap (matches lib/rate-limit window we'll set)
    // Hit it 51 times; the 51st should 429
    let last = 0;
    for (let i = 0; i < 51; i++) {
      const res = await request.post(`/api/tunes/${slug}/download`, {
        headers: { 'Content-Type': 'application/json' },
      });
      last = res.status();
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });
});
