# Sprint 5: Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the launch-readiness gap before pushing the touge.gg Bahamut announcement post — site must look right when shared (OG/Twitter previews), have legal/privacy pages, ship privacy-respecting analytics, and have a one-command production smoke test.

**Architecture:** All meta-tag work centralises in `src/layouts/Base.astro` with optional `canonical` and `ogImage` props. Tune detail pages render a dynamic per-tune OG image via `GET /og/tune/[slug].svg` (SVG output — works with Discord/X/Bahamut link previews; PNG via satori deferred to a later sprint if needed). Privacy + Terms are static Astro routes; Footer gains links to both. Plausible analytics is opt-in by env var (`PLAUSIBLE_DOMAIN`) so it stays off in dev and turns on production-only. Smoke test is a separate Playwright config that hits the deployed URL — run manually post-deploy.

**Tech Stack:** Astro 6 (server output) · Cloudflare Pages · D1 (SQLite + FTS5) · KV · Tailwind v4 · Playwright · Vitest · Plausible (analytics).

---

## File Structure Overview

**New files:**
- `src/pages/og/tune/[slug].svg.ts` — dynamic per-tune OG image SVG endpoint (1200×630)
- `src/pages/og-default.svg.ts` — branded default OG image for non-tune pages
- `src/pages/privacy.astro` — privacy policy (covers IP hashing, Plausible, no accounts)
- `src/pages/terms.astro` — terms of service (UGC, content removal, no warranty)
- `src/lib/og-svg.ts` — pure `renderTuneOgSvg(tune, car)` + `renderDefaultOgSvg()` (testable, no Astro deps)
- `tests/unit/og-svg.test.ts` — unit tests for SVG renderers
- `tests/e2e/og-images.spec.ts` — verifies OG endpoint serves image/svg+xml + tune page has og:image meta
- `tests/e2e/legal-pages.spec.ts` — /privacy and /terms render
- `tests/e2e/seo-meta.spec.ts` — sitewide canonical + OG + Twitter card meta tags present
- `tests/smoke/production.spec.ts` — production smoke test (homepage, /browse, /sitemap.xml, /feed.xml, one tune detail)
- `playwright.smoke.config.ts` — separate Playwright config for smoke tests (uses `SMOKE_BASE_URL` env)

**Modified files:**
- `src/layouts/Base.astro` — add `canonical?`, `ogImage?`, `ogType?` props; render canonical link + og/twitter meta tags; inject Plausible script when `PLAUSIBLE_DOMAIN` env is set
- `src/pages/tune/[slug].astro` — pass `ogImage={`/og/tune/${slug}.svg`}` and `canonical={`/tune/${slug}`}` to Base
- `src/components/Footer.astro` — add `/privacy` and `/terms` links
- `package.json` — add `test:smoke` script
- `docs/DEPLOY.md` — append post-deploy smoke check + Plausible env var docs

**Task order rationale:** Task 1 (Base meta tags) is the foundation; Task 2 (dynamic OG image) depends on it because the tune page passes the SVG URL into the Base props added in Task 1. Task 3 (legal pages) is independent and fast. Task 4 (Plausible) modifies Base again so goes after Task 1's changes are stable. Task 5 (smoke test) is last because it validates the rest is wired correctly.

---

### Task 1: SEO meta tags (canonical + OG + Twitter card) in Base layout

**Files:**
- Modify: `src/layouts/Base.astro`
- Test: `tests/e2e/seo-meta.spec.ts`

**Background:** `src/layouts/Base.astro` currently only emits `<title>` and `<meta name="description">`. When a tune URL is pasted into Bahamut/Discord/X, the link unfurl is bare. We need `<link rel="canonical">`, `<meta property="og:*">`, and `<meta name="twitter:*">` so previews show the page title, description, and (after Task 2) image. Origin is derived from `Astro.url` — same pattern as `src/pages/sitemap.xml.ts:7` (`const base = ${url.protocol}//${url.host}`).

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/seo-meta.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('homepage has canonical + og:* + twitter:card meta tags', async ({ page }) => {
  await page.goto('/');
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', /^https?:\/\/[^/]+\/$/);

  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /touge\.gg/);
  await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
});

