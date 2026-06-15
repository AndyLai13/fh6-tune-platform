# Car Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 `/car/[slug]` 補上「關於這台車」描述段落，避免 Google 判定為薄內容；同時上 GSC 開始累積 SEO 資料。

**Architecture:** cars 表新增 6 個 nullable 欄位（5 結構化 + 1 完整段落）。Render 三層 fallback：手寫段落 > 結構化欄位組裝句 > 不渲染。LLM 內容由 subagent 分國別群生成、輸出 SQL pack 後人工 apply。

**Tech Stack:** Astro v6 + Cloudflare Workers + D1 (SQLite) + Tailwind + Vitest + Playwright + wrangler v4。

**Spec reference:** `docs/superpowers/specs/2026-06-15-car-descriptions-design.md`

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `migrations/0008_car_descriptions.sql` | Create | 加 6 個 nullable 欄位 |
| `src/lib/db.ts` | Modify | 擴 `CarRow` 型別、`getCarBySlug` 回傳型別 |
| `src/lib/car-i18n.ts` | Create | `COUNTRY_ZH` / `BODY_STYLE_ZH` map |
| `src/pages/car/[slug].astro` | Modify | 三層 fallback render |
| `src/env.d.ts` | Modify | 加 `GOOGLE_SITE_VERIFICATION` |
| `src/layouts/Base.astro` | Modify | conditional GSC meta tag |
| `scripts/car-meta-2026-06-15.sql` | Create | subagent 產出 + 5 台手寫 description_zh |
| `tests/unit/car-i18n.test.ts` | Create | map fallback 行為 |
| `tests/e2e/car-pages.spec.ts` | Modify | Layer 1 / Layer 2 / Layer 3 render |

---

## Task 1: Schema migration

**Files:**
- Create: `migrations/0008_car_descriptions.sql`

- [ ] **Step 1: 建立 migration 檔**

```sql
-- migrations/0008_car_descriptions.sql
-- Adds car metadata columns for SEO description rendering.
-- All columns nullable so existing 67 rows remain valid.

ALTER TABLE cars ADD COLUMN chassis_code TEXT;
ALTER TABLE cars ADD COLUMN body_style TEXT;
ALTER TABLE cars ADD COLUMN country TEXT;
ALTER TABLE cars ADD COLUMN era TEXT;
ALTER TABLE cars ADD COLUMN notable_for TEXT;
ALTER TABLE cars ADD COLUMN description_zh TEXT;
```

- [ ] **Step 2: Apply 到 local D1**

Run:
```bash
npx wrangler d1 execute fh6-tune-platform-prod --local --file=migrations/0008_car_descriptions.sql
```

Expected: `Executed N commands` 無 error。

- [ ] **Step 3: 驗證 schema**

Run:
```bash
npx wrangler d1 execute fh6-tune-platform-prod --local --command="SELECT chassis_code, body_style, country, era, notable_for, description_zh FROM cars LIMIT 1;"
```

Expected: 回 1 row、全 6 個欄位皆為 `null`、無 error。

- [ ] **Step 4: Commit**

```bash
git add migrations/0008_car_descriptions.sql
git commit -m "feat(db): migration 0008 adds car description columns

Six nullable columns on cars table for SEO content depth:
chassis_code, body_style, country, era, notable_for, description_zh.
All nullable; existing rows unaffected."
```

---

## Task 2: 建立 car-i18n.ts map

**Files:**
- Create: `src/lib/car-i18n.ts`
- Create: `tests/unit/car-i18n.test.ts`

- [ ] **Step 1: 寫失敗 unit test**

```typescript
// tests/unit/car-i18n.test.ts
import { describe, it, expect } from 'vitest';
import { COUNTRY_ZH, BODY_STYLE_ZH } from '~/lib/car-i18n';

describe('car-i18n maps', () => {
  it('maps known countries to Chinese', () => {
    expect(COUNTRY_ZH['Japan']).toBe('日本');
    expect(COUNTRY_ZH['Germany']).toBe('德國');
    expect(COUNTRY_ZH['USA']).toBe('美國');
    expect(COUNTRY_ZH['Italy']).toBe('義大利');
    expect(COUNTRY_ZH['UK']).toBe('英國');
    expect(COUNTRY_ZH['France']).toBe('法國');
    expect(COUNTRY_ZH['Sweden']).toBe('瑞典');
  });

  it('maps known body styles to Chinese', () => {
    expect(BODY_STYLE_ZH['Coupe']).toBe('雙門跑車');
    expect(BODY_STYLE_ZH['Hatchback']).toBe('掀背車');
    expect(BODY_STYLE_ZH['Sedan']).toBe('房車');
    expect(BODY_STYLE_ZH['SUV']).toBe('SUV');
    expect(BODY_STYLE_ZH['Roadster']).toBe('敞篷跑車');
  });

  it('returns undefined for unknown keys (caller can fall back to raw)', () => {
    expect(COUNTRY_ZH['Atlantis']).toBeUndefined();
    expect(BODY_STYLE_ZH['Flying Saucer']).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- car-i18n`
