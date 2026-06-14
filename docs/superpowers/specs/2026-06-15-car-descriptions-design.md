# Car Descriptions — 內容深度補強（SEO content depth）

> **Date**: 2026-06-15
> **Author**: Andy（brainstorm with assistant）
> **Status**: spec approved, awaiting plan
> **Trigger**: `/car/[slug]` 上線後 Google helpful-content update 對「薄內容頁」越來越敏感——目前頁面只有 H1 + tune card grid，缺一段「關於這台車」的描述。需要在不為 67 台車手寫 67 段話的前提下，補上具備真實內容的描述段落。
> **Related files**: `src/pages/car/[slug].astro`、`src/lib/db.ts`（`getCarBySlug` 型別擴展）、`src/layouts/Base.astro`（GSC meta tag）、`migrations/`（新增 0008）

## 一、問題

- `/car/[slug]` 目前只有 H1（車型）+ tune card grid，沒有自然語言段落
- Google helpful-content update (2024+) 對「無內容只列表」型聚合頁越來越嚴格
- 直接用 Mad Libs 純模板（「{year} {make} {model} is a car」）會被偵測為薄內容、可能反而傷 SEO
- 67 台車全手寫 100 字段落 ≈ 30–60 小時，pre-launch 階段成本不合算
- 純 LLM 生整段塞進 DB 把「無事實基礎的合成內容」固化進資料層、未來難更新

## 二、目標

1. 為 5 台社群定番熱門車寫高品質手寫段落（SEO 主力 URL）
2. 為其餘 62 台車產生結構化 metadata 欄位（保底內容、未來可 reuse 於篩選 / 相關車推薦）
3. Render 層三層 fallback，**寧可不渲染也不渲染薄內容**
4. 提交 Google Search Console 並驗證所有權，開始累積 impression 資料
5. 4–6 週後依 GSC 資料挑下一批 5 台手寫車（Sprint 2）

## 三、Scope 決策（brainstorm 鎖定）

| 決策 | 結論 | 理由 |
|---|---|---|
| 第一批做多少台 | 分階段：5 台手寫 + 62 台自動 + 未來 5 台依 GSC | 安全邊際，避免一口氣手寫 10 台負擔太重 |
| 「手寫 5 台」選法 | 拍腦袋（R34 / Supra MK4 / RX-7 FD / NSX-R / GT3 RS） | 不等 GSC（GSC 要 4–6 週才有資料），同時跑 GSC |
| 儲存格式 | 加結構化欄位 + `description_zh` | fallback 不會空、未來相關車推薦可 reuse |
| LLM 來源 | 主對話內由 assistant 直接生成 SQL pack | 不需 API key / script / pipeline，一次性產出 |
| 執行方式 | 一個 subagent 分階段（按國別群）生 62 台 | 跨車一致性 > 並行速度；分階段允許品質中途攔截 |
| 是否做雙語 | 暫不（`description_en` 留給 i18n sprint） | 避免 schema 動兩次 |
| GSC 註冊時機 | 本 sprint 同步做 | 越早提交越早累積資料 |

## 四、Schema（migration 0008）

```sql
-- migrations/0008_car_descriptions.sql
ALTER TABLE cars ADD COLUMN chassis_code TEXT;     -- 'R34' / '992' / 'FD3S' / NULL
ALTER TABLE cars ADD COLUMN body_style TEXT;       -- 'Coupe' / 'Hatchback' / 'Sedan' / 'SUV' / 'Roadster'
ALTER TABLE cars ADD COLUMN country TEXT;          -- 'Japan' / 'Germany' / 'USA' / 'Italy' / 'UK' / 'France' / 'Sweden'
ALTER TABLE cars ADD COLUMN era TEXT;              -- '80s' / '90s JDM' / '2000s muscle' / 'modern hypercar' 等
ALTER TABLE cars ADD COLUMN notable_for TEXT;      -- 一句話亮點，限 1 句 / ≤50 字
ALTER TABLE cars ADD COLUMN description_zh TEXT;   -- 完整段落，80–120 字（5 台手寫車獨享）
```

**設計考量：**

- 全部 nullable — 不破壞既有 67 筆 cars row、不擋 deploy
- `chassis_code` 獨立而非塞 model 字串 — 玩家搜「R34」「FD3S」「992」是高 intent 查詢
- `era` 是字串而非 enum — Forza 涵蓋年代太雜，硬訂 enum 反而限制；prompt 中限制候選值維持一致性
- 不加 `engine` / `displacement` / `power_hp` — cars 表 scope 是「車型 metadata」，性能數據屬於 tune 個別變數
- 不加 `description_en` — 留給未來 i18n sprint

## 五、資料來源 & 內容工作流

### 兩種填法

