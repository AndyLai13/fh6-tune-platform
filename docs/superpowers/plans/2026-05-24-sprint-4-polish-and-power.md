# Sprint 4: Polish + Power Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sand the user-facing edges (share-code format, duplicate warnings, sitemap correctness) and add the discovery/power surfaces that don't fit MVP — tune compare, RSS, and CJK-search compatibility.

**Architecture:** All tasks ride existing infrastructure. Three new endpoints (`GET /api/share-code-check`, `GET /feed.xml`, `/compare` page). One migration (0004) to switch FTS5 to `unicode61` tokenizer for CJK pass-through. One small fix to the existing sitemap (`/track/` → `/tracks/`, add `/tuner/{handle}`).

**Tech Stack:** Astro 6 (server output) · Cloudflare Pages · D1 (SQLite + FTS5 unicode61) · KV · Tailwind v4 · Playwright · Vitest.

---

## File Structure Overview

**New files:**
- `migrations/0004_fts_unicode61.sql` — rebuild `tunes_fts` with `tokenize='unicode61'`
- `src/pages/api/share-code-check.ts` — `GET ?code=` → `{ exists, existingSlug? }`
- `src/pages/compare.astro` — `?a=slug&b=slug` side-by-side TuneValuesGrid + meta diff
- `src/pages/feed.xml.ts` — RSS 2.0 feed of latest 20 public tunes
- `src/lib/share-code.ts` — `formatShareCode(input)` normalizes to `XXX-XXX-XXX`
- `tests/unit/share-code.test.ts`
- `tests/e2e/share-code-format.spec.ts`
- `tests/e2e/compare.spec.ts`
- `tests/e2e/feed-and-sitemap.spec.ts`
- `tests/e2e/search-cjk.spec.ts`

**Modified files:**
- `src/pages/upload.astro` — wire `formatShareCode` on input + debounced share-code-check fetch + duplicate-warning UI
- `src/lib/db.ts` — add `getTuneByShareCode(db, code)` helper for the check endpoint
- `src/lib/fts.ts` — change regex from `[^\w\s-]` to `[^\p{L}\p{N}\s_-]` with `u` flag (so CJK passes through), update unit tests
- `src/pages/sitemap.xml.ts` — fix `/track/` → `/tracks/` (Sprint 3 broke this) AND add `/tuner/{handle}` URLs
- `tests/unit/fts.test.ts` — extend with CJK preservation case

**Task order rationale:** Task 1 (share-code format + dup detection) is the most user-visible polish. Task 2 (compare) is the biggest feature; do it second so we don't carry pending state. Task 3 (RSS) is small and atomic. Task 4 (sitemap fix) is a 2-line fix bundled with adding tuner URLs. Task 5 (CJK FTS) is a migration so it goes last to avoid blocking other tests.

---

### Task 1: Share-code auto-format + duplicate detection

**Files:**
- Create: `src/lib/share-code.ts`
- Create: `src/pages/api/share-code-check.ts`
- Create: `tests/unit/share-code.test.ts`
- Create: `tests/e2e/share-code-format.spec.ts`
- Modify: `src/lib/db.ts` — add `getTuneByShareCode`
- Modify: `src/pages/upload.astro` — wire input formatter + duplicate-check debounce

**Background:** FH6 share codes are alphanumeric, conventionally formatted as `XXX-XXX-XXX` (three groups of 3 separated by hyphens). Users will copy-paste them with or without hyphens. We normalize on input. Duplicate detection is advisory only (no UNIQUE constraint to avoid hard-rejecting legitimate re-uploads), surfaced as a soft warning with a link to the existing tune.

- [ ] **Step 1: Unit tests for `formatShareCode`**