Expected: FAIL with `Cannot find module '~/lib/car-i18n'`

- [ ] **Step 3: 實作 map**

```typescript
// src/lib/car-i18n.ts
export const COUNTRY_ZH: Record<string, string> = {
  Japan: '日本',
  Germany: '德國',
  USA: '美國',
  Italy: '義大利',
  UK: '英國',
  France: '法國',
  Sweden: '瑞典',
};

export const BODY_STYLE_ZH: Record<string, string> = {
  Coupe: '雙門跑車',
  Hatchback: '掀背車',
  Sedan: '房車',
  SUV: 'SUV',
  Roadster: '敞篷跑車',
};
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- car-i18n`
Expected: PASS (3 tests)

- [ ] **Step 5: 跑全套 unit test 確認沒回歸**

Run: `npm test 2>&1 | tail -8`
Expected: `Test Files  12 passed (12) / Tests  62 passed (62)`（既有 11 files / 59 tests + 1 新 file / 3 新 tests）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/car-i18n.ts tests/unit/car-i18n.test.ts
git commit -m "feat(i18n): country and body style zh-TW maps

Used by /car/[slug] Layer 2 fallback to render structured
country/body_style fields (stored as English) in Chinese."
```

---

## Task 3: 擴 CarRow 型別 + getCarBySlug

**Files:**
- Modify: `src/lib/db.ts:32-37`

- [ ] **Step 1: 加 CarRow 型別並改 getCarBySlug**

替換 `src/lib/db.ts` 中 `getCarBySlug` / `getCarById` 兩段：

```typescript
export type CarRow = {
  id: number;
  year: number;
  make: string;
  model: string;
  slug: string;
  chassis_code: string | null;
  body_style: string | null;
  country: string | null;
  era: string | null;
  notable_for: string | null;
  description_zh: string | null;
};

export async function getCarBySlug(db: D1Database, slug: string) {
  return db.prepare('SELECT * FROM cars WHERE slug = ?').bind(slug).first<CarRow>();
}

export async function getCarById(db: D1Database, id: number) {
  return db.prepare('SELECT * FROM cars WHERE id = ?').bind(id).first<CarRow>();
}
```

- [ ] **Step 2: Type check**

Run: `npm run check 2>&1 | tail -15`
Expected: `Result (54 files): - 1 error - ...` 1 個 error 是既有 `feed.xml.ts` 的 `t: any`，**不能**有跟 db.ts / car/[slug].astro 相關的新 error。

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "refactor(db): CarRow type includes new description columns

Extends getCarBySlug/getCarById return type to surface
chassis_code, body_style, country, era, notable_for, description_zh."
```

---

## Task 4: 失敗的 e2e tests for Layer 1 / Layer 2 render

**Files:**
- Modify: `tests/e2e/car-pages.spec.ts`

- [ ] **Step 1: 加 2 個 e2e test**

於 `tests/e2e/car-pages.spec.ts` 末尾追加：

```typescript
test('/car/{slug} renders hand-written description (Layer 1) for hero car', async ({ page }) => {
  await page.goto('/car/nissan-skyline-gtr-r34-1999');
  // 手寫段落含 R34 chassis code 字串（任何手寫文案應提及）
  const main = page.locator('main');
  await expect(main).toContainText('R34');
  // 不該出現組裝句結構（Layer 2 標誌「（底盤」）
  const html = await main.innerHTML();
  expect(html).not.toContain('（底盤 R34）是');
});

test('/car/{slug} renders structured assembly (Layer 2) for auto-pipeline car', async ({ page }) => {
  // 選一台預期沒手寫 description_zh、但有 notable_for 的車
  await page.goto('/car/ferrari-f40-1987');
  const main = page.locator('main');
  // Layer 2 組裝句固定有「（底盤」或「的{country}{body_style}」其中之一
  const text = await main.textContent();
  expect(text).toMatch(/（底盤 [A-Z0-9]+）|是[\s\S]+?的[一-鿿]/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx playwright test tests/e2e/car-pages.spec.ts --reporter=line 2>&1 | tail -20`
