import { describe, expect, it } from 'vitest';
import { hashEditPassword, verifyEditPassword, validatePasswordStrength } from '~/lib/auth';
import { signEditCookie, verifyEditCookie } from '~/lib/auth';

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

describe('signEditCookie + verifyEditCookie', () => {
  const SECRET = 'a'.repeat(32);

  it('signs and verifies a cookie for a given slug', async () => {
    const cookie = await signEditCookie('my-tune-slug', SECRET, 3600);
    const result = await verifyEditCookie(cookie, 'my-tune-slug', SECRET);
    expect(result).toBe(true);
  });
  it('rejects cookie for different slug', async () => {
    const cookie = await signEditCookie('slug-a', SECRET, 3600);
    expect(await verifyEditCookie(cookie, 'slug-b', SECRET)).toBe(false);
  });
  it('rejects expired cookie', async () => {
    const cookie = await signEditCookie('slug', SECRET, -1);
    expect(await verifyEditCookie(cookie, 'slug', SECRET)).toBe(false);
  });
  it('rejects tampered cookie', async () => {
    const cookie = await signEditCookie('slug', SECRET, 3600);
    const tampered = cookie.slice(0, -2) + 'xx';
    expect(await verifyEditCookie(tampered, 'slug', SECRET)).toBe(false);
  });
});
