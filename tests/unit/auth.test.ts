import { describe, expect, it } from 'vitest';
import { hashEditPassword, verifyEditPassword, validatePasswordStrength } from '~/lib/auth';

describe('hashEditPassword + verifyEditPassword', () => {
  it('hashes and verifies a valid password', async () => {
    const hash = await hashEditPassword('strong-pass-123');
    expect(hash).not.toBe('strong-pass-123');
    expect(await verifyEditPassword('strong-pass-123', hash)).toBe(true);
  });
  it('rejects wrong password', async () => {
    const hash = await hashEditPassword('strong-pass-123');
    expect(await verifyEditPassword('wrong-pass', hash)).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('accepts a 6+ char password not in blocklist', () => {
    expect(validatePasswordStrength('uniquePass1')).toEqual({ ok: true });
  });
  it('rejects passwords shorter than 6 chars', () => {
    const r = validatePasswordStrength('abc');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_short');
  });
  it('rejects blocklisted passwords', () => {
    const r = validatePasswordStrength('password');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('blocklisted');
  });
  it('rejects "123456"', () => {
    const r = validatePasswordStrength('123456');
    expect(r.ok).toBe(false);
  });
});