Expected: 2 個新測試 FAIL（因為 render code 還沒寫 + DB 沒資料）；既有 5 個測試仍應 PASS。

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/e2e/car-pages.spec.ts
git commit -m "test(e2e): failing tests for /car/[slug] description rendering

Layer 1 (hand-written description_zh) and Layer 2 (structured
assembly) fallback tests. Will pass after render code + SQL
data are in place."
```

---

## Task 5: 實作 /car/[slug] render layer

**Files:**
- Modify: `src/pages/car/[slug].astro:9-58`

- [ ] **Step 1: 加 import + map lookup**

修改 `src/pages/car/[slug].astro` 開頭 import block，加：

```astro
---
import Base from '~/layouts/Base.astro';
import TuneCard from '~/components/TuneCard.astro';
import { getCarBySlug, listTunesForCar } from '~/lib/db';
import { COUNTRY_ZH, BODY_STYLE_ZH } from '~/lib/car-i18n';
import { env } from 'cloudflare:workers';
```

- [ ] **Step 2: 計算中文版 country / body_style**

在 `const carLabel = ...` 之前加：

```astro
const countryZh = car.country ? (COUNTRY_ZH[car.country] ?? car.country) : null;
const bodyStyleZh = car.body_style ? (BODY_STYLE_ZH[car.body_style] ?? car.body_style) : null;
```

- [ ] **Step 3: 插入 fallback render block**

在 `<h1>{carLabel}</h1>` 與 `<div class="font-mono text-[12px] text-text-mute mb-8">` 之間插入：

```astro
    {car.description_zh ? (
      <div class="max-w-2xl mt-4 mb-6 text-text-soft text-[15px] leading-relaxed">
        <p>{car.description_zh}</p>
      </div>
    ) : car.notable_for ? (
      <div class="max-w-2xl mt-4 mb-6 text-text-soft text-[15px] leading-relaxed">
        <p>
          {carLabel}
          {car.chassis_code && `（底盤 ${car.chassis_code}）`}
          是 {car.era ?? countryZh ?? ''}
          {bodyStyleZh && ` 的${countryZh ?? ''}${bodyStyleZh}`}
          。{car.notable_for}。
        </p>
      </div>
    ) : null}
```

- [ ] **Step 4: Type check**

Run: `npm run check 2>&1 | tail -10`
Expected: 唯一 error 仍是 `feed.xml.ts` 既有問題；不能有 car/[slug] 新 error。

- [ ] **Step 5: 跑既有 e2e 確認沒打壞**

Run: `npx playwright test tests/e2e/car-pages.spec.ts --reporter=line -g "renders car header|empty state|unknown returns 404|canonicalises|self-canonical" 2>&1 | tail -10`
Expected: 既有 5 測試 PASS。新加的 2 測試仍 FAIL（沒資料）。

- [ ] **Step 6: Layer 3 fallback 程式碼自我審查**

讀 `src/pages/car/[slug].astro` 剛加的 fallback block，確認當 `car.description_zh === null && car.notable_for === null` 時，JSX 三元運算式最終 evaluate 到 `: null`、不會 render `<div>`。這層由程式碼結構保證，不額外加 unit test（避免為了 testability 強行抽 helper）。

- [ ] **Step 7: Commit**

```bash
git add src/pages/car/[slug].astro
git commit -m "feat(car-landing): three-layer description fallback render

Layer 1: description_zh (hand-written hero cars)
Layer 2: assembled sentence from chassis_code/era/country/body_style/notable_for
Layer 3: no render (thin content avoidance)

