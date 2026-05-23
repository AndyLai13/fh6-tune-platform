# Sprint 1: Core Loop Completion (MVP Launch-Blockers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the 5 launch-blockers identified in the 2026-05-24 audit — review form, download counter, search box, 404 page, and mobile responsive pass — so the FH6 tune platform's core loop (upload → browse → rate → download) is fully functional.

**Architecture:** All UI work rides existing backend code. One new endpoint is needed (`POST /api/tunes/[id]/download`). Other features extend existing pages/components. We follow the existing patterns: Astro server endpoints under `src/pages/api/`, components under `src/components/`, KV-based rate limiting, IP daily-salt hashing, Cloudflare Turnstile for human verification. Tests match existing styles: Vitest for unit, Playwright for e2e.

**Tech Stack:** Astro 6 (server output) · Cloudflare Pages · D1 (SQLite) · KV (rate limit / counters) · Tailwind v4 · bcryptjs · Vitest · Playwright.

---

## File Structure Overview

**New files:**
- `src/pages/api/tunes/[id]/download.ts` — POST endpoint, increments `tunes.download_count`
- `src/components/ReviewForm.astro` — star rating + body submission form
- `src/pages/404.astro` — Not Found page

**Modified files:**
- `src/components/ShareCodeBox.astro` — fire-and-forget POST to `/api/tunes/[slug]/download` on copy click
- `src/pages/tune/[slug].astro` — embed `<ReviewForm>` between reviews and structured data
- `src/components/Header.astro` — add search input that submits to `/browse?q=...`
- `src/pages/browse.astro` — handle `?q=` param (calls `/api/search`); also add result-empty state
- `src/pages/index.astro`, `browse.astro`, `tune/[slug].astro`, `upload.astro`, `edit/[slug].astro` — add Tailwind `sm:`/`md:` breakpoints for mobile

**New test files:**
- `tests/e2e/review-flow.spec.ts`
- `tests/e2e/download-counter.spec.ts`
- `tests/e2e/search-flow.spec.ts`
- `tests/e2e/404-page.spec.ts`
- `tests/e2e/mobile-layout.spec.ts`

**Task order rationale:** Task 1 (download counter) is smallest and builds confidence on the API+UI loop. Task 2 (404) is isolated. Task 3 (review form) is the most user-facing. Task 4 (search) touches multiple files. Task 5 (mobile pass) is a global sweep — do last so the breakpoint additions don't churn against earlier task changes.

---

### Task 1: Download counter — API endpoint + ShareCodeBox click handler

**Files:**
- Create: `src/pages/api/tunes/[id]/download.ts`
- Modify: `src/components/ShareCodeBox.astro`
- Test: `tests/e2e/download-counter.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/download-counter.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('clicking copy button increments download counter', async ({ page, request }) => {
  const slug = 'toyota-supra-mk4-1994-demo04';
  const before = await request.get(`/api/tunes?limit=100`);
  const beforeJson = await before.json();
  const beforeRow = beforeJson.results.find((r: any) => r.slug === slug);
  const beforeCount = beforeRow?.download_count ?? 0;

  await page.goto(`/tune/${slug}`);
  await page.click('[data-copy-btn]');

  // wait for the fire-and-forget request to land
  await page.waitForTimeout(500);

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
    const res = await request.post(`/api/tunes/${slug}/download`);
    last = res.status();
    if (last === 429) break;
  }
  expect(last).toBe(429);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx playwright test tests/e2e/download-counter.spec.ts
```