```
5 台「拍腦袋手寫」車（高品質、SEO 主力）
  - description_zh = assistant 在主對話寫草稿 + Andy 過稿，80–120 字
  - chassis_code / body_style / country / era / notable_for = 同樣手填

62 台「自動 pipeline」車（保底結構化內容、不出薄頁）
  - description_zh = NULL（render 端用模板組裝）
  - chassis_code / body_style / country / era / notable_for = subagent 分階段生成
```

### 5 台手寫候選

| # | car slug | 理由 |
|---|---|---|
| 1 | `nissan-skyline-gtr-r34-1999` | R34 永遠是搜尋怪物 |
| 2 | `toyota-supra-mk4-1994` | 2JZ 不需要理由 |
| 3 | `mazda-rx7-fd3s-1992` | 中五究級信仰，目前已有 demo tune |
| 4 | `honda-nsx-r-2002` | 日系 mid-engine 代表 |
| 5 | `porsche-911-gt3-rs-992-2023` | 6/2 才修過資料，社群最新熱點 |

### 分階段 subagent 流程

```
Stage 1: subagent 生「Japan」群（~15 台）→ assistant 整理表格給 Andy review
   ↓ Andy 確認用詞、欄位值
Stage 2: subagent 同樣 prompt 改 country=Germany 繼續（~10 台）
   ↓
Stage 3: USA / Italy / UK / France / Sweden / 其他 依序進行
   ↓ 全部 67 台 ok
匯出 scripts/car-meta-2026-06-15.sql（一個 UPDATE 一行）
   ↓ Andy 套用
wrangler d1 execute fh6-tune-platform-prod --remote --file=scripts/car-meta-2026-06-15.sql
```

**為什麼用 subagent（而非主對話直接生 67 台）：**

- 主對話 context 不被 15k 輸出 token 撐爆
- subagent 用 JSON schema 強制輸出格式
- 跨車一致性 > 並行：同一 agent self-consistency 比跨 agent 強

**為什麼分階段（而非單 subagent 一次 67 台）：**

- 前 ~15 台就能攔下品質問題（用詞、欄位漂移），不用等到 67 台都生完
- subagent 內部 context 在第 50 台後可能漂移，按國別群限縮一致性風險

## 六、Render 層 fallback chain

`/car/[slug].astro` 在 H1 之後、tune grid 之前插一個描述段落：

```
Layer 1: description_zh 存在（5 台手寫車）
  → <p>{car.description_zh}</p>

Layer 2: notable_for 存在（62 台自動車）
  → 組裝句：「{year} {make} {model}（底盤 {chassis_code}）是 {era} 的 {country}{body_style}。{notable_for}。」
  範例：「1999 Nissan Skyline GT-R R34（底盤 R34）是 90s JDM 的日本 Coupe。Skyline GT-R 系列最後一代搭載 RB26DETT 直六雙渦輪。」

Layer 3: notable_for 也沒有（新車剛 seed、metadata 還沒生）
  → 不渲染段落，H1 + tune grid 直接接著
```