Create `tests/unit/share-code.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { formatShareCode } from '~/lib/share-code';

describe('formatShareCode', () => {
  it('passes through already-formatted codes', () => {
    expect(formatShareCode('821-471-933')).toBe('821-471-933');
  });
  it('inserts hyphens into 9-char alphanumeric', () => {
    expect(formatShareCode('821471933')).toBe('821-471-933');
  });
  it('uppercases letters', () => {
    expect(formatShareCode('abc123def')).toBe('ABC-123-DEF');
  });
  it('strips non-alphanumeric noise before formatting', () => {
    expect(formatShareCode('821 471 933')).toBe('821-471-933');
    expect(formatShareCode('821.471.933')).toBe('821-471-933');
    expect(formatShareCode('821/471/933')).toBe('821-471-933');
  });
  it('returns partial for shorter input', () => {
    expect(formatShareCode('821')).toBe('821');
    expect(formatShareCode('821471')).toBe('821-471');
  });
  it('truncates longer than 9 alphanumeric to 9', () => {
    expect(formatShareCode('821471933EXTRA')).toBe('821-471-933');
  });
  it('handles empty input', () => {
    expect(formatShareCode('')).toBe('');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/unit/share-code.test.ts
```

- [ ] **Step 3: Create `src/lib/share-code.ts`**

```typescript
export function formatShareCode(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 9);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}
```

- [ ] **Step 4: Run unit tests, confirm pass**

```bash
npm test -- tests/unit/share-code.test.ts
```

7 pass.

- [ ] **Step 5: Add `getTuneByShareCode` to `src/lib/db.ts`**

After the existing `getTuneBySlug` function (around line 40-42), add:

```typescript
export async function getTuneByShareCode(db: D1Database, code: string) {
  return db.prepare("SELECT slug, name FROM tunes WHERE share_code = ? AND status = 'public' LIMIT 1").bind(code).first<{ slug: string; name: string }>();
}
```

- [ ] **Step 6: Create `src/pages/api/share-code-check.ts`**

```typescript
import type { APIRoute } from 'astro';
import { getTuneByShareCode } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code')?.trim();
  if (!code || code.length < 5) return Response.json({ exists: false });
  const existing = await getTuneByShareCode(env.DB, code);
  if (!existing) return Response.json({ exists: false });
  return Response.json({ exists: true, existingSlug: existing.slug, existingName: existing.name });
};
```

- [ ] **Step 7: Write e2e test**

Create `tests/e2e/share-code-format.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('share code input auto-formats to XXX-XXX-XXX as user types', async ({ page }) => {
  await page.goto('/upload');
  const input = page.locator('input[name="share_code"]');
  await input.fill('821471933');
  // Trigger the input event by typing one more then deleting (formatter is on input event)
  await input.press('End');
  await expect(input).toHaveValue('821-471-933');
});

test('share code input rejects non-alphanumeric and uppercases', async ({ page }) => {
  await page.goto('/upload');
  const input = page.locator('input[name="share_code"]');
  await input.fill('abc 123 def');
  await input.press('End');
  await expect(input).toHaveValue('ABC-123-DEF');
});

test('duplicate share code surfaces a warning with link to existing tune', async ({ page }) => {
  await page.goto('/upload');
  // 707-202-815 is the seeded share code for the Supra demo (toyota-supra-mk4-1994-demo04)
  const input = page.locator('input[name="share_code"]');
  await input.fill('707-202-815');
  await input.press('Tab'); // blur to trigger debounced check
  await expect(page.locator('[data-share-code-warning]')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-share-code-warning] a[href*="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
});
```

- [ ] **Step 8: Run, confirm fail (no formatter, no duplicate-check UI yet)**

```bash
npx playwright test tests/e2e/share-code-format.spec.ts
```

- [ ] **Step 9: Wire `formatShareCode` + duplicate check into `src/pages/upload.astro`**

Add to the imports at top of frontmatter (alongside existing imports):

```typescript
import { formatShareCode } from '~/lib/share-code';
```

(Note: this import is used in the inline `<script>` block below. Astro processes `<script>` as TS modules and resolves `~/` paths via tsconfig.)

Find the share_code input (currently around line 27-29):

```astro
          <label class="block">
            <span class="label-mono">FH6 分享碼</span>
            <input name="share_code" required maxlength="32" class="mt-1.5 w-full bg-bg border border-cyan text-text p-2.5 font-mono text-[16px] font-bold tracking-wide" />
          </label>
```

Replace with:

```astro
          <label class="block">
            <span class="label-mono">FH6 分享碼</span>
            <input name="share_code" required maxlength="11" data-share-code-input
              class="mt-1.5 w-full bg-bg border border-cyan text-text p-2.5 font-mono text-[16px] font-bold tracking-wide" />
            <div data-share-code-warning class="hidden mt-1.5 font-mono text-[11px] text-pink">
              ⚠ 已存在類似分享碼：<a data-existing-link href="#" class="text-cyan no-underline">查看現有調校 →</a>
            </div>
          </label>
```

In the `<script>` block at the bottom, add this near the top (after `const form = ...; const status = ...;`):

```typescript
    import { formatShareCode } from '~/lib/share-code';

    const shareInput = form.querySelector<HTMLInputElement>('[data-share-code-input]')!;
    const shareWarning = form.querySelector<HTMLElement>('[data-share-code-warning]')!;
    const existingLink = shareWarning.querySelector<HTMLAnchorElement>('[data-existing-link]')!;
    let debounceTimer: number | undefined;

    shareInput.addEventListener('input', () => {
      const formatted = formatShareCode(shareInput.value);
      if (formatted !== shareInput.value) shareInput.value = formatted;
      shareWarning.classList.add('hidden');
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => checkShareCode(formatted), 400);
    });

    async function checkShareCode(code: string) {
      if (code.length < 5) return;
      const res = await fetch(`/api/share-code-check?code=${encodeURIComponent(code)}`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json() as { exists: boolean; existingSlug?: string };
      if (data.exists && data.existingSlug) {
        existingLink.href = `/tune/${data.existingSlug}`;
        shareWarning.classList.remove('hidden');
      }
    }
```

(NOTE: Astro `<script>` blocks only allow ONE import statement section at the top. If the existing script already has an import, merge the `formatShareCode` import into the existing imports. Otherwise add at the very top of the `<script>` block, before any other code.)

- [ ] **Step 10: Run tests, confirm pass**

```bash
npm test -- tests/unit/share-code.test.ts
npx playwright test tests/e2e/share-code-format.spec.ts
```

7 unit + 3 e2e pass.

- [ ] **Step 11: Commit**

```bash
git add src/lib/share-code.ts src/pages/api/share-code-check.ts src/lib/db.ts src/pages/upload.astro tests/unit/share-code.test.ts tests/e2e/share-code-format.spec.ts
git commit -m "feat: share-code auto-format on input + duplicate warning"
```

---

### Task 2: Tune compare /compare?a=slug&b=slug

**Files:**
- Create: `src/pages/compare.astro`
- Test: `tests/e2e/compare.spec.ts`

**Background:** Power feature for users picking between two tunes. The page accepts `?a={slug}&b={slug}` query params, loads both tunes via `getTuneBySlug`, and renders them side by side. Visual layout: 2-column grid (or 1-column on mobile) with the tune header + TuneValuesGrid stacked per side. If either slug is missing/invalid, render an empty-state with a hint that the URL needs `?a=...&b=...`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/compare.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/compare.spec.ts
```

- [ ] **Step 3: Create `src/pages/compare.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
import TuneValuesGrid from '~/components/TuneValuesGrid.astro';
import { getTuneBySlug, getCarById } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

const q = Astro.url.searchParams;
const slugA = q.get('a')?.trim() ?? '';
const slugB = q.get('b')?.trim() ?? '';

const [tuneA, tuneB] = await Promise.all([
  slugA ? getTuneBySlug(env.DB, slugA) : null,
  slugB ? getTuneBySlug(env.DB, slugB) : null
]);

const [carA, carB] = await Promise.all([
  tuneA ? getCarById(env.DB, tuneA.car_id) : null,
  tuneB ? getCarById(env.DB, tuneB.car_id) : null
]);

const valuesA = tuneA ? JSON.parse(tuneA.tune_values) : null;
const valuesB = tuneB ? JSON.parse(tuneB.tune_values) : null;

