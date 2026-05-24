// TODO(sprint-3): the `\w` character class is ASCII-only, so CJK characters (e.g. "日産") are
// stripped by the regex below, producing empty FTS queries. Site is zh-TW — this needs either
// a Unicode-aware regex (\p{L}\p{N} with the `u` flag) AND an FTS5 tokenizer that segments CJK
// (e.g. `unicode61` is closer than `simple` but still doesn't word-segment Chinese). For now,
// CJK queries silently return zero results.
export function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"*`)
    .join(' OR ');
}