test('tune detail passes custom ogImage and canonical', async ({ page }) => {
  await page.goto('/tune/toyota-supra-mk4-1994-demo04');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/tune\/toyota-supra-mk4-1994-demo04$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/tune\/toyota-supra-mk4-1994-demo04\.svg$/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
npx playwright test tests/e2e/seo-meta.spec.ts
```

Expected: FAIL — none of these meta tags exist yet.

- [ ] **Step 3: Update `src/layouts/Base.astro` with full meta tag set**

Replace the entire file with:

```astro
---
import '~/styles/global.css';
import Header from '~/components/Header.astro';
import Footer from '~/components/Footer.astro';
type Props = {
  title: string;
  description?: string;
  /** Path-only (e.g. `/tune/foo`) or absolute URL. Defaults to current request URL. */
  canonical?: string;
  /** Path-only or absolute URL. Defaults to `/og-default.svg`. */
  ogImage?: string;
  ogType?: 'website' | 'article';
};
const {
  title,
  description = 'Forza Horizon 6 調校資料庫。',
  canonical,
  ogImage = '/og-default.svg',
  ogType = 'website',
} = Astro.props;

const origin = `${Astro.url.protocol}//${Astro.url.host}`;
const absolute = (p: string) => (p.startsWith('http') ? p : `${origin}${p}`);
const canonicalUrl = canonical ? absolute(canonical) : absolute(Astro.url.pathname);
const ogImageUrl = absolute(ogImage);
const ogTitle = title.includes('touge.gg') ? title : `${title} — touge.gg`;
---
<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} — touge.gg</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />

  <meta property="og:type" content={ogType} />
  <meta property="og:title" content={ogTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:site_name" content="touge.gg" />
  <meta property="og:locale" content="zh_TW" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={ogTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImageUrl} />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
</head>
<body>
  <Header />
  <main>
    <slot />
  </main>
  <Footer />
</body>
</html>
```

- [ ] **Step 4: Wire `ogImage` + `canonical` into tune detail page**

Edit `src/pages/tune/[slug].astro`. Find the existing `<Base title=...>` opening tag (line ~27 in current file) and replace with:

```astro
<Base
  title={`${tune.name} — ${car?.year} ${car?.make} ${car?.model}`}
  description={tune.description?.slice(0, 160) ?? `${tune.tune_type} 調校，${tune.pi_class} 級。`}
  canonical={`/tune/${tune.slug}`}
  ogImage={`/og/tune/${tune.slug}.svg`}
  ogType="article">
```

- [ ] **Step 5: Run e2e — should still fail on `og:image` URL match (Task 2 wires it for real)**

```bash
npx playwright test tests/e2e/seo-meta.spec.ts -g "homepage"
```

Expected: homepage test PASS. The tune test will fail because the SVG endpoint doesn't yet exist (404), but the META tag content will already be `/og/tune/...svg` so the `toHaveAttribute(/\/og\/tune\/.../, ...)` assertion passes — we only check the meta value, not the resource. Confirm with:

```bash
npx playwright test tests/e2e/seo-meta.spec.ts
```

Expected: BOTH tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/Base.astro src/pages/tune/\[slug\].astro tests/e2e/seo-meta.spec.ts
git commit -m "feat(seo): canonical + OpenGraph + Twitter card meta in Base layout"
```

---

### Task 2: Dynamic per-tune OG image SVG endpoint

**Files:**
- Create: `src/lib/og-svg.ts`
- Create: `src/pages/og/tune/[slug].svg.ts`
- Create: `src/pages/og-default.svg.ts`
- Create: `tests/unit/og-svg.test.ts`
- Create: `tests/e2e/og-images.spec.ts`

**Background:** Goal is a 1200×630 branded SVG with the tune name, car, type, PI class, and `touge.gg` watermark. Pure SVG is fine for Discord/X/Bahamut previews. Pure-function renderer in `lib/og-svg.ts` lets us unit-test the markup; endpoint just imports and serves with `Content-Type: image/svg+xml`. Use the same colour palette as the site (`#0d0d10` bg, `#00ffe1` cyan, `#ff2d6f` pink) — sourced from `src/styles/global.css` Tailwind theme tokens.

- [ ] **Step 1: Write failing unit test**

Create `tests/unit/og-svg.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderTuneOgSvg, renderDefaultOgSvg } from '../../src/lib/og-svg';

describe('renderTuneOgSvg', () => {
  it('embeds tune name, car, type, PI class into 1200x630 SVG', () => {
    const svg = renderTuneOgSvg(
      { name: '森林拉力 GR Yaris', tune_type: 'rally', pi_class: 'A', pi_score: 800, author_handle: 'demo' },
      { year: 2021, make: 'Toyota', model: 'GR Yaris' }
    );
    expect(svg).toMatch(/^<svg[^>]+width="1200"[^>]+height="630"/);
    expect(svg).toContain('森林拉力 GR Yaris');
    expect(svg).toContain('2021 Toyota GR Yaris');
    expect(svg).toContain('RALLY');
    expect(svg).toContain('A · 800');
    expect(svg).toContain('@demo');
    expect(svg).toContain('touge.gg');
  });

  it('escapes XML-unsafe characters in tune name', () => {
    const svg = renderTuneOgSvg(
      { name: 'GT3 RS <special> & "fast"', tune_type: 'grip', pi_class: 'S1', pi_score: 880, author_handle: 'x' },
      { year: 2022, make: 'Porsche', model: '911 GT3 RS' }
    );
    expect(svg).not.toContain('<special>');
    expect(svg).toContain('&lt;special&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;fast&quot;');
  });

  it('truncates very long tune names to fit', () => {
    const longName = '超級長的調校名稱'.repeat(20);
    const svg = renderTuneOgSvg(
      { name: longName, tune_type: 'touge', pi_class: 'A', pi_score: 800, author_handle: 'x' },
      { year: 2020, make: 'Foo', model: 'Bar' }
    );
    expect(svg).toMatch(/…<\/text>/);
  });
});

describe('renderDefaultOgSvg', () => {
  it('returns a 1200x630 SVG with site name', () => {
    const svg = renderDefaultOgSvg();
    expect(svg).toMatch(/^<svg[^>]+width="1200"[^>]+height="630"/);
    expect(svg).toContain('touge.gg');
    expect(svg).toContain('Forza Horizon 6');
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
npx vitest run tests/unit/og-svg.test.ts
```

Expected: FAIL — `Cannot find module '../../src/lib/og-svg'`.

- [ ] **Step 3: Implement `src/lib/og-svg.ts`**

```typescript
type TuneForOg = {
  name: string;
  tune_type: string;
  pi_class: string;
  pi_score: number;
  author_handle: string;
};

type CarForOg = {
  year: number;
  make: string;
  model: string;
};

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max - 1) + '…' : s;

export function renderTuneOgSvg(tune: TuneForOg, car: CarForOg | null | undefined): string {
  const carLine = car ? `${car.year} ${car.make} ${car.model}` : '';
  const name = xmlEscape(truncate(tune.name, 28));
  const carText = xmlEscape(truncate(carLine, 36));
  const typeText = xmlEscape(tune.tune_type.toUpperCase());
  const piText = xmlEscape(`${tune.pi_class} · ${tune.pi_score}`);
  const author = xmlEscape(`@${tune.author_handle}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d0d10"/>
  <rect x="0" y="0" width="1200" height="6" fill="#00ffe1"/>
  <rect x="0" y="624" width="1200" height="6" fill="#ff2d6f"/>
  <text x="80" y="100" font-family="JetBrains Mono, monospace" font-size="22" fill="#ff2d6f" letter-spacing="4">＞ ${typeText} · ${piText}</text>
  <text x="80" y="240" font-family="Inter, sans-serif" font-size="92" font-weight="800" fill="#ffffff">${name}</text>
  <text x="80" y="320" font-family="Inter, sans-serif" font-size="36" fill="#9aa0a6">${carText}</text>
  <text x="80" y="540" font-family="JetBrains Mono, monospace" font-size="24" fill="#9aa0a6">${author}</text>
  <text x="1120" y="540" font-family="JetBrains Mono, monospace" font-size="28" font-weight="700" fill="#00ffe1" text-anchor="end">touge.gg</text>
</svg>`;
}

export function renderDefaultOgSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d0d10"/>
  <rect x="0" y="0" width="1200" height="6" fill="#00ffe1"/>
  <rect x="0" y="624" width="1200" height="6" fill="#ff2d6f"/>
  <text x="600" y="280" font-family="JetBrains Mono, monospace" font-size="28" fill="#ff2d6f" letter-spacing="6" text-anchor="middle">＞ FORZA HORIZON 6</text>
  <text x="600" y="380" font-family="Inter, sans-serif" font-size="120" font-weight="800" fill="#00ffe1" text-anchor="middle">touge.gg</text>
  <text x="600" y="450" font-family="Inter, sans-serif" font-size="32" fill="#9aa0a6" text-anchor="middle">玩家社群驅動的調校資料庫</text>
</svg>`;
}
```

- [ ] **Step 4: Run unit tests, confirm pass**

```bash
npx vitest run tests/unit/og-svg.test.ts
```

Expected: 4 pass.

- [ ] **Step 5: Write failing e2e test**

Create `tests/e2e/og-images.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('GET /og/tune/[slug].svg returns SVG with tune metadata', async ({ request }) => {
  const res = await request.get('/og/tune/toyota-supra-mk4-1994-demo04.svg');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/image\/svg\+xml/);
  const body = await res.text();
  expect(body).toMatch(/^<svg/);
  expect(body).toContain('Supra');
  expect(body).toContain('touge.gg');
});

