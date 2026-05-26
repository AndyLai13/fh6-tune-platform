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
  <rect width="1200" height="630" fill="#0a0e14"/>
  <rect x="0" y="0" width="1200" height="6" fill="#00d9ff"/>
  <rect x="0" y="624" width="1200" height="6" fill="#ff2e63"/>
  <text x="80" y="100" font-family="JetBrains Mono, monospace" font-size="22" fill="#ff2e63" letter-spacing="4">＞ ${typeText} · ${piText}</text>
  <text x="80" y="240" font-family="Inter, sans-serif" font-size="92" font-weight="800" fill="#ffffff">${name}</text>
  <text x="80" y="320" font-family="Inter, sans-serif" font-size="36" fill="#8a98a8">${carText}</text>
  <text x="80" y="540" font-family="JetBrains Mono, monospace" font-size="24" fill="#8a98a8">${author}</text>
  <text x="1120" y="540" font-family="JetBrains Mono, monospace" font-size="28" font-weight="700" fill="#00d9ff" text-anchor="end">touge.gg</text>
</svg>`;
}

export function renderDefaultOgSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0e14"/>
  <rect x="0" y="0" width="1200" height="6" fill="#00d9ff"/>
  <rect x="0" y="624" width="1200" height="6" fill="#ff2e63"/>
  <text x="600" y="280" font-family="JetBrains Mono, monospace" font-size="28" fill="#ff2e63" letter-spacing="6" text-anchor="middle">＞ Forza Horizon 6</text>
  <text x="600" y="380" font-family="Inter, sans-serif" font-size="120" font-weight="800" fill="#00d9ff" text-anchor="middle">touge.gg</text>
  <text x="600" y="450" font-family="Inter, sans-serif" font-size="32" fill="#8a98a8" text-anchor="middle">玩家社群驅動的調校資料庫</text>
</svg>`;
}