Awaiting SQL data pack to populate columns."
```

---

## Task 6: Subagent 分批生成 62 台自動車的結構化欄位

**Files:**
- Create: `scripts/car-meta-2026-06-15.sql`

> **執行者注意：** 這個 task 用 Agent tool 派 subagent。每個 country 群一次 subagent call，回傳 JSON array，主對話彙整為 SQL UPDATE。

- [ ] **Step 1: 先讀 cars-seed 確認車型清單**

Run:
```bash
grep -E "^\s+\{ year:" src/data/cars-seed.ts | head -80
```

並查 prod DB 看實際全部 67 台（含 0006 migration 加的）：
```bash
npx wrangler d1 execute fh6-tune-platform-prod --local --command="SELECT year, make, model, slug FROM cars ORDER BY make, year;" --json | head -100
```

- [ ] **Step 2: 列出 5 台手寫車並把剩餘車按 country group 分類**

主對話內手動分組（執行者根據 step 1 輸出）。寫成 `scripts/car-meta-input.json`（暫存，不 commit）：

```json
{
  "handwritten": [
    "nissan-skyline-gtr-r34-1999",
    "toyota-supra-mk4-1994",
    "mazda-rx7-fd3s-1992",
    "honda-nsx-r-2002",
    "porsche-911-gt3-rs-992-2023"
  ],
  "groups": {
    "Japan": ["nissan-...", "toyota-...", ...],
    "Germany": [...],
    "USA": [...],
    ...
  }
}
```

- [ ] **Step 3: 對每個 country group 派一個 subagent**

對 Japan / Germany / USA / Italy / UK / France / Sweden / Other 各派一次。Prompt 模板：

```
You will generate SEO metadata for {N} {country} cars in Forza Horizon 6.

For each car (slug + year/make/model 列在下方), return a JSON object:
{
  "slug": "<exact slug>",
  "chassis_code": "<short code like 'R34', 'FD3S', '992', or null if not applicable>",
  "body_style": "<one of: Coupe, Hatchback, Sedan, SUV, Roadster>",
  "country": "<exact value '{country}'>",
  "era": "<one of: '80s', '90s JDM', '90s euro', '2000s muscle', '2010s', '2010s hypercar', 'modern', 'classic', 'pre-war'>",
  "notable_for": "<one Traditional Chinese sentence, max 50 characters, no marketing fluff, factual highlight only>"
}

Return ONLY a JSON array, no markdown, no commentary.

Cars:
- 1999 Nissan Skyline GT-R R34 (slug: nissan-skyline-gtr-r34-1999)
- ...
```

每個 subagent call 用 schema 強制 JSON output：

```json
{
  "type": "object",
  "properties": {
    "cars": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "slug": {"type": "string"},
          "chassis_code": {"type": ["string", "null"]},
          "body_style": {"type": "string", "enum": ["Coupe", "Hatchback", "Sedan", "SUV", "Roadster"]},
          "country": {"type": "string"},
          "era": {"type": "string", "enum": ["80s", "90s JDM", "90s euro", "2000s muscle", "2010s", "2010s hypercar", "modern", "classic", "pre-war"]},
          "notable_for": {"type": "string", "maxLength": 50}
        },
        "required": ["slug", "body_style", "country", "era", "notable_for"]
      }
    }
  },
  "required": ["cars"]
}
```

- [ ] **Step 4: 每個 country group 結果輸出後，主對話人工抽驗 3 筆**

檢查重點：
- `notable_for` 有沒有事實錯誤（特別注意年份、底盤代號）
- `era` 是否落在允許值內
- `chassis_code` 不要寫成全名（要 `R34` 不要 `Skyline R34`）

若發現問題，重派該 group 的 subagent（不要 mass-fix，因為一筆錯通常意味著 prompt 漂移）。

- [ ] **Step 5: 彙整全部結果為 SQL pack**

格式：

```sql
-- scripts/car-meta-2026-06-15.sql
-- Generated 2026-06-15. 67 cars total: 5 hand-written description_zh, 62 structured-only.

-- ============ Japan ============
UPDATE cars SET chassis_code = 'R34', body_style = 'Coupe', country = 'Japan',
  era = '90s JDM', notable_for = 'Skyline GT-R 系列最後一代搭載 RB26DETT 直六雙渦輪'
WHERE slug = 'nissan-skyline-gtr-r34-1999';

UPDATE cars SET chassis_code = 'JZA80', body_style = 'Coupe', country = 'Japan',
  era = '90s JDM', notable_for = '搭載 2JZ-GTE 引擎，改裝潛力極高'
WHERE slug = 'toyota-supra-mk4-1994';

-- ... (剩餘 65 筆)
```

- [ ] **Step 6: Commit SQL pack（資料填寫前的 skeleton）**

```bash
git add scripts/car-meta-2026-06-15.sql
git commit -m "data(cars): structured metadata pack for 67 cars

