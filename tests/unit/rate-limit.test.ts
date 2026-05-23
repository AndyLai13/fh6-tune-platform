import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '~/lib/rate-limit';

// Helper to build a JSON-encoded rate-limit entry that looks like it was
// created `secsAgo` seconds in the past within a `ttlSeconds` window.
function makeEntry(count: number, ttlSeconds = 3600, secsAgo = 0) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds - secsAgo;
  return JSON.stringify({ count, expiresAt });
}

function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: { expiration?: number; expirationTtl?: number }) => {
      store.set(k, v);
    }),
    store
  };
}

describe('checkRateLimit', () => {
  it('allows first request and records count 1', async () => {
    const kv = fakeKv();
    const r = await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
    expect(kv.put).toHaveBeenCalled();
    // Stored value should be valid JSON with count=1
    const stored = JSON.parse(kv.store.get('rl:upload:ip-abc') ?? '{}');
    expect(stored.count).toBe(1);
    expect(typeof stored.expiresAt).toBe('number');
  });

  it('denies when limit is reached', async () => {
    const kv = fakeKv({ 'rl:upload:ip-abc': makeEntry(5) });
    const r = await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    // No write should occur when the request is denied
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('isolates buckets per action', async () => {
    const kv = fakeKv({ 'rl:upload:ip-abc': makeEntry(5) });
    const r = await checkRateLimit(kv as any, 'ip-abc', 'review', 20, 3600);
    expect(r.allowed).toBe(true);
  });

  it('uses fixed-window TTL: every put carries the original expiration', async () => {
    const kv = fakeKv();
    await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);

    const calls = kv.put.mock.calls;
    expect(calls).toHaveLength(3);

    // Every call must supply an absolute `expiration` (not expirationTtl).
    for (const call of calls) {
      const opts = call[2] as { expiration?: number; expirationTtl?: number } | undefined;
      expect(opts).toBeDefined();
      expect(typeof opts!.expiration).toBe('number');
      expect(opts!.expirationTtl).toBeUndefined();
    }

    // All three puts must use the SAME expiresAt (fixed window, not sliding).
    const expirations = calls.map((c) => (c[2] as { expiration: number }).expiration);
    expect(expirations[0]).toBe(expirations[1]);
    expect(expirations[1]).toBe(expirations[2]);
  });

  it('treats an already-expired entry as a fresh window', async () => {
    // Entry with expiresAt in the past (simulates KV eviction lag)
    const pastExpiresAt = Math.floor(Date.now() / 1000) - 1;
    const expiredEntry = JSON.stringify({ count: 5, expiresAt: pastExpiresAt });
    const kv = fakeKv({ 'rl:upload:ip-abc': expiredEntry });

    const r = await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    // Should be allowed as count restarts from 0 in a new window
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });
});
