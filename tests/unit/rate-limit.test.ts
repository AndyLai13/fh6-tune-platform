import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '~/lib/rate-limit';

function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: { expirationTtl: number }) => {
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
  });
  it('denies when limit is reached', async () => {
    const kv = fakeKv({ 'rl:upload:ip-abc': '5' });
    const r = await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
  it('isolates buckets per action', async () => {
    const kv = fakeKv({ 'rl:upload:ip-abc': '5' });
    const r = await checkRateLimit(kv as any, 'ip-abc', 'review', 20, 3600);
    expect(r.allowed).toBe(true);
  });
});