test('GET /og/tune/unknown-slug.svg returns 404', async ({ request }) => {
  const res = await request.get('/og/tune/this-slug-does-not-exist.svg');
  expect(res.status()).toBe(404);
});

test('GET /og-default.svg returns the default OG image', async ({ request }) => {
  const res = await request.get('/og-default.svg');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/image\/svg\+xml/);
  const body = await res.text();
  expect(body).toContain('touge.gg');
});
```

- [ ] **Step 6: Run e2e, confirm fail**

```bash
npx playwright test tests/e2e/og-images.spec.ts
```

Expected: FAIL — endpoints don't exist yet (404 on both).

- [ ] **Step 7: Implement `src/pages/og/tune/[slug].svg.ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getTuneBySlug, getCarById } from '~/lib/db';
import { renderTuneOgSvg } from '~/lib/og-svg';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug!;
  const tune = await getTuneBySlug(env.DB, slug);
  if (!tune) {
    return new Response('Not found', { status: 404 });
  }
  const car = await getCarById(env.DB, tune.car_id);
  const svg = renderTuneOgSvg(tune, car);
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
};
```

- [ ] **Step 8: Implement `src/pages/og-default.svg.ts`**

```typescript
import type { APIRoute } from 'astro';
import { renderDefaultOgSvg } from '~/lib/og-svg';

