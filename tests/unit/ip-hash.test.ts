import { describe, expect, it } from 'vitest';
import { hashIp } from '~/lib/ip-hash';

describe('hashIp', () => {
  it('produces a 64-char hex hash', async () => {
    const hash = await hashIp('192.168.1.1', 'salt-1');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('produces same hash for same input and salt', async () => {
    const a = await hashIp('192.168.1.1', 'salt-1');
    const b = await hashIp('192.168.1.1', 'salt-1');
    expect(a).toBe(b);
  });
  it('produces different hashes for different salts', async () => {
    const a = await hashIp('192.168.1.1', 'salt-1');
    const b = await hashIp('192.168.1.1', 'salt-2');
    expect(a).not.toBe(b);
  });
  it('produces different hashes for different IPs', async () => {
    const a = await hashIp('192.168.1.1', 'salt-1');
    const b = await hashIp('192.168.1.2', 'salt-1');
    expect(a).not.toBe(b);
  });
});