LLM-generated chassis_code/body_style/country/era/notable_for
for all 67 cars, grouped by country. Manual spot-check pass on
each group before merge."
```

---

## Task 7: 5 台手寫車的 description_zh

**Files:**
- Modify: `scripts/car-meta-2026-06-15.sql`

> **執行者注意：** 5 台手寫車已在 task 6 填了結構化欄位，這個 task 加 `description_zh = '...'` 句子。執行者（assistant）自己寫草稿、與使用者快速 review。

- [ ] **Step 1: 為 5 台車寫 80–120 字段落**

範例（執行者實際撰寫時需依據對該車的車史知識，以下僅為格式樣本）：

```sql
UPDATE cars SET description_zh = '1999 年問世的 Nissan Skyline GT-R R34 是 GT-R 系列在 R 底盤時代的最後一代。搭載 RB26DETT 2.6L 直六雙渦輪引擎，原廠帳面 280 hp 但實測更高。ATTESA E-TS Pro 四驅與 Super HICAS 四輪轉向讓它在跑山與賽道都極具底盤潛力。Forza Horizon 6 中 R34 的 PI 從 A 級可一路衝到 S2，touge 與 drift 是主流調校方向。'
WHERE slug = 'nissan-skyline-gtr-r34-1999';
```

5 台都填入後追加在 `scripts/car-meta-2026-06-15.sql` 結尾。

- [ ] **Step 2: 快速 review（執行者與使用者對話確認）**

執行者讀出 5 段內容、使用者確認 OK。

- [ ] **Step 3: Commit**

```bash
git add scripts/car-meta-2026-06-15.sql
git commit -m "data(cars): hand-written description_zh for 5 hero cars

R34, Supra MK4, RX-7 FD, NSX-R, Porsche 992 GT3 RS.
Each ~80-120 zh-TW chars covering chassis, drivetrain, tuning
direction in Forza Horizon 6."
```

---

## Task 8: Apply SQL pack 到 local D1 + 跑 e2e

**Files:** (none, just data + verification)

- [ ] **Step 1: Apply 到 local**

```bash
npx wrangler d1 execute fh6-tune-platform-prod --local --file=scripts/car-meta-2026-06-15.sql
```

Expected: 67 個 UPDATE 全 success、無 error。

- [ ] **Step 2: 驗證資料**

```bash
npx wrangler d1 execute fh6-tune-platform-prod --local --command="SELECT COUNT(*) FROM cars WHERE notable_for IS NOT NULL;"
```
Expected: 67。

```bash
npx wrangler d1 execute fh6-tune-platform-prod --local --command="SELECT COUNT(*) FROM cars WHERE description_zh IS NOT NULL;"
```
Expected: 5。

- [ ] **Step 3: 跑全部 car-pages e2e**

```bash
npx playwright test tests/e2e/car-pages.spec.ts --reporter=line 2>&1 | tail -10
```
Expected: 7 / 7 PASS（既有 5 + Layer 1 + Layer 2）。

- [ ] **Step 4: 視覺確認**（執行者自行決定是否截圖）

```bash
npm run dev &
sleep 8
curl -s http://localhost:4321/car/nissan-skyline-gtr-r34-1999 | grep -A 2 'leading-relaxed' | head -10
kill %1
```
Expected: 第一段含手寫描述，不是組裝句。

```bash
curl -s http://localhost:4321/car/ferrari-f40-1987 | grep -A 2 'leading-relaxed' | head -10
```
Expected: 含「（底盤」字串（Layer 2 組裝句）。

---

## Task 9: GSC meta tag code

**Files:**
- Modify: `src/env.d.ts`
- Modify: `src/layouts/Base.astro`

- [ ] **Step 1: 擴 env type**

於 `src/env.d.ts` 的 `ImportMetaEnv` 介面內加：

```typescript
readonly GOOGLE_SITE_VERIFICATION?: string;
```

- [ ] **Step 2: Base.astro 加 conditional meta**

於 `src/layouts/Base.astro` 的 `<head>` 區塊（建議在 `<link rel="canonical">` 之後）插入：

```astro
{import.meta.env.GOOGLE_SITE_VERIFICATION && (
  <meta name="google-site-verification" content={import.meta.env.GOOGLE_SITE_VERIFICATION} />
)}
```

- [ ] **Step 3: 加 e2e test 確保未設定時不渲染**

於 `tests/e2e/seo-meta.spec.ts` 末尾追加（注意這個檔案 git status 已是 modified, WIP 不要動其他既有 test）：

```typescript
test('Google site verification meta absent when GOOGLE_SITE_VERIFICATION unset (dev default)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="google-site-verification"]')).toHaveCount(0);
});
```

- [ ] **Step 4: 跑該 test 確認 PASS**

```bash
npx playwright test tests/e2e/seo-meta.spec.ts --reporter=line -g "Google site verification" 2>&1 | tail -5
```
Expected: 1 PASS。

- [ ] **Step 5: Type check**

```bash
npm run check 2>&1 | tail -10
```
Expected: 不新增 error。

- [ ] **Step 6: Commit**

```bash
git add src/env.d.ts src/layouts/Base.astro tests/e2e/seo-meta.spec.ts
git commit -m "feat(seo): GOOGLE_SITE_VERIFICATION meta tag for GSC ownership

