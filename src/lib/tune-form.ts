export function buildTuneValues(fd: FormData): Record<string, unknown> {
  const out: Record<string, any> = {};
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('tv.')) continue;
    const path = key.slice(3).split('.');
    let cur = out;
    for (let i = 0; i < path.length - 1; i++) {
      cur[path[i]] = cur[path[i]] ?? {};
      cur = cur[path[i]];
    }
    cur[path[path.length - 1]] = Number(value);
  }
  return out;
}