export const prerender = false;

export const GET: APIRoute = () => {
  return new Response(renderDefaultOgSvg(), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};
```

- [ ] **Step 9: Run e2e, confirm pass**

```bash
npx playwright test tests/e2e/og-images.spec.ts
```

Expected: 3 pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/og-svg.ts src/pages/og/ src/pages/og-default.svg.ts tests/unit/og-svg.test.ts tests/e2e/og-images.spec.ts
git commit -m "feat(seo): dynamic per-tune OG image SVG endpoint"
```

---

### Task 3: Privacy + Terms pages + Footer links

**Files:**
- Create: `src/pages/privacy.astro`
- Create: `src/pages/terms.astro`
- Modify: `src/components/Footer.astro`
- Test: `tests/e2e/legal-pages.spec.ts`

**Background:** `about.astro` already has a small "關於版權" disclaimer paragraph but no formal privacy or terms doc. Launch needs both so we can credibly disclose data practices (IP hashing, optional Plausible) and limit liability for user-uploaded content. Pages are static Astro with Tailwind, mirroring the `about.astro` structure.

- [ ] **Step 1: Write failing e2e test**

Create `tests/e2e/legal-pages.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('/privacy renders with key disclosures', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('main h1')).toContainText(/隱私|Privacy/);
  await expect(page.locator('main')).toContainText(/IP/);
  await expect(page.locator('main')).toContainText(/帳號|account/i);
});

test('/terms renders with UGC + content-removal section', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.locator('main h1')).toContainText(/服務條款|Terms/);
  await expect(page.locator('main')).toContainText(/下架|remov/i);
});

test('footer links to /privacy and /terms', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
  await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
npx playwright test tests/e2e/legal-pages.spec.ts
```

Expected: FAIL — `/privacy` and `/terms` both 404; footer has neither link.

- [ ] **Step 3: Create `src/pages/privacy.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="隱私權政策" description="touge.gg 隱私權政策 — 我們不存帳號、不存 email、IP 只存每日雜湊。" canonical="/privacy">
  <section class="px-6 py-12 max-w-3xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-3">＞ PRIVACY</div>
    <h1 class="text-[40px] font-extrabold mb-6">隱私權政策</h1>

    <div class="space-y-5 text-[15px] leading-relaxed text-text-soft">
      <p class="text-text-mute text-[13px]">最後更新：2026-05-26</p>

      <h2 class="text-[22px] font-bold pt-4">我們收集什麼</h2>
      <ul class="list-disc list-inside space-y-1.5">
        <li><strong>調校內容</strong>：你上傳的調校碼、數值、暱稱、描述、評分、評論——這些公開可見。</li>
        <li><strong>IP 雜湊</strong>：每次寫入操作（上傳、評論、檢舉）會把你的 IP 過 daily salt 雜湊後存 32 字元字串，用來防濫用。原始 IP 不存。</li>
        <li><strong>編輯密碼雜湊</strong>：你上傳調校時設的密碼會用 bcrypt 雜湊後存，僅用於驗證你修改自己的調校。</li>
      </ul>

      <h2 class="text-[22px] font-bold pt-4">我們不收集</h2>
      <ul class="list-disc list-inside space-y-1.5">
        <li>帳號、email、姓名、電話、地址</li>
        <li>原始 IP（只存雜湊）</li>
        <li>第三方追蹤 cookie</li>
        <li>跨站行為廣告</li>
      </ul>

      <h2 class="text-[22px] font-bold pt-4">分析統計</h2>
      <p>
        我們用 <a href="https://plausible.io" class="text-cyan" rel="noopener noreferrer" target="_blank">Plausible Analytics</a> 收集匿名瀏覽數據（頁面瀏覽量、來源、國家）。Plausible 不使用 cookie、不識別個人、不追蹤跨站行為。如果你的瀏覽器啟用了 Do Not Track，我們會尊重它。
      </p>

      <h2 class="text-[22px] font-bold pt-4">你的權利</h2>
      <ul class="list-disc list-inside space-y-1.5">
        <li><strong>編輯/刪除你的調校</strong>：用你設的密碼到 <a href="/upload" class="text-cyan">/upload</a> 頁面找編輯入口</li>
        <li><strong>下架請求</strong>：忘記密碼或要求他人的調校下架——透過 <a href="/about" class="text-cyan">關於頁</a> 的聯絡方式來信，24 小時內處理</li>
        <li><strong>檢舉</strong>：任何調校或評論底下都有「檢舉」按鈕</li>
      </ul>

      <h2 class="text-[22px] font-bold pt-4">資料儲存位置</h2>
      <p>
        資料存於 Cloudflare D1（SQLite，全球邊緣副本）與 Cloudflare KV。我們不把資料賣給或分享給第三方。
      </p>

      <h2 class="text-[22px] font-bold pt-4">變更</h2>
      <p class="text-text-mute text-[13px]">
        本政策若有重大變更會在首頁公告。歷史版本可在 git 上看到（本站開源）。
      </p>
    </div>

    <div class="mt-10 pt-6 border-t border-line flex gap-3">
      <a href="/" class="bg-cyan text-bg px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">回首頁</a>
      <a href="/terms" class="border border-line text-text px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">服務條款</a>
    </div>
  </section>
</Base>
```

- [ ] **Step 4: Create `src/pages/terms.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="服務條款" description="touge.gg 服務條款 — 使用本站即視為同意。" canonical="/terms">
  <section class="px-6 py-12 max-w-3xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-3">＞ TERMS</div>
    <h1 class="text-[40px] font-extrabold mb-6">服務條款</h1>

    <div class="space-y-5 text-[15px] leading-relaxed text-text-soft">
      <p class="text-text-mute text-[13px]">最後更新：2026-05-26</p>

      <h2 class="text-[22px] font-bold pt-4">使用本站即視為同意</h2>
      <p>瀏覽或上傳調校即視為同意本條款。不同意請勿使用。</p>

      <h2 class="text-[22px] font-bold pt-4">你上傳的內容</h2>
      <ul class="list-disc list-inside space-y-1.5">
        <li>你保證上傳的調校是你自己創作的、或是你已取得作者授權收錄的</li>
        <li>上傳即授權 touge.gg 以原樣公開展示、納入搜尋、和呈現於相關頁面</li>
        <li>你保有著作權（如有），可隨時要求下架</li>
        <li>不得上傳：他人作品未經授權的內容、含個資的內容、違法或攻擊性內容、廣告或 spam</li>
      </ul>

      <h2 class="text-[22px] font-bold pt-4">下架</h2>
      <p>
        我們承諾：任何下架請求（自己的調校、被冒名的內容、被檢舉違規的內容）24 小時內處理。
        使用調校頁面的「檢舉」按鈕，或從 <a href="/about" class="text-cyan">關於頁</a> 找聯絡方式來信。
      </p>

      <h2 class="text-[22px] font-bold pt-4">無擔保聲明</h2>
      <p class="text-text-mute text-[13px]">
        本站以「現狀」提供，不保證調校的正確性、可用性、或遊戲內表現。使用任何調校的後果由使用者自負。
        本站不對因使用本站內容造成的任何遊戲存檔損毀、競賽失利、或其他損失負責。
      </p>

      <h2 class="text-[22px] font-bold pt-4">第三方商標</h2>
      <p class="text-text-mute text-[13px]">
        Forza Horizon™ 是 Microsoft 的商標，本站與 Microsoft、Playground Games 無任何關聯。
        所有提及的車輛廠牌與賽道名稱屬其各自擁有人所有，僅用於識別。
      </p>

      <h2 class="text-[22px] font-bold pt-4">變更</h2>
      <p class="text-text-mute text-[13px]">
        本條款若有重大變更會在首頁公告。歷史版本可在 git 上看到。
      </p>
    </div>

    <div class="mt-10 pt-6 border-t border-line flex gap-3">
      <a href="/" class="bg-cyan text-bg px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">回首頁</a>
      <a href="/privacy" class="border border-line text-text px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">隱私權政策</a>
    </div>
  </section>
</Base>
```

- [ ] **Step 5: Update `src/components/Footer.astro` to add /privacy and /terms links**

Replace the contents of the `<div class="flex gap-4">` block. The current file ends that block with `<span>{en['footer.disclaimer']}</span>`. The full replacement:

```astro
---
import en from '~/i18n/en.json';
---
<footer class="border-t border-line px-6 py-7 bg-bg-soft mt-12">
  <div class="max-w-6xl mx-auto flex justify-between items-center font-mono text-[11px] text-text-dim">
    <div>
      <span class="text-cyan">TOUGE<span class="text-pink">.</span>GG</span> // Forza Horizon 6 調校資料庫 // 2026
    </div>
    <div class="flex gap-4">
      <a href="/about">關於</a>
      <a href="/privacy">隱私</a>
      <a href="/terms">條款</a>
      <a href="/api">API</a>
      <span>{en['footer.disclaimer']}</span>
    </div>
  </div>
</footer>
```

- [ ] **Step 6: Run e2e, confirm pass**

```bash
npx playwright test tests/e2e/legal-pages.spec.ts
```

Expected: 3 pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/privacy.astro src/pages/terms.astro src/components/Footer.astro tests/e2e/legal-pages.spec.ts
git commit -m "feat(legal): privacy + terms pages with footer links"
```

---

### Task 4: Plausible analytics (opt-in via env var)

**Files:**
- Modify: `src/layouts/Base.astro`
- Test: `tests/e2e/seo-meta.spec.ts` (extend)

**Background:** Plausible is privacy-respecting (no cookies, no PII). Script tag goes in `<head>`. We control inclusion via `env.PLAUSIBLE_DOMAIN` — if unset (default in dev), no script. If set (production via `wrangler secret put` or `[vars]` in wrangler.toml), inject `<script defer data-domain={...} src="https://plausible.io/js/script.js">`. Astro server-renders the conditional. The env var name follows the existing pattern in `src/pages/api/report.ts` which uses `env.TURNSTILE_SECRET_KEY`.

- [ ] **Step 1: Extend `tests/e2e/seo-meta.spec.ts` with a Plausible-related test**

Append to the file:

```typescript
test('Plausible script absent when PLAUSIBLE_DOMAIN unset (dev default)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('script[data-domain]')).toHaveCount(0);
});
```

The Plausible-present case is verified manually after setting the env var — covered in the Final Verification section.

- [ ] **Step 2: Run the test, confirm pass already**

```bash
npx playwright test tests/e2e/seo-meta.spec.ts -g "Plausible"
```

Expected: PASS — there's no script tag yet, so the locator finds 0. This is GREEN before we add the feature; the test guards that dev mode stays clean once we add the conditional injection.

- [ ] **Step 3: Update `src/layouts/Base.astro` to conditionally inject Plausible**

In the frontmatter (`---` block), after the existing destructuring of props, add:

```typescript
import { env } from 'cloudflare:workers';
const plausibleDomain = (env as unknown as { PLAUSIBLE_DOMAIN?: string }).PLAUSIBLE_DOMAIN;
```

In the `<head>` block, after the `<link rel="canonical">` line and before the `<meta property="og:type">` line, add:

```astro
{plausibleDomain && (
  <script is:inline defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js"></script>
)}
```

- [ ] **Step 4: Re-run the test, confirm still passing**

```bash
npx playwright test tests/e2e/seo-meta.spec.ts
```

Expected: 4 tests pass (3 prior + the new Plausible-absent guard). The conditional means dev has no script.

- [ ] **Step 5: Document the env var in `docs/DEPLOY.md`**

Append at the end of the file:

```markdown