Renders <meta name=\"google-site-verification\"> when secret set;
absent in dev. Required for Search Console property verification."
```

---

## Task 10: Apply 到 prod D1

**Files:** (none, prod-only action)

- [ ] **Step 1: 套用 schema migration**

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0008_car_descriptions.sql
```
Expected: success。

- [ ] **Step 2: 套用資料 pack**

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=scripts/car-meta-2026-06-15.sql
```
Expected: 67 個 UPDATE success。

- [ ] **Step 3: 驗證 prod 資料**

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --command="SELECT COUNT(*) AS notable_count FROM cars WHERE notable_for IS NOT NULL; SELECT COUNT(*) AS desc_count FROM cars WHERE description_zh IS NOT NULL;"
```
Expected: notable_count=67, desc_count=5。

---

## Task 11: GSC 註冊與部署

**Files:** (none beyond setting secret)

- [ ] **Step 1: 註冊 GSC property**

人工動作（執行者提示 user 自己做）：
1. 前往 https://search.google.com/search-console
2. Add property → URL prefix → 輸入 `https://fh6-tune-platform.badboyandy13.workers.dev`
3. 驗證方式選 `HTML tag`
4. 複製 `content="..."` 引號內的 token

- [ ] **Step 2: 設定 secret**

```bash
echo "<paste-gsc-token>" | npx wrangler secret put GOOGLE_SITE_VERIFICATION
```

- [ ] **Step 3: Build + deploy**

```bash
rm -rf dist .wrangler/deploy
npm run build
npx wrangler deploy
```
Expected: deploy 成功，URL 一樣 `https://fh6-tune-platform.badboyandy13.workers.dev`。

- [ ] **Step 4: GSC 驗證**

人工：
1. 回 GSC 點「驗證」按鈕
2. 應顯示「擁有權已驗證」

- [ ] **Step 5: 提交 sitemap**

GSC → Sitemaps → 輸入 `sitemap.xml` → 提交。

- [ ] **Step 6: URL Inspection 3 台代表車**

GSC → URL Inspection 分別輸入：
- `https://fh6-tune-platform.badboyandy13.workers.dev/car/nissan-skyline-gtr-r34-1999`
- `https://fh6-tune-platform.badboyandy13.workers.dev/car/toyota-supra-mk4-1994`
- `https://fh6-tune-platform.badboyandy13.workers.dev/car/porsche-911-gt3-rs-992-2023`

點「請求索引」。狀態應為「URL 不在 Google 中（待處理）」或「索引中」——非「已封鎖」或「軟性 404」。

- [ ] **Step 7: 跑 smoke test**

```bash
SMOKE_BASE_URL=https://fh6-tune-platform.badboyandy13.workers.dev npm run test:smoke 2>&1 | tail -10
```
Expected: 8 / 8 PASS（cold start 可能 retry 一次，OK）。

- [ ] **Step 8: 手動驗證 prod /car/ 頁面**

```bash
curl -s https://fh6-tune-platform.badboyandy13.workers.dev/car/nissan-skyline-gtr-r34-1999 | grep -oE 'leading-relaxed[^<]*<p>[^<]+' | head -2
```
Expected: 含手寫描述（R34 / RB26DETT / 跑山 等關鍵字）。

```bash
curl -s https://fh6-tune-platform.badboyandy13.workers.dev/car/ferrari-f40-1987 | grep -oE 'leading-relaxed[^<]*<p>[^<]+' | head -2
```
Expected: 含「（底盤」組裝句格式。

---

## 後續工作（不在此計畫 scope）

- Sprint 2 (2026-07-下旬)：依 GSC impression 資料挑下一批 5 台升級為手寫 description_zh
- 若 country / era 被搜尋量證明常見，考慮加篩選器 `/browse?era=90s+JDM`
- 為高流量手寫車生英文版（i18n sprint 準備）
