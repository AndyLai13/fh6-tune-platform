export function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"*`)
    .join(' OR ');
}