const showHint = !slugA && !slugB;
const missingA = slugA && !tuneA;
const missingB = slugB && !tuneB;
---
<Base title="調校比較" description="並排比較兩筆調校的所有數值。">
  <section class="px-6 py-10 max-w-7xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ COMPARE</div>
    <h1 class="text-[32px] font-extrabold mb-6">調校比較</h1>

    {showHint && (
      <div data-compare-hint class="bg-bg-card border-l-[3px] border-line p-5">
        <div class="font-mono text-[11px] text-text-dim tracking-wider2 mb-2">＞ 使用方法</div>
        <p class="text-text-mute m-0 mb-3">在 URL 加上 <code class="text-cyan">?a=slug-1&b=slug-2</code> 比較任兩筆調校。</p>
        <p class="text-text-mute m-0 text-[13px]">範例：<a href="/compare?a=toyota-supra-mk4-1994-demo04&b=mazda-mx5-miata-na-1989-demo06" class="text-cyan">Supra vs Miata</a></p>
      </div>
    )}

    {(missingA || missingB) && (
      <div data-compare-missing class="bg-bg-card border-l-[3px] border-pink p-5">
        <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ ERROR</div>
        <p class="text-text-mute m-0">
          {missingA && <span>找不到調校：<code>{slugA}</code></span>}
          {missingB && <span>找不到調校：<code>{slugB}</code></span>}
        </p>
      </div>
    )}

    {tuneA && tuneB && valuesA && valuesB && (
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div class="font-mono text-[11px] text-cyan tracking-wider3 mb-1">＞ A · {tuneA.tune_type.toUpperCase()} / {tuneA.pi_class} / {tuneA.drivetrain}</div>
          <h2 class="text-[24px] font-bold mb-1">{tuneA.name}</h2>
          <div class="text-[14px] text-text-mute mb-2">{carA?.year} {carA?.make} {carA?.model}</div>
          <div class="font-mono text-[13px] text-cyan mb-4">{tuneA.share_code}</div>
          <TuneValuesGrid values={valuesA} />
        </div>
        <div>
          <div class="font-mono text-[11px] text-pink tracking-wider3 mb-1">＞ B · {tuneB.tune_type.toUpperCase()} / {tuneB.pi_class} / {tuneB.drivetrain}</div>
          <h2 class="text-[24px] font-bold mb-1">{tuneB.name}</h2>
          <div class="text-[14px] text-text-mute mb-2">{carB?.year} {carB?.make} {carB?.model}</div>
          <div class="font-mono text-[13px] text-pink mb-4">{tuneB.share_code}</div>
          <TuneValuesGrid values={valuesB} />
        </div>
      </div>
    )}
  </section>
</Base>
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/compare.spec.ts
```

3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/compare.astro tests/e2e/compare.spec.ts
git commit -m "feat: /compare side-by-side tune comparison page"
```

---

### Task 3: RSS feed /feed.xml

**Files:**
- Create: `src/pages/feed.xml.ts`
- Test: append to `tests/e2e/feed-and-sitemap.spec.ts` (test file shared with Task 4)

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/feed-and-sitemap.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('/feed.xml returns RSS 2.0 with seeded tune entries', async ({ request }) => {
  const res = await request.get('/feed.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/xml/);

  const body = await res.text();
  expect(body).toContain('<rss version="2.0">');
  expect(body).toContain('<channel>');
  expect(body).toContain('<title>touge.gg</title>');

  // At least one seeded tune appears as an <item>
  expect(body).toContain('<item>');
  expect(body).toContain('toyota-supra-mk4-1994-demo04');
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/feed-and-sitemap.spec.ts
```

- [ ] **Step 3: Create `src/pages/feed.xml.ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c] as string));
}