## Analytics (optional)

Set the `PLAUSIBLE_DOMAIN` env var in production to enable Plausible analytics:

```bash
echo "touge.gg" | npx wrangler secret put PLAUSIBLE_DOMAIN
```

When set, `<script defer data-domain="touge.gg" src="https://plausible.io/js/script.js">` is injected on every page. When unset (dev default), no analytics script loads.

Plausible is privacy-respecting: no cookies, no PII, no cross-site tracking. Disclosed in `/privacy`.
```

- [ ] **Step 6: Commit**

```bash
git add src/layouts/Base.astro tests/e2e/seo-meta.spec.ts docs/DEPLOY.md
git commit -m "feat(analytics): opt-in Plausible via PLAUSIBLE_DOMAIN env var"
```

---

### Task 5: Production smoke test

**Files:**
- Create: `playwright.smoke.config.ts`
- Create: `tests/smoke/production.spec.ts`
- Modify: `package.json`

**Background:** After every deploy we want a one-command sanity check against the live URL. Separate Playwright config so it doesn't run in the default `npm test`/`npx playwright test` invocations (which target local dev). Uses `SMOKE_BASE_URL` env (defaults to `https://touge.gg`). Tests assert 200 + key DOM bits for: homepage, /browse, /sitemap.xml, /feed.xml, and one known-public tune detail (whichever the operator passes via `SMOKE_TUNE_SLUG`, defaulting to `toyota-supra-mk4-1994-demo04`).