Expected: both tests FAIL — first because the click does nothing, second because the endpoint returns 404 (route doesn't exist yet).

- [ ] **Step 3: Create the API endpoint**

Create `src/pages/api/tunes/[id]/download.ts`:

```typescript
import type { APIRoute } from 'astro';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { checkRateLimit } from '~/lib/rate-limit';
import { getTuneBySlug, incrementDownload } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ params, clientAddress }) => {
  const tune = await getTuneBySlug(env.DB, params.id!);
  if (!tune) return new Response('not_found', { status: 404 });

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'download', 50, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  await incrementDownload(env.DB, tune.id);
  return Response.json({ ok: true });
};
```

- [ ] **Step 4: Wire the copy button to POST the endpoint**

In `src/components/ShareCodeBox.astro`, replace the existing `<script>` block (lines 12-24) with:

```html
<script>
  document.querySelectorAll<HTMLElement>('[data-share-box]').forEach((box) => {
    const btn = box.querySelector<HTMLButtonElement>('[data-copy-btn]');
    const codeEl = box.querySelector<HTMLElement>('[data-code]');
    const slug = box.dataset.tuneSlug;
    btn?.addEventListener('click', async () => {
      if (!codeEl) return;
      await navigator.clipboard.writeText(codeEl.innerText.trim());
      const original = btn.innerText;
      btn.innerText = '✓ 已複製';
      setTimeout(() => { btn.innerText = original; }, 1500);
      // fire-and-forget — don't block UX on counter increment
      fetch(`/api/tunes/${slug}/download`, { method: 'POST' }).catch(() => {});
    });
  });
</script>
```

- [ ] **Step 5: Re-run tests, confirm pass**

```bash
npx playwright test tests/e2e/download-counter.spec.ts
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/tunes/\[id\]/download.ts src/components/ShareCodeBox.astro tests/e2e/download-counter.spec.ts
git commit -m "feat: wire share-code copy click to download counter API"
```

---

### Task 2: 404 page

**Files:**
- Create: `src/pages/404.astro`
- Test: `tests/e2e/404-page.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/404-page.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('404 page renders for unknown route', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist-xyz');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('404');
  await expect(page.locator('a[href="/"]')).toBeVisible();
});

test('unknown tune slug renders 404 page (not redirect)', async ({ page }) => {
  const response = await page.goto('/tune/does-not-exist-12345');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('404');
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
npx playwright test tests/e2e/404-page.spec.ts
```

Expected: FAIL. First test: response is 404 but page has no `h1` containing "404" — current 404 is the default Astro one. Second: tune detail currently `Astro.redirect('/404')` to a non-existent page.

- [ ] **Step 3: Create the 404 page**

Create `src/pages/404.astro`:

```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="404">
  <section class="px-6 py-24 max-w-3xl mx-auto text-center">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-3">＞ DEAD END / 404</div>
    <h1 class="text-[96px] font-extrabold leading-none mb-3">
      <span class="bg-gradient-to-r from-cyan to-pink bg-clip-text text-transparent">404</span>
    </h1>
    <p class="text-[16px] text-text-mute mb-8">
      路線跑掉了。這條 URL 對應的調校不存在，或是已經被刪了。
    </p>
    <div class="flex gap-3 justify-center">
      <a href="/" class="bg-cyan text-bg px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">回首頁</a>
      <a href="/browse" class="border border-line text-text px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">瀏覽調校</a>
    </div>
  </section>
</Base>
```

- [ ] **Step 4: Fix the tune detail redirect to actually render 404 with status 404**

In `src/pages/tune/[slug].astro:12`, replace:

```typescript
if (!tune) return Astro.redirect('/404');
```

with:

```typescript
if (!tune) {
  Astro.response.status = 404;
  return Astro.rewrite('/404');
}
```

This rewrites internally to `/404.astro` while setting HTTP status 404 (so the e2e test's `response?.status()` check matches).

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/404-page.spec.ts
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/404.astro src/pages/tune/\[slug\].astro tests/e2e/404-page.spec.ts
git commit -m "feat: add 404 page and rewrite unknown tune slugs to it"
```

---

### Task 3: Review submission form

**Files:**
- Create: `src/components/ReviewForm.astro`
- Modify: `src/pages/tune/[slug].astro`
- Test: `tests/e2e/review-flow.spec.ts`

**Background:** API endpoint `POST /api/tunes/[id]/review` (where `[id]` is actually the slug — see `review.ts:11`) already accepts `{ author_handle, rating, body, turnstile_token, honeypot }`. We just need a UI that submits this. Turnstile dev key `1x00000000000000000000AA` auto-passes.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/review-flow.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test, confirm fail**

```bash
npx playwright test tests/e2e/review-flow.spec.ts
```

Expected: FAIL — `[data-review-form]` doesn't exist.

- [ ] **Step 3: Create ReviewForm component**

Create `src/components/ReviewForm.astro`:

```astro
---
type Props = { tuneSlug: string };
const { tuneSlug } = Astro.props;
const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';
---
<form data-review-form data-tune-slug={tuneSlug} class="bg-bg-card border-l-[3px] border-cyan p-5 space-y-4">
  <div class="font-mono text-[11px] text-cyan tracking-wider3">＞ 留下評論</div>

  <div>
    <span class="label-mono">評分</span>
    <div class="mt-2 flex gap-1.5" data-rating-group>
      {[1,2,3,4,5].map((n) => (
        <button type="button" data-rating={n}
          class="bg-transparent border border-line text-text-mute px-4 py-2 font-mono text-[14px] font-bold">
          ★ {n}
        </button>
      ))}
      <input type="hidden" name="rating" value="0" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3.5">
    <label class="block">
      <span class="label-mono">顯示名稱（選填）</span>
      <input name="author_handle" maxlength="40" placeholder="anonymous"
        class="mt-1.5 w-full bg-bg border border-line text-text p-2 font-mono" />
    </label>
  </div>

  <label class="block">
    <span class="label-mono">評論內容（選填）</span>
    <textarea name="body" rows="3" maxlength="1000"
      class="mt-1.5 w-full bg-bg border border-line text-text p-2.5"></textarea>
  </label>

  <input type="text" name="honeypot" tabindex="-1" autocomplete="off" class="hidden" />
  <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>

  <div class="flex justify-end gap-2.5 items-center">
    <span data-review-status class="text-text-dim text-[12px]"></span>
    <button type="submit" data-review-submit
      class="bg-cyan border-0 text-bg px-5 py-2.5 font-mono font-bold uppercase tracking-wider2">
      送出評論
    </button>
  </div>
</form>

<script>
  document.querySelectorAll<HTMLFormElement>('[data-review-form]').forEach((form) => {
    const slug = form.dataset.tuneSlug!;
    const status = form.querySelector<HTMLElement>('[data-review-status]')!;
    const ratingInput = form.querySelector<HTMLInputElement>('input[name="rating"]')!;

    form.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((b) => {
      b.addEventListener('click', () => {
        form.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((x) => {
          x.classList.remove('bg-cyan','text-bg','border-cyan');
          x.classList.add('border-line','text-text-mute');
        });
        b.classList.remove('border-line','text-text-mute');
        b.classList.add('bg-cyan','text-bg','border-cyan');
        ratingInput.value = b.dataset.rating!;
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = Number(ratingInput.value);
      if (!rating) { status.textContent = '請選擇評分'; return; }
      status.textContent = '送出中…';
      const fd = new FormData(form);
      const body = {
        author_handle: fd.get('author_handle'),
        rating,
        body: fd.get('body'),
        turnstile_token: (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement)?.value,
        honeypot: fd.get('honeypot')
      };
      const res = await fetch(`/api/tunes/${slug}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (res.ok) {
        status.textContent = '已送出，重新整理頁面可看到您的評論。';
        form.reset();
        form.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((x) => {
          x.classList.remove('bg-cyan','text-bg','border-cyan');
          x.classList.add('border-line','text-text-mute');
        });
        ratingInput.value = '0';
      } else {
        const data = await res.json().catch(() => ({}));
        status.textContent = `錯誤：${data.error ?? res.status}`;
      }
    });
  });
</script>
```

- [ ] **Step 4: Embed ReviewForm in tune detail page**

In `src/pages/tune/[slug].astro`, add the import at top and insert the form below the reviews section.

Add to imports (around line 4):
```typescript
import ReviewForm from '~/components/ReviewForm.astro';
```

After the `</section>` of the reviews section (around line 72), and before the `<script>` JSON-LD block, add:

```astro
  <section class="px-6 pb-12 max-w-6xl mx-auto">
    <ReviewForm tuneSlug={tune.slug} />
  </section>
```

Also, the Turnstile script needs to load on this page. Add to the head/end of the file:

```astro
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

(Place this just before `</Base>` so it loads alongside the form.)

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/review-flow.spec.ts
```

Expected: both tests PASS.

- [ ] **Step 6: Manual smoke test**

```bash
# dev server should still be running on :4321
open http://localhost:4321/tune/mazda-mx5-miata-na-1989-demo06
```

Click the stars, type a name, submit. Refresh — your review should appear in the list above.

- [ ] **Step 7: Commit**

```bash
git add src/components/ReviewForm.astro src/pages/tune/\[slug\].astro tests/e2e/review-flow.spec.ts
git commit -m "feat: add review submission form on tune detail page"
```

---

### Task 4: Search box in header

**Files:**
- Modify: `src/components/Header.astro` — add search input
- Modify: `src/pages/browse.astro` — handle `?q=` param via `/api/search`
- Test: `tests/e2e/search-flow.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/search-flow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('typing in header search and submitting goes to /browse?q=', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-search-input]', 'supra');
  await page.press('[data-search-input]', 'Enter');
  await page.waitForURL(/\/browse\?q=supra/);
});

test('browse with ?q= shows search results', async ({ page }) => {
  await page.goto('/browse?q=supra');
  await expect(page.locator('h1')).toContainText('搜尋');
  await expect(page.locator('a[href*="/tune/"]').first()).toBeVisible();
  // The Supra demo tune should appear
  const links = await page.locator('a[href*="/tune/"]').allTextContents();
  expect(links.some((t) => /supra|2jz/i.test(t))).toBe(true);
});

test('browse with no results shows empty state', async ({ page }) => {
  await page.goto('/browse?q=zzzzznotunesmatchthis');
  await expect(page.locator('[data-empty-state]')).toBeVisible();
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/search-flow.spec.ts
```

Expected: FAIL. No `[data-search-input]`, browse doesn't read `?q=`.

- [ ] **Step 3: Add search input to Header**

In `src/components/Header.astro`, change the right-side div (currently just the upload CTA, lines 18-20) to include a search form. Replace lines 18-20 with:

```astro
  <div class="flex gap-3 items-center">
    <form action="/browse" method="get" class="hidden md:block">
      <input type="search" name="q" data-search-input placeholder={t['search.placeholder']}
        class="bg-bg border border-line text-text px-3 py-1.5 text-[12px] font-mono w-[220px]" />
    </form>
    <a href="/upload" class="bg-cyan text-bg px-3.5 py-1.5 text-[12px] font-bold font-mono uppercase tracking-wider2 no-underline">{t['cta.upload']}</a>
  </div>
```

- [ ] **Step 4: Make browse handle `?q=`**

In `src/pages/browse.astro`, modify the frontmatter (everything between `---`):

```typescript
---
import Base from '~/layouts/Base.astro';
import TuneCard from '~/components/TuneCard.astro';
import FilterSidebar from '~/components/FilterSidebar.astro';
import { listTunes, searchTunes } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

const q = Astro.url.searchParams;
const searchQuery = q.get('q')?.trim() ?? '';
const limit = 24;
const offset = q.get('page') ? (Number(q.get('page')) - 1) * limit : 0;

let rows: Array<any>;
if (searchQuery.length >= 2) {
  // sanitize for FTS5 — same logic as /api/search
  const fts = searchQuery
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"*`)
    .join(' OR ');
  const r = fts ? await searchTunes(env.DB, fts, limit) : { results: [] };
  rows = (r.results ?? []) as Array<any>;
} else {
  const result = await listTunes(env.DB, {
    carSlug: q.get('car') ?? undefined,
    tuneType: q.get('type') ?? undefined,
    piClass: q.get('pi') ?? undefined,
    drivetrain: q.get('drivetrain') ?? undefined,
    minRating: q.get('min_rating') ? Number(q.get('min_rating')) : undefined,
    sort: (q.get('sort') as 'downloads'|'rating'|'newest'|'reviews') ?? 'downloads',
    limit, offset
  });
  rows = (result.results ?? []) as Array<any>;
}

const counts: { pi: Record<string, number>; type: Record<string, number> } = { pi: {}, type: {} };
const piRowsResult = await env.DB.prepare("SELECT pi_class, COUNT(*) AS n FROM tunes WHERE status = 'public' GROUP BY pi_class").all();
const typeRowsResult = await env.DB.prepare("SELECT tune_type, COUNT(*) AS n FROM tunes WHERE status = 'public' GROUP BY tune_type").all();
(piRowsResult.results as Array<{ pi_class: string; n: number }>).forEach((r) => { counts.pi[r.pi_class] = r.n; });
(typeRowsResult.results as Array<{ tune_type: string; n: number }>).forEach((r) => { counts.type[r.tune_type] = r.n; });
---
```

Then update the `<h1>` and add an empty state. Replace the `<section class="px-6 pt-8 ...">` block:

```astro
  <section class="px-6 pt-8 max-w-7xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">
      ＞ {searchQuery ? '搜尋結果' : '瀏覽調校'}
    </div>
    <h1 class="text-[32px] font-extrabold mb-1">
      {searchQuery ? `搜尋「${searchQuery}」` : `${rows.length} 筆調校`}
    </h1>
  </section>
```

And inside the grid `<div>` (currently `<div class="grid grid-cols-3 gap-3.5">{rows.map(...)}</div>`), wrap with an empty-state fallback:

```astro
      {rows.length === 0 ? (
        <div data-empty-state class="text-text-mute font-mono text-[13px] py-10">
          {searchQuery ? `沒找到符合「${searchQuery}」的調校。` : '目前還沒有任何調校。'}
        </div>
      ) : (
        <div class="grid grid-cols-3 gap-3.5">
          {rows.map((r: any, i: number) => (
            <TuneCard
              slug={r.slug}
              name={r.name}
              shareCode={r.share_code}
              carYear={r.car_year}
              carMake={r.car_make}
              carModel={r.car_model}
              piClass={r.pi_class}
              tuneType={r.tune_type}
              drivetrain={r.drivetrain}
              rating={r.rating_count > 0 ? r.rating_sum / r.rating_count : 0}
              downloads={r.download_count}
              authorHandle={r.author_handle}
              accent={i % 3 === 1 ? 'pink' : 'cyan'} />
          ))}
        </div>
      )}
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/search-flow.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Header.astro src/pages/browse.astro tests/e2e/search-flow.spec.ts
git commit -m "feat: add header search input and browse search-results handling"
```

---

### Task 5: Mobile responsive pass

**Files:**
- Modify: `src/pages/index.astro`, `browse.astro`, `tune/[slug].astro`, `upload.astro`, `edit/[slug].astro`
- Modify: `src/components/FilterSidebar.astro` (if it needs mobile-stacked variant)
- Test: `tests/e2e/mobile-layout.spec.ts`

**Background:** Existing layouts use unconditional grids (`grid-cols-3`, `grid-cols-4`, `grid-cols-[240px_1fr]`). On iPhone-size (375px) these break. Tailwind v4 default breakpoints: `sm` ≥ 640px, `md` ≥ 768px, `lg` ≥ 1024px. Pattern: start with mobile (single column / stacked), add `md:grid-cols-N` for desktop.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/mobile-layout.spec.ts`:

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone SE'] });

test('homepage h1 fits within viewport on mobile', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1').first();
  const box = await h1.boundingBox();
  expect(box).not.toBeNull();
  // viewport is 375px; h1 should not overflow
  expect(box!.width).toBeLessThanOrEqual(375);
  // no horizontal scroll
  const docOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(docOverflow).toBeLessThanOrEqual(0);
});

test('browse page stacks tune cards single column on mobile', async ({ page }) => {
  await page.goto('/browse');
  // First two cards should have the same x coord (stacked)
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
    // share_code should be below tune name (different y), not beside it
    expect(codeBox.y).toBeGreaterThan(nameBox.y + nameBox.height - 5);
  }
});

test('tune detail share box stacks below header on mobile', async ({ page }) => {
  await page.goto('/tune/toyota-supra-mk4-1994-demo04');
  const h1 = await page.locator('h1').boundingBox();
  const shareBox = await page.locator('[data-share-box]').boundingBox();
  if (h1 && shareBox) expect(shareBox.y).toBeGreaterThan(h1.y + h1.height - 5);
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npx playwright test tests/e2e/mobile-layout.spec.ts
```

Expected: 4 tests FAIL (homepage overflow, cards side-by-side, form 2-cols, share box right column).

- [ ] **Step 3: Fix `index.astro` hero + stats grid**

In `src/pages/index.astro`, change:

```astro
<h1 class="text-[56px] font-extrabold leading-[1.05] mb-4">
```

to:

```astro
<h1 class="text-[36px] md:text-[56px] font-extrabold leading-[1.05] mb-4">
```

Change `class="px-6 py-12 max-w-6xl mx-auto"` (the section padding) — keep as-is, fine.

Change `<div class="max-w-6xl mx-auto grid grid-cols-4 gap-8">` to:

```astro
<div class="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
```

Change `<div class="grid grid-cols-3 gap-4">` (featured) to:

```astro
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
```

Change the trending row `grid-cols-[30px_1fr_90px_60px_70px]` to:

```astro
class="bg-bg-card p-4 grid grid-cols-[24px_1fr] md:grid-cols-[30px_1fr_90px_60px_70px] gap-3 md:gap-4 items-center text-[13px] no-underline"
```

(On mobile only rank + title show; secondary stats hidden — that's fine for now.)

- [ ] **Step 4: Fix `browse.astro`**

In `src/pages/browse.astro`, change `<section class="px-6 py-6 max-w-7xl mx-auto grid grid-cols-[240px_1fr] gap-7">` to:

```astro
<section class="px-6 py-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 md:gap-7">
```

Change the cards grid `grid-cols-3 gap-3.5` to:

```astro
class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"
```

- [ ] **Step 5: Fix `upload.astro`**

In `src/pages/upload.astro`, change the basic info `<div class="grid grid-cols-2 gap-4 mt-4">` to:

```astro
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
```

(Note: the `col-span-2` children remain — on mobile they're already full width because parent is single col.)

Change build info `<div class="grid grid-cols-4 gap-3.5 mt-4">` to:

```astro
<div class="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-4">
```

Change author `<div class="grid grid-cols-2 gap-3.5 mt-3.5">` to:

```astro
<div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3.5">
```

- [ ] **Step 6: Fix `tune/[slug].astro`**

In `src/pages/tune/[slug].astro`, change `<div class="grid grid-cols-[2fr_1fr] gap-8 items-start">` to:

```astro
<div class="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 md:gap-8 items-start">
```

Change `<h1 class="text-[42px] font-extrabold mb-2 leading-tight">` to:

```astro
<h1 class="text-[28px] md:text-[42px] font-extrabold mb-2 leading-tight">
```

Change reviews `<div class="grid grid-cols-2 gap-3.5">` to:

```astro
<div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
```

In `src/components/TuneValuesGrid.astro`, change `<div class="grid grid-cols-3 gap-px bg-line font-mono">` to:

```astro
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-line font-mono">
```

- [ ] **Step 7: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/mobile-layout.spec.ts
```

Expected: 4 tests PASS.

- [ ] **Step 8: Eyeball check at 3 sizes**

Manually open in browser with DevTools responsive mode at 375px (iPhone SE), 768px (iPad), 1280px (desktop). Walk through `/`, `/browse`, `/tune/{slug}`, `/upload`, `/edit/{slug}`. Note any visual glitches and fix them by adjusting breakpoints.

- [ ] **Step 9: Commit**

```bash
git add src/pages/index.astro src/pages/browse.astro src/pages/upload.astro src/pages/tune/\[slug\].astro src/components/TuneValuesGrid.astro tests/e2e/mobile-layout.spec.ts
git commit -m "feat: add mobile breakpoints across hero, browse grid, forms, detail page"
```

---

## After All Tasks: Final Verification

- [ ] **Run the entire test suite**

```bash
npm run check        # astro check (type errors)
npm test             # vitest unit tests
npx playwright test  # e2e
```

Expected: all pass.

- [ ] **End-to-end smoke walk**

With dev server running:
1. Go to `/` — see Chinese hero, featured tunes, trending list
2. Type "supra" in header search → hits `/browse?q=supra` → see Supra MK4 demo result
3. Click into a tune → see details + new review form
4. Submit a rating + comment → refresh → review appears
5. Click "複製分享碼" → DB `download_count` should have +1 (verify via `npx wrangler d1 execute fh6-tune-platform-local --local --command="SELECT name, download_count FROM tunes ORDER BY download_count DESC LIMIT 5"`)
6. Navigate to `/this-route-does-not-exist` → see 404 page
7. Open DevTools at 375px width → no overflow, single-column layout

- [ ] **Done — Sprint 1 complete**

The core upload→browse→rate→download loop is now closed. Sprint 2 (推薦賽道顯示, 檢舉按鈕, /about, Cloudflare 部署) becomes the next planning target.
