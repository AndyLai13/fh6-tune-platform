# Deploying touge.gg to Cloudflare Workers

First-time setup ~30 minutes. Subsequent deploys ~2 minutes.

> **Note:** Despite the project name including "tune-platform", we deploy as a Cloudflare **Worker** (not a Pages project). Astro's `@astrojs/cloudflare` v13+ adapter is Workers-first; trying `wrangler pages deploy` errors with `ASSETS is reserved in Pages projects`.

## Prerequisites

- Cloudflare account (free tier is fine — Workers free tier = 100k req/day)
- `wrangler` CLI authed: `npx wrangler login`
- A registered domain (optional — the free `*.workers.dev` URL works for launch validation)

## 1. Create the production D1 database

```bash
npx wrangler d1 create fh6-tune-platform-prod
```

Copy the `database_id` from the output, then update `wrangler.toml`'s top-level `[[d1_databases]]` block to point at it (see Step 2.5).

Apply all migrations to production:

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0002_seed_cars_tracks.sql
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0003_fts_car_columns.sql
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0004_fts_unicode61.sql
```

## 2. Create the production KV namespace

```bash
npx wrangler kv namespace create KV
```

Copy the `id` from output for the next step.

## 2.5. Update `wrangler.toml` with prod IDs

Top-level bindings are used for production deploys. Local dev (`wrangler dev` / Astro `platformProxy`) emulates storage in `.wrangler/state/` regardless of these IDs, so this won't pollute local development.

```toml
name = "fh6-tune-platform"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "fh6-tune-platform-prod"
database_id = "<paste-D1-id>"

[[kv_namespaces]]
binding = "KV"
id = "<paste-KV-id>"

# Astro's Cloudflare adapter auto-provisions a SESSION KV namespace.
# After the first deploy attempt creates it, list namespaces and paste the ID here:
#   npx wrangler kv namespace list
[[kv_namespaces]]
binding = "SESSION"
id = "<paste-SESSION-id-after-first-deploy>"
```

## 3. Set up Turnstile (anti-spam for upload/review/report)

1. Go to https://dash.cloudflare.com → Turnstile → click **Add widget**
2. **Widget name**: anything (e.g. `fh6-tune-platform`)
3. **Hostnames**: your deploy URL host (e.g. `fh6-tune-platform.<account>.workers.dev`) — no `https://`, no trailing slash
4. **Widget mode**: Managed
5. Click Create → copy **Site key** (public) and **Secret key** (private)

Set the secret key on the Worker (`echo | wrangler` form works in non-TTY shells):

```bash
echo "<your-turnstile-secret-key>" | npx wrangler secret put TURNSTILE_SECRET_KEY
```

Set the public site key as a build-time env var via `.env.production` (gitignored):

```bash
echo "PUBLIC_TURNSTILE_SITE_KEY=<your-site-key>" > .env.production
```

Astro/Vite picks this up automatically when building in production mode (`astro build`).

## 4. Set remaining secrets

Generate strong random values:

```bash
openssl rand -hex 32  # for IP_HASH_SALT
openssl rand -hex 32  # for EDIT_COOKIE_SECRET
```

Set them via echo pipe (works in non-TTY):

```bash
echo "<paste-the-IP-hash-salt>" | npx wrangler secret put IP_HASH_SALT
echo "<paste-the-edit-cookie-secret>" | npx wrangler secret put EDIT_COOKIE_SECRET
```

Verify all 3 secrets are set:

```bash
npx wrangler secret list
```

Expected output lists `IP_HASH_SALT`, `EDIT_COOKIE_SECRET`, `TURNSTILE_SECRET_KEY`.

## 5. Build and deploy

```bash
rm -rf dist .wrangler/deploy   # clear stale artifacts
npm run build
npx wrangler deploy
```

(First deploy will auto-create the Worker. On the very first attempt, Astro will also auto-provision the `SESSION` KV namespace — get its ID via `wrangler kv namespace list` and paste it into `wrangler.toml` per Step 2.5, then re-run `npm run build && npx wrangler deploy`.)

The output prints the live URL, e.g. `https://fh6-tune-platform.<account>.workers.dev`.

## 6. Seed launch content (optional but recommended)

To give first visitors something to look at — and to make the smoke test's tune-detail / OG-image checks pass — apply the demo tunes to production:

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=scripts/demo-tunes.sql
```

The 5 "authorized contributor" demo tunes are explicitly labeled `[示範]` in their descriptions — clearly distinguishable from real user content. Replace these as real authors approve their submissions through the [`SEED_PERMISSION.md`](SEED_PERMISSION.md) DM flow.

## 6.5. Onboarding authorized seed contributors (share-code-only mode)

When a Bahamut/Reddit/etc. contributor grants permission to publish a pack of share codes but cannot provide per-tune detail values (suspension, gearing, etc.), apply the share-code-only schema migration + their generated SQL pack:

```bash
# One-time schema relaxation (allows tune_values / pi_score / drivetrain to be NULL, adds 'R' class + source_url column)
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0005_share_code_only_mode.sql

