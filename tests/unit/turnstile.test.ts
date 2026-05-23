import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from '~/lib/turnstile';

describe('verifyTurnstile', () => {
  const SECRET = 'test-secret';
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('returns true on success', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    expect(await verifyTurnstile('user-token', SECRET, '1.2.3.4')).toBe(true);
  });
  it('returns false on failure', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: false, 'error-codes': ['invalid-input'] }) });
    expect(await verifyTurnstile('user-token', SECRET, '1.2.3.4')).toBe(false);
  });
  it('returns false on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await verifyTurnstile('user-token', SECRET, '1.2.3.4')).toBe(false);
  });
  it('returns false on empty token', async () => {
    expect(await verifyTurnstile('', SECRET, '1.2.3.4')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