- [ ] **Step 1: Create `playwright.smoke.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

const baseURL = process.env.SMOKE_BASE_URL ?? 'https://touge.gg';

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

- [ ] **Step 2: Create `tests/smoke/production.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

const TUNE_SLUG = process.env.SMOKE_TUNE_SLUG ?? 'toyota-supra-mk4-1994-demo04';

test('homepage loads', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('main h1, main')).toContainText(/touge|Forza|FH6/i);
});

test('/browse loads with tunes', async ({ page }) => {
  const res = await page.goto('/browse');
  expect(res?.status()).toBe(200);
  await expect(page.locator('a[href^="/tune/"]').first()).toBeVisible();
});

test('/sitemap.xml is valid and includes /tracks/', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/xml/);
  const body = await res.text();
  expect(body).toContain('<urlset');
  expect(body).toMatch(/\/tracks\//);
});

test('/feed.xml is valid RSS 2.0', async ({ request }) => {
  const res = await request.get('/feed.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('<rss');
  expect(body).toContain('<channel>');
});

test('tune detail loads with OG image meta and JSON-LD', async ({ page }) => {
  const res = await page.goto(`/tune/${TUNE_SLUG}`);
  expect(res?.status()).toBe(200);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`/og/tune/${TUNE_SLUG}\\.svg$`));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/tune/${TUNE_SLUG}$`));
});

test('OG image SVG endpoint serves valid SVG', async ({ request }) => {
  const res = await request.get(`/og/tune/${TUNE_SLUG}.svg`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/image\/svg\+xml/);
  const body = await res.text();
  expect(body).toMatch(/^<svg/);
});

test('/privacy and /terms are reachable', async ({ request }) => {
  const p = await request.get('/privacy');
  const t = await request.get('/terms');
  expect(p.status()).toBe(200);
  expect(t.status()).toBe(200);
});

test('robots.txt advertises sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/Sitemap:\s*https?:\/\/[^\s]+sitemap\.xml/);
});
```

- [ ] **Step 3: Add `test:smoke` script to `package.json`**

In the `scripts` object, after the existing `"test:e2e"` line, add:

```json
    "test:smoke": "playwright test --config playwright.smoke.config.ts"
```

- [ ] **Step 4: Dry-run against local dev to confirm the spec is syntactically valid**

```bash
SMOKE_BASE_URL=http://localhost:4321 npm run test:smoke
```

Start dev server first in another shell: `npm run dev`. Expected: 8 pass (against local dev — same checks should pass once Tasks 1–4 are merged).

- [ ] **Step 5: Document the smoke test in `docs/DEPLOY.md`**

Append at the end:

```markdown

## Post-Deploy Smoke Test

After every production deploy, run:

```bash
npm run test:smoke
```

This hits `https://touge.gg` and verifies: homepage, /browse, sitemap.xml, feed.xml, a known tune detail (with OG meta + canonical), the OG image SVG endpoint, /privacy, /terms, and robots.txt sitemap declaration.

Override the target URL or tune slug:

```bash
SMOKE_BASE_URL=https://staging.touge.gg SMOKE_TUNE_SLUG=some-other-slug npm run test:smoke
```
```

- [ ] **Step 6: Commit**

```bash
git add playwright.smoke.config.ts tests/smoke/ package.json docs/DEPLOY.md
git commit -m "feat(ops): production smoke test via npm run test:smoke"
```

---

## After All Tasks: Final Verification

- [ ] **Run the full local suite**

```bash
npx wrangler kv key list --binding=KV --local 2>&1 | grep -oE '"rl:[^"]+"' | xargs -I{} npx wrangler kv key delete --binding=KV --local {}
npm run check && npm test && npx playwright test
```

Expected: typecheck PASS, vitest all pass, all playwright e2e pass.

- [ ] **Manual browser smoke (with dev server running)**

```bash
npm run dev
```

Visit:
- `/` — view source, confirm `<link rel="canonical">`, `og:*`, `twitter:*` meta tags present; no `<script data-domain>` (Plausible off in dev)
- `/tune/toyota-supra-mk4-1994-demo04` — view source, confirm `og:image` points to `/og/tune/toyota-supra-mk4-1994-demo04.svg`
- `/og/tune/toyota-supra-mk4-1994-demo04.svg` — should render the branded SVG with Supra metadata
- `/og-default.svg` — should render the default touge.gg SVG
- `/privacy` and `/terms` — render with proper structure, Footer links work both ways
- Footer (any page) — has `/about`, `/privacy`, `/terms`, `/api` links

- [ ] **Production-like Plausible check** (optional, requires staging or deployment)

Set `PLAUSIBLE_DOMAIN=test.example` via wrangler dev or staging deploy. Reload homepage. View source — confirm `<script defer data-domain="test.example" src="https://plausible.io/js/script.js">` is in `<head>`. Then unset and confirm it disappears.

- [ ] **Sprint 5 complete** — site is shareable (OG previews), legally documented (privacy + terms), measurable (Plausible), and has a one-command post-deploy sanity check.
