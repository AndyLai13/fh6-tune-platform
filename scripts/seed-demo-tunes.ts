import bcrypt from 'bcryptjs';
import { sampleTuneValues } from '../src/lib/tune-values';
import { writeFileSync } from 'node:fs';

const PASSWORD = 'demoseed42';
const HASH = bcrypt.hashSync(PASSWORD, 10);
const IP_HASH = 'demoseedipdemoseedipdemoseedipde'; // 32 chars dummy
const NOW = Math.floor(Date.now() / 1000);
const sqlEsc = (s: string) => s.replace(/'/g, "''");

type Tune = {
  name: string;
  car_id: number;
  car_slug: string;
  tune_type: 'touge' | 'drift' | 'grip' | 'drag' | 'rally' | 'offroad';
  pi_class: 'D' | 'C' | 'B' | 'A' | 'S1' | 'S2' | 'X';
  pi_score: number;
  drivetrain: 'RWD' | 'AWD' | 'FWD';
  power_hp: number;
  weight_lb: number;
  description: string;
  author: string;
  rating_sum: number;
  rating_count: number;
  download_count: number;
  share_code: string;
  reviews: Array<{ author: string; rating: number; body: string }>;
};

const tunes: Tune[] = [
  {
    name: '秋名山下り Spec',
    car_id: 9, car_slug: 'toyota-sprinter-trueno-ae86-1986',
    tune_type: 'touge', pi_class: 'A', pi_score: 800, drivetrain: 'RWD',
    power_hp: 240, weight_lb: 2050,
    description: '經典峠道下坡設定。後輪偏軟、前防傾桿吃硬讓車頭咬入，靠重量轉移過彎不靠輪胎抓地力。煞車前傾 56%，方便用煞車塞進角。',
    author: 'takumi_fan', share_code: '821-471-933',
    rating_sum: 47, rating_count: 11, download_count: 2840,
    reviews: [
      { author: 'koganei_rs', rating: 5, body: '排煙管聲音不會騙人，這就是 86 該有的感覺。' },
      { author: 'mr_dorift', rating: 4, body: '入彎很順，但出彎要踩深一點油。' },
      { author: 'eight_six', rating: 5, body: 'Akina 下坡 PB -2.3s，神！' }
    ]
  },
  {
    name: 'Weekend Sideways',
    car_id: 5, car_slug: 'nissan-silvia-s15-1998',
    tune_type: 'drift', pi_class: 'A', pi_score: 798, drivetrain: 'RWD',
    power_hp: 480, weight_lb: 2680,
    description: 'S15 漂移基礎設定。差速器加速 100% 全鎖、後輪壓力刻意降到 26 psi 增加可控滑動。前束 -0.5 給回正速度。新手友善版。',
    author: 'silvia_lover',  share_code: '442-189-007',
    rating_sum: 38, rating_count: 9, download_count: 4120,
    reviews: [
      { author: 'tandem_king', rating: 5, body: '雙人連流超穩，推薦給漂移新手練習。' },
      { author: 'drift_otaku', rating: 4, body: '長彎要留意油門，否則容易抓回來。' }
    ]
  },
  {
    name: 'Bayshore Hunter',
    car_id: 3, car_slug: 'nissan-skyline-gtr-r34-1999',
    tune_type: 'grip', pi_class: 'S1', pi_score: 898, drivetrain: 'AWD',
    power_hp: 720, weight_lb: 3380,
    description: 'R34 灣岸高速設定，前後比例偏 40/60 讓 ATTESA 在直線釋放更多後輪動力。終傳拉長到 3.62，250 mph 直線王。',
    author: 'wangan_runner', share_code: '999-061-345',
    rating_sum: 52, rating_count: 12, download_count: 6720,
    reviews: [
      { author: 'r34_purist', rating: 5, body: '高速直線穩到不行，C1 跑山首選。' },
      { author: 'mid_night', rating: 4, body: '彎中略推，但高速段補回來。' },
      { author: 'gtr_only', rating: 5, body: 'RB26 之魂！' }
    ]
  },
  {
    name: '2JZ 1500 Snake',
    car_id: 10, car_slug: 'toyota-supra-mk4-1994',
    tune_type: 'drag', pi_class: 'S2', pi_score: 980, drivetrain: 'RWD',
    power_hp: 1520, weight_lb: 3210,
    description: '2JZ 暴力直線。前空力 0，後尾翼最大，4-6 檔拉長。差速器加速鎖死 100%，起步靠 launch control。1/4 哩 7.8 秒。',
    author: 'two_j_zee', share_code: '707-202-815',
    rating_sum: 41, rating_count: 9, download_count: 5240,
    reviews: [
      { author: 'quarter_mile', rating: 5, body: '直線之王，沒得嘴。' },
      { author: 'strip_only', rating: 4, body: '起步要練一下，不然會冒煙。' }
    ]
  },
  {
    name: 'Group A Tribute',
    car_id: 27, car_slug: 'subaru-impreza-22b-sti-1998',
    tune_type: 'rally', pi_class: 'A', pi_score: 800, drivetrain: 'AWD',
    power_hp: 380, weight_lb: 2980,
    description: '22B 拉力致敬設定。前後 50/50 鎖定，砂石路面車高 +0.6 in，胎壓降到 24 psi 抓地。獻給 Colin McRae。',
    author: 'wrc_dreamer', share_code: '356-118-902',
    rating_sum: 33, rating_count: 8, download_count: 3180,
    reviews: [
      { author: 'colin_fan', rating: 5, body: '聽到引擎聲就想哭，麥拉倫精神！' },
      { author: 'dirt_lover', rating: 4, body: '砂石路面神物，柏油偏推頭。' }
    ]
  },
  {
    name: 'Lightweight Touge',
    car_id: 18, car_slug: 'mazda-mx5-miata-na-1989',
    tune_type: 'touge', pi_class: 'C', pi_score: 598, drivetrain: 'RWD',
    power_hp: 165, weight_lb: 2080,
    description: 'NA Miata 極簡設定。彈簧最軟讓重量轉移完整、空力歸零、差速器加速 28%。115 馬力跟你說車重才是王道。',
    author: 'miata_is_always_the_answer', share_code: '128-444-657',
    rating_sum: 39, rating_count: 9, download_count: 1840,
    reviews: [
      { author: 'roadster_jp', rating: 5, body: 'MiATA。is. ALWAYS. the answer.' },
      { author: 'lightweight_only', rating: 5, body: '輕量化才是真理。' },
      { author: 'spec_miata', rating: 4, body: '小馬力車的樂趣這台最懂。' }
    ]
  },
  {
    name: 'FF King EK9',
    car_id: 20, car_slug: 'honda-civic-type-r-ek9-1997',
    tune_type: 'grip', pi_class: 'A', pi_score: 780, drivetrain: 'FWD',
    power_hp: 280, weight_lb: 2410,
    description: '前驅抓地調校。前防傾桿吃滿、後輪反而軟、前負外傾 -3.2°。轉向過度但只要敢踩油就把車頭甩回來。',
    author: 'k20_swap', share_code: '614-993-021',
    rating_sum: 28, rating_count: 7, download_count: 2210,
    reviews: [
      { author: 'honda_boy', rating: 4, body: '前驅能跑這樣很神。' },
      { author: 'vtec_yo', rating: 5, body: 'VTEC kicked in!' }
    ]
  },
  {
    name: 'Desert Dominator',
    car_id: 48, car_slug: 'ford-f150-raptor-r-2023',
    tune_type: 'offroad', pi_class: 'S1', pi_score: 880, drivetrain: 'AWD',
    power_hp: 780, weight_lb: 5950,
    description: '沙漠飛車設定。車高拉到 +2.0、壓縮阻尼放軟、空力歸零。著陸超穩，跳完還能繼續油門到底。',
    author: 'baja_runner', share_code: '551-770-184',
    rating_sum: 22, rating_count: 6, download_count: 1450,
    reviews: [
      { author: 'mojave_kid', rating: 4, body: '跳了之後不會翻車，調得很好。' },
      { author: 'off_road_dad', rating: 5, body: '北海道雪地跑也ok！' }
    ]
  },
  {
    name: '1/4 Mile Demon',
    car_id: 50, car_slug: 'dodge-challenger-srt-demon-2018',
    tune_type: 'drag', pi_class: 'X', pi_score: 999, drivetrain: 'RWD',
    power_hp: 1840, weight_lb: 4280,
    description: 'Demon 直線怪物。前空力全卸、後翼歸零、6 檔終速 280 mph。Wheelie bar 模擬：前彈簧最硬避免翹頭。',
    author: 'hellcat_x', share_code: '666-001-911',
    rating_sum: 19, rating_count: 5, download_count: 3340,
    reviews: [
      { author: 'mopar_4life', rating: 4, body: 'V8 直線就是爽。' },
      { author: 'demon_owner', rating: 5, body: '6 秒台沒問題。' }
    ]
  },
  {
    name: 'Green Hell Cayman',
    car_id: 35, car_slug: 'porsche-cayman-gt4-rs-2022',
    tune_type: 'grip', pi_class: 'S2', pi_score: 945, drivetrain: 'RWD',
    power_hp: 520, weight_lb: 3120,
    description: 'GT4 RS 紐柏林設定。前空力 ±0、後翼最大、空力分配 47/53。低速 Karussell 過彎不會推、高速 Schwedenkreuz 不會浮。',
    author: 'green_hell_jp', share_code: '997-247-650',
    rating_sum: 44, rating_count: 10, download_count: 2680,
    reviews: [
      { author: 'nordschleife', rating: 5, body: '北環 6:48，神調校。' },
      { author: 'flat_six_fan', rating: 5, body: 'Cayman GT4 應有的樣子。' },
      { author: 'track_day_jp', rating: 4, body: '稍微挑胎，但跑起來真的快。' }
    ]
  }
];

const tuneValuesJson = JSON.stringify(sampleTuneValues());

const tuneRows = tunes.map((t, i) => {
  const id = i + 1;
  const slug = `${t.car_slug}-demo${String(id).padStart(2, '0')}`;
  return `(${id}, '${sqlEsc(slug)}', '${sqlEsc(t.name)}', '${sqlEsc(t.share_code)}', ${t.car_id}, '${t.tune_type}', '${t.pi_class}', ${t.pi_score}, '${t.drivetrain}', ${t.power_hp}, ${t.weight_lb}, '${sqlEsc(t.description)}', '${sqlEsc(tuneValuesJson)}', '${sqlEsc(t.author)}', '${HASH}', '${IP_HASH}', ${t.rating_sum}, ${t.rating_count}, ${t.download_count}, 'public', ${NOW}, ${NOW})`;
});

const reviewRows: string[] = [];
let reviewId = 1;
tunes.forEach((t, i) => {
  const tuneId = i + 1;
  t.reviews.forEach((r) => {
    reviewRows.push(
      `(${reviewId++}, ${tuneId}, '${sqlEsc(r.author)}', ${r.rating}, '${sqlEsc(r.body)}', '${IP_HASH}', 'public', ${NOW - reviewId * 3600})`
    );
  });
});

const sql = `-- Demo tunes seed (NOT for production). Regenerate via: npx tsx scripts/seed-demo-tunes.ts
-- Edit password for all demo tunes: ${PASSWORD}
DELETE FROM reviews;
DELETE FROM tune_tracks;
DELETE FROM tunes;

INSERT INTO tunes (id, slug, name, share_code, car_id, tune_type, pi_class, pi_score, drivetrain, power_hp, weight_lb, description, tune_values, author_handle, edit_password_hash, ip_hash, rating_sum, rating_count, download_count, status, created_at, updated_at) VALUES
  ${tuneRows.join(',\n  ')};

INSERT INTO reviews (id, tune_id, author_handle, rating, body, ip_hash, status, created_at) VALUES
  ${reviewRows.join(',\n  ')};
`;

writeFileSync('scripts/demo-tunes.sql', sql);
console.log(`Wrote scripts/demo-tunes.sql — ${tunes.length} tunes, ${reviewRows.length} reviews`);
console.log(`Apply: npx wrangler d1 execute fh6-tune-platform-local --local --file=scripts/demo-tunes.sql`);