# Seed any new cars the pack references
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0006_seed_more_cars.sql

# Apply the contributor's pack (regenerate via `npx tsx scripts/import-<handle>-pack-<id>.ts` if needed)
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=scripts/wusyong-pack-7400.sql
```

The order matters: **0005 → 0006 → pack SQL**. 0006 must come after 0005 (cars seed is independent of the schema rebuild, but applying it first leaves the rebuild trigger-recreation window in a slightly racier state — safer to do schema first). The pack SQL references car ids inserted by 0006, so it must come last.

After applying, verify:

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --command="SELECT slug, share_code, pi_class FROM tunes WHERE author_handle='wusyong0403' ORDER BY id;"
```

Should print 22 rows.



The sitemap line is hardcoded. Set it to your real production URL before deploying:

```
Sitemap: https://<your-host>/sitemap.xml
```

Rebuild + redeploy after editing.

## 8. Verify

Run the production smoke test against the live URL:

```bash
SMOKE_BASE_URL=https://<your-host> npm run test:smoke
```

All 8 tests should pass. See the [Post-Deploy Smoke Test](#post-deploy-smoke-test) section at the bottom for what each test verifies.

Also walk through the manual checklist for upload/review/report (these aren't in the smoke suite because they require Turnstile interaction):

- [ ] `/upload` form renders, Turnstile widget appears (not "demo mode" placeholder)
- [ ] Upload a test tune → confirm it appears at `/tune/{slug}`
- [ ] `/tune/{slug}` review form: submit a 5-star review with Turnstile passed
- [ ] `/tune/{slug}` copy share code → `download_count` increments
- [ ] Report dialog opens on tune detail and on review cards

## 9. Custom domain (optional)

Cloudflare dashboard → Workers & Pages → fh6-tune-platform → Settings → Triggers → Custom Domains → Add Custom Domain. Follow the DNS instructions for your registrar.

Add the custom domain as a second hostname in your Turnstile widget (Step 3) so anti-spam keeps working on both URLs.

## Subsequent deploys

```bash
npm run build && npx wrangler deploy
```

## Migrating schema changes to prod

When you add a new migration file `migrations/000N_xxx.sql`:

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/000N_xxx.sql
```

Always test the migration against local D1 (`--local`) first.

## Rolling back

If a deploy breaks prod:

```bash
# List recent versions
npx wrangler deployments list

# Roll back to a previous version
npx wrangler rollback <version-id>
```

D1 schema rollbacks have to be done manually with a reverse migration.

## Analytics (optional)

Set the `PLAUSIBLE_DOMAIN` env var in production to enable Plausible analytics:

```bash
echo "<your-domain>" | npx wrangler secret put PLAUSIBLE_DOMAIN
```

When set, `<script defer data-domain="<your-domain>" src="https://plausible.io/js/script.js">` is injected on every page. When unset (dev default), no analytics script loads.

Plausible is privacy-respecting: no cookies, no PII, no cross-site tracking. Disclosed in `/privacy`.

## Post-Deploy Smoke Test

After every production deploy, run the automated smoke suite against the live URL:

```bash
SMOKE_BASE_URL=https://<your-host> npm run test:smoke
```

To test against a different host or override the demo slug:

```bash
SMOKE_BASE_URL=https://<other-host> SMOKE_TUNE_SLUG=<existing-slug> npm run test:smoke
```

The suite (`tests/smoke/production.spec.ts`) covers 8 checks:

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | homepage loads | HTTP 200 + `<title>` contains `touge.gg` |
| 2 | /browse loads with tunes | HTTP 200 + at least one `/tune/` link visible |
| 3 | /sitemap.xml is valid | HTTP 200, XML content-type, contains `<urlset` and `/tracks/` |
| 4 | /feed.xml is valid RSS 2.0 | HTTP 200, contains `<rss` and `<channel>` |
| 5 | tune detail OG + JSON-LD | OG image meta and canonical link present for demo slug |
| 6 | OG image SVG endpoint | HTTP 200, `image/svg+xml` content-type, body starts with `<svg` |
| 7 | /privacy and /terms reachable | Both return HTTP 200 |
| 8 | robots.txt advertises sitemap | Contains `Sitemap:` pointing to `sitemap.xml` |

The default tune slug used by tests 5–6 is `toyota-supra-mk4-1994-demo04` (seeded by `scripts/demo-tunes.sql` in Step 6).

All 8 tests must pass before marking a deploy stable. Traces for any failures are saved under `test-results/` for debugging.
