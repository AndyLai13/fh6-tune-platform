// scripts/import-wusyong-pack-7400.ts
//
// Generates scripts/wusyong-pack-7400.sql, a deterministic SQL bundle of
// share-code-only tunes contributed by Bahamut user `wusyong0403`. The
// generated file is checked into git so the same SQL can be replayed against
// both local and prod D1. Slugs are stable so re-running this script
// produces an identical (and idempotent) artifact.
//
// Notes on deviation from the original Sprint 6 plan:
//   - The Ram 1500 TRX tune binds to the pre-existing car id 51
//     (2021 Ram 1500 TRX) rather than introducing a duplicate 2024 entry.
//     0002_seed_cars_tracks.sql already occupies id 51, and the underlying
//     car model is identical for tuning purposes.
//   - Total tunes generated: 22 (matches the share-code list in the plan).
//
// Apply locally:
//   npx tsx scripts/import-wusyong-pack-7400.ts
//   npx wrangler d1 execute fh6-tune-platform-prod --local \
//     --file=scripts/wusyong-pack-7400.sql
//
// Apply to prod (HUMAN-GATED, Task 6 in the plan):
//   npx wrangler d1 execute fh6-tune-platform-prod --remote \
//     --file=scripts/wusyong-pack-7400.sql

import bcrypt from 'bcryptjs';
import { writeFileSync } from 'node:fs';
import { formatShareCode } from '../src/lib/share-code';

