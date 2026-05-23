export type RateLimitResult = { allowed: boolean; remaining: number };

export async function checkRateLimit(
  kv: KVNamespace,
  ipHash: string,
  action: string,
  limit: number,
  ttlSeconds: number
): Promise<RateLimitResult> {
  const key = `rl:${action}:${ipHash}`;
  const raw = await kv.get(key);
  const current = raw ? parseInt(raw, 10) : 0;
  if (current >= limit) return { allowed: false, remaining: 0 };
  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: ttlSeconds });
  return { allowed: true, remaining: limit - next };
}