export const GET: APIRoute = async ({ url }) => {
  const base = `${url.protocol}//${url.host}`;
  const result = await env.DB.prepare(`
    SELECT t.slug, t.name, t.description, t.author_handle, t.created_at,
           c.year AS car_year, c.make AS car_make, c.model AS car_model
    FROM tunes t JOIN cars c ON c.id = t.car_id
    WHERE t.status = 'public'
    ORDER BY t.created_at DESC LIMIT 20
  `).all<{ slug: string; name: string; description: string | null; author_handle: string; created_at: number; car_year: number; car_make: string; car_model: string }>();
  const tunes = result.results ?? [];

  const items = tunes.map((t) => {
    const pubDate = new Date(t.created_at * 1000).toUTCString();
    const title = `${t.name} — ${t.car_year} ${t.car_make} ${t.car_model}`;
    const desc = t.description ?? `${t.car_year} ${t.car_make} ${t.car_model} tune by @${t.author_handle}`;
    return `<item>
      <title>${escapeXml(title)}</title>
      <link>${base}/tune/${escapeXml(t.slug)}</link>
      <guid isPermaLink="true">${base}/tune/${escapeXml(t.slug)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>@${escapeXml(t.author_handle)}</author>
      <description>${escapeXml(desc)}</description>
    </item>`;
  }).join('\n  ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>touge.gg</title>
    <link>${base}/</link>
    <description>Forza Horizon 6 玩家調校資料庫 · 最新 20 筆調校</description>
    <language>zh-TW</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npx playwright test tests/e2e/feed-and-sitemap.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/feed.xml.ts tests/e2e/feed-and-sitemap.spec.ts
git commit -m "feat: RSS 2.0 feed at /feed.xml with latest 20 tunes"
```

---

### Task 4: Sitemap fix + tuner URLs

**Files:**
- Modify: `src/pages/sitemap.xml.ts` — fix `/track/{slug}` to `/tracks/{slug}` (plural); add `/tuner/{handle}` URLs for distinct authors; add `/tracks` listing URL
- Test: append to `tests/e2e/feed-and-sitemap.spec.ts`

**Background:** The existing `sitemap.xml.ts:19` uses `/track/${t.slug}` (singular) but Sprint 3 created routes at `/tracks/${t.slug}` (plural). The sitemap is therefore broken — every track URL it lists is a 404. Fix the path. Also add `/tuner/{handle}` for each distinct author_handle and `/tracks` listing.

- [ ] **Step 1: Append failing tests**

Add to `tests/e2e/feed-and-sitemap.spec.ts`:

```typescript
test('/sitemap.xml uses /tracks/ (plural) not /track/', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  // No singular /track/ URLs
  expect(body).not.toMatch(/\/track\/[a-z]/);
  // Plural /tracks/ URLs present
  expect(body).toMatch(/\/tracks\/[a-z]/);
  // /tracks listing URL present
  expect(body).toContain('/tracks</loc>');
});

test('/sitemap.xml includes tuner profile URLs', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  const body = await res.text();
  // At least one seeded tuner handle (two_j_zee is the 2JZ Supra author)
  expect(body).toContain('/tuner/two_j_zee');
});
```

- [ ] **Step 2: Run, confirm new tests fail**

```bash
npx playwright test tests/e2e/feed-and-sitemap.spec.ts
```

- [ ] **Step 3: Fix `src/pages/sitemap.xml.ts`**

Replace the entire file with:

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const base = `${url.protocol}//${url.host}`;
  const tunesResult = await env.DB.prepare("SELECT slug, updated_at FROM tunes WHERE status='public' ORDER BY updated_at DESC LIMIT 50000").all();
  const carsResult = await env.DB.prepare('SELECT slug FROM cars').all();
  const tracksResult = await env.DB.prepare('SELECT slug FROM tracks').all();
  const tunersResult = await env.DB.prepare("SELECT DISTINCT author_handle FROM tunes WHERE status='public'").all();
  const tunes = (tunesResult.results ?? []) as Array<{ slug: string; updated_at: number }>;
  const cars = (carsResult.results ?? []) as Array<{ slug: string }>;
  const tracks = (tracksResult.results ?? []) as Array<{ slug: string }>;
  const tuners = (tunersResult.results ?? []) as Array<{ author_handle: string }>;

  const items = [
    `<url><loc>${base}/</loc></url>`,
    `<url><loc>${base}/browse</loc></url>`,
    `<url><loc>${base}/tracks</loc></url>`,
    `<url><loc>${base}/about</loc></url>`,
    ...cars.map((c) => `<url><loc>${base}/browse?car=${c.slug}</loc></url>`),
    ...tracks.map((t) => `<url><loc>${base}/tracks/${t.slug}</loc></url>`),
    ...tuners.map((t) => `<url><loc>${base}/tuner/${encodeURIComponent(t.author_handle)}</loc></url>`),
    ...tunes.map((t) => `<url><loc>${base}/tune/${t.slug}</loc><lastmod>${new Date(t.updated_at * 1000).toISOString()}</lastmod></url>`)
  ].join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
};
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/feed-and-sitemap.spec.ts
```

All sitemap + feed tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/sitemap.xml.ts tests/e2e/feed-and-sitemap.spec.ts
git commit -m "fix(sitemap): use /tracks/{slug} (plural) and add /tuner/{handle} URLs"
```