### db.ts 改動

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
```

### `/car/[slug].astro` 改動

DB 內 `country` / `body_style` 統一存英文（unique value 少、易對齊未來 i18n），render 時 client-side map 為中文。Map 同步寫在 page 上方或 `src/lib/car-i18n.ts`：

```typescript
// src/lib/car-i18n.ts
export const COUNTRY_ZH: Record<string, string> = {
  Japan: '日本', Germany: '德國', USA: '美國', Italy: '義大利',
  UK: '英國', France: '法國', Sweden: '瑞典',
};
export const BODY_STYLE_ZH: Record<string, string> = {
  Coupe: '雙門跑車', Hatchback: '掀背車', Sedan: '房車',
  SUV: 'SUV', Roadster: '敞篷跑車',
};
```

```astro
---
import { COUNTRY_ZH, BODY_STYLE_ZH } from '~/lib/car-i18n';
const countryZh = car.country ? (COUNTRY_ZH[car.country] ?? car.country) : null;
const bodyStyleZh = car.body_style ? (BODY_STYLE_ZH[car.body_style] ?? car.body_style) : null;
---
{car.description_zh ? (
  <div class="max-w-2xl mb-8 text-text-soft text-[15px] leading-relaxed">
    <p>{car.description_zh}</p>
  </div>
) : car.notable_for ? (
  <div class="max-w-2xl mb-8 text-text-soft text-[15px] leading-relaxed">
    <p>
      {carLabel}
      {car.chassis_code && `（底盤 ${car.chassis_code}）`}
      是 {car.era ?? countryZh}
      {bodyStyleZh && ` 的${countryZh ?? ''}${bodyStyleZh}`}
      。{car.notable_for}。
    </p>
  </div>
) : null}
```

範例渲染（country=Japan, body_style=Coupe, era="90s JDM"）：「1999 Nissan Skyline GT-R R34（底盤 R34）是 90s JDM 的日本雙門跑車。Skyline GT-R 系列最後一代搭載 RB26DETT 直六雙渦輪。」

**設計關鍵：**

- 不騙 Google：Layer 1/2 都是真實內容（手寫或結構化欄位組裝）
- 不騙使用者：Layer 3 直接不渲染，總比塞廢話好
- JSON-LD 不變：`CollectionPage` 使用既有 meta description，不受 fallback 層影響

## 七、Google Search Console 註冊

### 動作清單

```
1. dash.cloudflare.com 確認 worker domain（目前 fh6-tune-platform.badboyandy13.workers.dev）
2. search.google.com/search-console → Add property（URL prefix 模式）
3. 驗證所有權 → 用「HTML tag」方式，把 token 設成 GOOGLE_SITE_VERIFICATION secret
4. 提交 sitemap.xml
5. 對 3 台代表車（R34 / Supra / GT3 RS）跑 URL Inspection 確認狀態
```

### Code 改動

```typescript
// src/env.d.ts 補
interface ImportMetaEnv {
  readonly GOOGLE_SITE_VERIFICATION?: string;
}
```

```astro
{/* Base.astro <head> */}
{import.meta.env.GOOGLE_SITE_VERIFICATION && (
  <meta name="google-site-verification" content={import.meta.env.GOOGLE_SITE_VERIFICATION} />
)}
```

```bash
echo "<gsc-token>" | npx wrangler secret put GOOGLE_SITE_VERIFICATION
```

## 八、明確不做（YAGNI）

- 不加 `description_en`（i18n sprint）
- 不做 admin UI（用 SQL pack + `wrangler d1 execute`）
- 不做 community-edit（要 auth/權限/防破壞）
- 不為自動車生 `description_zh`（避免薄內容固化進 DB）
- 不引入 `@tailwindcss/typography`（一個段落用不到）
- 不做「相關車型」section（v1.1）
- 不做車型篩選器（searching by country / era）
- 不重做 OG image（不依賴新欄位）

## 九、驗收條件

- [ ] migration 0008 在 prod D1 套用成功，`SELECT chassis_code FROM cars LIMIT 1` 不報錯
- [ ] 5 台手寫車的 `description_zh` 都填了 80–120 字、人工抽驗過
- [ ] 62 台自動車的 5 個結構化欄位都填了非空字串
- [ ] `getCarBySlug` 回傳型別 `CarRow` 包含 6 個新欄位
- [ ] `src/lib/car-i18n.ts` 含 `COUNTRY_ZH` / `BODY_STYLE_ZH` map，至少涵蓋 7 個 country、5 個 body_style
- [ ] `/car/[slug]` 對 5 台手寫車 render Layer 1 段落
- [ ] `/car/[slug]` 對 62 台自動車 render Layer 2 組裝句（country / body_style 顯示為中文）
- [ ] `/car/[slug]` 對 0 metadata 車 fallback 到 Layer 3 不渲染（unit test 確認）
- [ ] `Base.astro` 在 `GOOGLE_SITE_VERIFICATION` 未設定時不渲染 meta tag
- [ ] `GOOGLE_SITE_VERIFICATION` secret 設定完、GSC property 驗證通過
- [ ] sitemap 提交至 GSC、3 台代表車 URL Inspection 顯示「索引中」或「URL 在 Google 上」
- [ ] e2e test 新增 case：`/car/nissan-skyline-gtr-r34-1999` render 包含「R34」的中文段落
- [ ] e2e test 新增 case：某台自動車 render 包含「底盤」或「{country}{body_style}」組裝句
- [ ] 既有 5 個 `/car/[slug]` e2e 全綠
- [ ] 既有 59 個 unit test 全綠
- [ ] `npm run check` 無新 error

## 十、風險與已知不確定性

| 風險 | mitigation |
|---|---|
| LLM 生的 `notable_for` 有事實錯誤 | 分階段 subagent + Andy 抽驗；prod 上線後若被指正，一筆 SQL UPDATE 修正 |
| `era` 命名不一致 | subagent prompt 明確列舉允許值：`80s` / `90s JDM` / `90s euro` / `2000s muscle` / `2010s` / `2010s hypercar` / `modern` / `classic` / `pre-war` |
| `country` 中英文選擇 | 統一用英文（Japan / Germany / USA），render 端要中文時 client-side map（避免 SQL 內含中文字串對未來 i18n 增加負擔） |
| GSC 驗證後 4–6 週才有資料 | spec 接受這個延遲，Sprint 2 開始時間規劃為 2026-07-下旬 |

## 十一、後續工作（Sprint 2，2026-07-下旬）

- 看 GSC 哪 5 台高曝光低點擊 → 升級為手寫 `description_zh`
- 若某些 `era` / `country` 值被搜尋量證明常見，考慮加篩選器（`/browse?era=90s+JDM`）
- 評估是否要為高流量手寫車生英文版（為 i18n sprint 準備）