const PASSWORD = 'wusyong-7400-pack'; // recorded in docs/seed-contributors.md (gitignored)
const HASH = bcrypt.hashSync(PASSWORD, 10);
// 64-char hex-ish sentinel ip_hash; not a real hash, just a stable marker
const IP_HASH = 'wusyong0403seedipwusyong0403seedipwusyong0403seedipwusyong0403sd'.slice(0, 64);
const NOW = Math.floor(Date.now() / 1000);
const AUTHOR = 'wusyong0403';
const SOURCE_URL = 'https://forum.gamer.com.tw/C.php?bsn=7697&snA=7400';
const sqlEsc = (s: string) => s.replace(/'/g, "''");

type Tune = {
  name: string;
  share_code: string;
  car_id: number;
  car_slug: string;
  tune_type: 'touge' | 'rally' | 'drag';
  pi_class: 'C' | 'B' | 'A' | 'S1' | 'S2' | 'R';
};

const tunes: Tune[] = [
  { name: "Silvia K's - C/跑山",                  share_code: '708630539', car_id: 52, car_slug: 'nissan-silvia-ks-1989',                       tune_type: 'touge', pi_class: 'C' },
  { name: 'Celica GT-Four ST205 - C/拉力',        share_code: '142821010', car_id: 12, car_slug: 'toyota-celica-gt-four-st205-1994',            tune_type: 'rally', pi_class: 'C' },
  { name: 'Jimmy - C/越野',                       share_code: '132883852', car_id: 53, car_slug: 'gmc-jimmy-1970',                              tune_type: 'rally', pi_class: 'C' },
  { name: 'GR86 - B/跑山',                        share_code: '118511679', car_id: 15, car_slug: 'toyota-gr86-2022',                            tune_type: 'touge', pi_class: 'B' },
  { name: 'Impreza 22B - B/跑山',                 share_code: '445427993', car_id: 27, car_slug: 'subaru-impreza-22b-sti-1998',                 tune_type: 'touge', pi_class: 'B' },
  { name: 'GR Yaris - B/拉力',                    share_code: '876983333', car_id: 14, car_slug: 'toyota-gr-yaris-2021',                        tune_type: 'rally', pi_class: 'B' },
  { name: 'Ram 1500 TRX - B/越野',                share_code: '130570832', car_id: 51, car_slug: 'ram-1500-trx-2021',                           tune_type: 'rally', pi_class: 'B' },
  { name: 'Evo VI TM Edition - B/拉力',           share_code: '848421224', car_id: 54, car_slug: 'mitsubishi-evo-vi-tm-2001',                   tune_type: 'rally', pi_class: 'B' },
  { name: '911 GT3 (996) - A/跑山',               share_code: '987086923', car_id: 55, car_slug: 'porsche-911-gt3-996-2004',                    tune_type: 'touge', pi_class: 'A' },
  { name: 'M2 Competition - A/跑山',              share_code: '169659900', car_id: 32, car_slug: 'bmw-m2-competition-2019',                     tune_type: 'touge', pi_class: 'A' },
  { name: 'Mustang Dark Horse - A/跑山',          share_code: '115952389', car_id: 56, car_slug: 'ford-mustang-dark-horse-2024',                tune_type: 'touge', pi_class: 'A' },
  { name: 'Ariel Nomad - A/越野',                 share_code: '600706886', car_id: 57, car_slug: 'ariel-nomad-2016',                            tune_type: 'rally', pi_class: 'A' },
  { name: 'BRZ Forza Edition - A/拉力',           share_code: '164401570', car_id: 58, car_slug: 'subaru-brz-forza-edition-2022',               tune_type: 'rally', pi_class: 'A' },
  { name: 'Range Rover Sport SVR - A/越野',       share_code: '124686990', car_id: 59, car_slug: 'land-rover-range-rover-sport-svr-2015',       tune_type: 'rally', pi_class: 'A' },
  { name: 'GR GT Prototype - S1/跑山',            share_code: '443677835', car_id: 60, car_slug: 'toyota-gr-gt-prototype-2026',                 tune_type: 'touge', pi_class: 'S1' },
  { name: 'GT-R Nismo - S1/跑山',                 share_code: '174714312', car_id: 61, car_slug: 'nissan-gtr-nismo-2024',                       tune_type: 'touge', pi_class: 'S1' },
  { name: 'RS200 Evolution - S1/拉力',            share_code: '518947599', car_id: 62, car_slug: 'ford-rs200-evolution-1985',                   tune_type: 'rally', pi_class: 'S1' },
  { name: 'Centenario - S2/跑山',                 share_code: '840998654', car_id: 63, car_slug: 'lamborghini-centenario-2016',                 tune_type: 'touge', pi_class: 'S2' },
  { name: '911 Dakar - S2/拉力',                  share_code: '920353829', car_id: 64, car_slug: 'porsche-911-dakar-2023',                      tune_type: 'rally', pi_class: 'S2' },
  { name: 'Viper GTS ACR FE - S2/拉力',           share_code: '585820968', car_id: 65, car_slug: 'dodge-viper-gts-acr-fe-1999',                 tune_type: 'rally', pi_class: 'S2' },
  { name: 'Ultima Evolution Coupe 1020 - R/跑山', share_code: '735727292', car_id: 66, car_slug: 'ultima-evolution-coupe-1020-2015',            tune_type: 'touge', pi_class: 'R' },
  { name: 'Camry TRD - A/直線',                   share_code: '853939307', car_id: 67, car_slug: 'toyota-camry-trd-2023',                       tune_type: 'drag', pi_class: 'A' }
];

// Highest existing tune id is 15 (5 normal + 10 demo from seed-demo-tunes).
// Start at 100 to leave a gap for future demo or manual inserts.
const ID_START = 100;

const rows = tunes.map((t, i) => {
  const id = ID_START + i;
  const slug = `${t.car_slug}-wusyong-${t.pi_class.toLowerCase()}-${t.tune_type}`;
  // Canonicalize share code to XXX-XXX-XXX form so duplicate detection (which
  // calls getTuneByShareCode with the user-formatted string) matches future
  // uploads of the same code, and so ShareCodeBox renders consistently.
  const code = formatShareCode(t.share_code);
  // share-code-only: pi_score, drivetrain, power_hp, weight_lb, description, tune_values all NULL
  return `(${id}, '${sqlEsc(slug)}', '${sqlEsc(t.name)}', '${sqlEsc(code)}', ${t.car_id}, '${t.tune_type}', '${t.pi_class}', NULL, NULL, NULL, NULL, NULL, NULL, '${sqlEsc(SOURCE_URL)}', '${sqlEsc(AUTHOR)}', '${HASH}', '${IP_HASH}', 0, 0, 0, 'public', ${NOW}, ${NOW})`;
});

const sql = `-- wusyong0403 Bahamut pack import (bsn=7697 snA=7400)
-- Generated by scripts/import-wusyong-pack-7400.ts — do not edit by hand
-- Edit password (all ${tunes.length} tunes): ${PASSWORD}
-- Source: ${SOURCE_URL}
INSERT INTO tunes (id, slug, name, share_code, car_id, tune_type, pi_class, pi_score, drivetrain, power_hp, weight_lb, description, tune_values, source_url, author_handle, edit_password_hash, ip_hash, rating_sum, rating_count, download_count, status, created_at, updated_at) VALUES
  ${rows.join(',\n  ')};
`;

writeFileSync('scripts/wusyong-pack-7400.sql', sql);
console.log(`Wrote scripts/wusyong-pack-7400.sql — ${tunes.length} tunes`);
console.log(`Apply locally: npx wrangler d1 execute fh6-tune-platform-prod --local --file=scripts/wusyong-pack-7400.sql`);
console.log(`Apply to prod: npx wrangler d1 execute fh6-tune-platform-prod --remote --file=scripts/wusyong-pack-7400.sql`);