---

### Task 5: CJK search support — FTS5 unicode61 tokenizer + sanitizer regex

**Files:**
- Create: `migrations/0004_fts_unicode61.sql`
- Modify: `src/lib/fts.ts` — regex from `[^\w\s-]` to `[^\p{L}\p{N}\s_-]` with `u` flag
- Modify: `tests/unit/fts.test.ts` — extend with CJK case
- Test: `tests/e2e/search-cjk.spec.ts`

**Background:** Sprint 2 noted that `\w` in JS regex is ASCII-only, so CJK characters get stripped silently by the sanitizer. SQLite FTS5's default `simple` tokenizer also doesn't handle CJK. The `unicode61` tokenizer is a strict improvement: it preserves CJK characters as searchable tokens (it still doesn't word-segment Chinese — that requires an external tokenizer — but a query for `"豐田"` will now match a tune containing `豐田` somewhere in indexed text, which is the common case for tuner-supplied descriptions).

This is the minimum useful CJK fix. Real Chinese word segmentation (jieba etc.) is out of scope.

- [ ] **Step 1: Extend the unit tests for the sanitizer**

In `tests/unit/fts.test.ts`, add 2 new test cases inside the `describe('sanitizeFtsQuery', ...)` block:

```typescript
  it('preserves CJK characters as tokens', () => {
    // 豐田 = "Toyota" in Chinese. Each char is treated as its own token by unicode61.
    expect(sanitizeFtsQuery('豐田')).toBe('"豐田"*');
  });
  it('mixes CJK and ASCII tokens', () => {
    expect(sanitizeFtsQuery('豐田 supra')).toBe('"豐田"* OR "supra"*');
  });
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/unit/fts.test.ts
```

The new CJK tests fail because `\w` strips Chinese characters.

- [ ] **Step 3: Update `src/lib/fts.ts`**

Replace the function body:

```typescript
// CJK note: 'unicode61' FTS5 tokenizer preserves CJK characters but does NOT word-segment Chinese
// (each char becomes its own token). True Chinese segmentation requires a custom tokenizer; this is
// the minimum-useful fix for zh-TW users searching by car/tuner names that contain CJK.
export function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .split(/\s+/)
    .filter((t) => t.length >= 1)  // dropped from 2 to 1 — single CJK chars are meaningful tokens
    .map((t) => `"${t}"*`)
    .join(' OR ');
}
```

Note: filter changed from `>= 2` to `>= 1` because a single CJK char is a useful token. This means single-char Latin queries also pass now, which is fine (FTS5 will return many results but no crash).

Also update the existing unit test that previously asserted single-char input returns empty — change:

```typescript
  it('returns empty string for single-character input', () => {
    expect(sanitizeFtsQuery('a')).toBe('');
  });
```

to:

```typescript
  it('preserves single-character input as a token (allows CJK single chars)', () => {
    expect(sanitizeFtsQuery('a')).toBe('"a"*');
  });
```

And the existing "drops tokens under 2 characters" test — change:

```typescript
  it('drops tokens under 2 characters', () => {
    expect(sanitizeFtsQuery('a supra b mk4')).toBe('"supra"* OR "mk4"*');
  });
```

to:

```typescript
  it('preserves all non-empty tokens (1+ chars)', () => {
    expect(sanitizeFtsQuery('a supra b mk4')).toBe('"a"* OR "supra"* OR "b"* OR "mk4"*');
  });
```

- [ ] **Step 4: Run unit tests, confirm pass**

```bash
npm test -- tests/unit/fts.test.ts
```

All 8 tests pass.

- [ ] **Step 5: Create migration `migrations/0004_fts_unicode61.sql`**

```sql
-- Sprint 4: switch tunes_fts tokenizer to unicode61 so CJK characters survive indexing.
-- Strategy: same drop-recreate-backfill pattern as 0003. Triggers preserved verbatim from 0003.

DROP TRIGGER IF EXISTS tunes_ai;
DROP TRIGGER IF EXISTS tunes_au;
DROP TRIGGER IF EXISTS tunes_ad;
DROP TABLE IF EXISTS tunes_fts;

CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle, car_make, car_model,
  content='',
  tokenize='unicode61'
);

CREATE TRIGGER tunes_ai AFTER INSERT ON tunes
WHEN new.status = 'public'
BEGIN
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  SELECT new.id, new.name, new.description, new.author_handle, c.make, c.model
  FROM cars c WHERE c.id = new.car_id;
END;

CREATE TRIGGER tunes_au AFTER UPDATE ON tunes
WHEN OLD.name != NEW.name
  OR OLD.description IS NOT NEW.description
  OR OLD.author_handle != NEW.author_handle
  OR OLD.car_id != NEW.car_id
  OR OLD.status != NEW.status
BEGIN
  INSERT INTO tunes_fts(tunes_fts, rowid, name, description, author_handle, car_make, car_model)
  SELECT 'delete', old.id, old.name, old.description, old.author_handle, c.make, c.model
  FROM cars c WHERE c.id = old.car_id;
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  SELECT new.id, new.name, new.description, new.author_handle, c.make, c.model
  FROM cars c WHERE c.id = new.car_id AND new.status = 'public';
END;

CREATE TRIGGER tunes_ad AFTER DELETE ON tunes BEGIN
  INSERT INTO tunes_fts(tunes_fts, rowid, name, description, author_handle, car_make, car_model)
  SELECT 'delete', old.id, old.name, old.description, old.author_handle, c.make, c.model
  FROM cars c WHERE c.id = old.car_id;
END;

INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
SELECT t.id, t.name, t.description, t.author_handle, c.make, c.model
FROM tunes t JOIN cars c ON c.id = t.car_id
WHERE t.status = 'public';
```

- [ ] **Step 6: Apply migration to local D1**

```bash
npx wrangler d1 execute fh6-tune-platform-local --local --file=migrations/0004_fts_unicode61.sql
```

- [ ] **Step 7: Write e2e test for CJK search**

Create `tests/e2e/search-cjk.spec.ts`:

```typescript
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
```

- [ ] **Step 8: Run e2e test, confirm pass**

```bash
npx playwright test tests/e2e/search-cjk.spec.ts
```

PASS.

- [ ] **Step 9: Regression — existing search tests still pass**

```bash
npx playwright test tests/e2e/search-flow.spec.ts tests/e2e/search-car-fields.spec.ts
```

Both files PASS.

- [ ] **Step 10: Commit**

```bash
git add migrations/0004_fts_unicode61.sql src/lib/fts.ts tests/unit/fts.test.ts tests/e2e/search-cjk.spec.ts
git commit -m "feat(search): unicode61 FTS tokenizer + CJK-friendly sanitizer regex"
```

---

## After All Tasks: Final Verification

- [ ] **Reset and run the whole suite**

```bash
npx wrangler kv key list --binding=KV --local 2>&1 | grep -oE '"rl:[^"]+"' | xargs -I{} npx wrangler kv key delete --binding=KV --local {}
npx wrangler d1 execute fh6-tune-platform-local --local --file=scripts/demo-tunes.sql
npx wrangler d1 execute fh6-tune-platform-local --local --command="DELETE FROM tune_tracks; INSERT INTO tune_tracks (tune_id, track_id) SELECT id, 5 FROM tunes WHERE slug = 'toyota-supra-mk4-1994-demo04';"

npm run check && npm test && npx playwright test
```

Expected: all pass.

- [ ] **Browser smoke**

```bash
npm run dev
# Visit:
#  /upload — type "707-202-815" → see duplicate warning linking to Supra demo
#  /upload — type "ABC123DEF" → input auto-formats to "ABC-123-DEF"
#  /compare?a=toyota-supra-mk4-1994-demo04&b=mazda-mx5-miata-na-1989-demo06 — side by side
#  /feed.xml — RSS 2.0 with 10 demo tunes
#  /sitemap.xml — /tracks/ URLs (plural) present, /tuner/two_j_zee present
#  /browse?q=灣岸 — Bayshore Hunter appears
```

- [ ] **Sprint 4 complete** — site has the polish and discovery layers a community grows on.
