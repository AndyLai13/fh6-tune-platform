import { describe, expect, it } from 'vitest';
import { sanitizeFtsQuery } from '~/lib/fts';

describe('sanitizeFtsQuery', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeFtsQuery('')).toBe('');
  });
  it('preserves single-character input as a token (allows CJK single chars)', () => {
    expect(sanitizeFtsQuery('a')).toBe('"a"*');
  });
  it('quotes and prefix-matches each token', () => {
    expect(sanitizeFtsQuery('supra mk4')).toBe('"supra"* OR "mk4"*');
  });
  it('strips FTS metacharacters', () => {
    expect(sanitizeFtsQuery('foo"bar*baz')).toBe('"foobarbaz"*');
  });
  it('preserves all non-empty tokens (1+ chars)', () => {
    expect(sanitizeFtsQuery('a supra b mk4')).toBe('"a"* OR "supra"* OR "b"* OR "mk4"*');
  });
  it('handles dashes as part of tokens', () => {
    expect(sanitizeFtsQuery('gt-r r34')).toBe('"gt-r"* OR "r34"*');
  });
  it('preserves CJK characters as tokens', () => {
    // 豐田 = "Toyota" in Chinese. Each char is treated as its own token by unicode61.
    expect(sanitizeFtsQuery('豐田')).toBe('"豐田"*');
  });
  it('mixes CJK and ASCII tokens', () => {
    expect(sanitizeFtsQuery('豐田 supra')).toBe('"豐田"* OR "supra"*');
  });
});
