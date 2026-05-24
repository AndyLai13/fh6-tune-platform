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
