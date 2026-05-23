export type RateLimitResult = { allowed: boolean; remaining: number };

// Stored value shape for fixed-window rate limiting.
// We keep `expiresAt` (Unix seconds) in the JSON so that every subsequent
// `put` can re-supply the original expiration via `expiration` (absolute
// timestamp). Cloudflare KV's `put` without expiration overwrites any
// existing TTL to "no expiry", so we cannot rely on TTL preservation.
type RateLimitEntry = { count: number; expiresAt: number };

export async function checkRateLimit(
  kv: KVNamespace,
  ipHash: string,
  action: string,
  limit: number,
  ttlSeconds: number
): Promise<RateLimitResult> {
  const key = `rl:${action}:${ipHash}`;
  const raw = await kv.get(key);

  const now = Math.floor(Date.now() / 1000);
  let entry: RateLimitEntry;

  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    // Guard against legacy plain-number values (old format was a bare integer
    // string). If the parsed value is not a proper RateLimitEntry object,
    // treat it as an expired/invalid entry and start a fresh window.
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'count' in parsed &&
      'expiresAt' in parsed
    ) {
      entry = parsed as RateLimitEntry;
      // Treat expired entries the same as missing (KV may not have evicted yet).
      if (entry.expiresAt <= now) {
        entry = { count: 0, expiresAt: now + ttlSeconds };
      }
    } else {
      entry = { count: 0, expiresAt: now + ttlSeconds };
    }
  } else {
    entry = { count: 0, expiresAt: now + ttlSeconds };
  }

  if (entry.count >= limit) return { allowed: false, remaining: 0 };

  entry.count += 1;
  // Always supply the absolute `expiration` so the TTL window is fixed from
  // first hit, not sliding. Using `expiration` (absolute seconds since epoch)
  // instead of `expirationTtl` lets us pass the *original* deadline on every
  // subsequent put without re-reading the old TTL via a separate API.
  await kv.put(key, JSON.stringify(entry), { expiration: entry.expiresAt });

  return { allowed: true, remaining: limit - entry.count };
}
