import { describe, expect, it } from 'vitest';
import { sanitizeFtsQuery } from '~/lib/fts';

describe('sanitizeFtsQuery', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeFtsQuery('')).toBe('');
  });
  it('returns empty string for single-character input', () => {
    expect(sanitizeFtsQuery('a')).toBe('');
  });
  it('quotes and prefix-matches each token', () => {
    expect(sanitizeFtsQuery('supra mk4')).toBe('"supra"* OR "mk4"*');
  });
  it('strips FTS metacharacters', () => {
    expect(sanitizeFtsQuery('foo"bar*baz')).toBe('"foobarbaz"*');
  });
  it('drops tokens under 2 characters', () => {
    expect(sanitizeFtsQuery('a supra b mk4')).toBe('"supra"* OR "mk4"*');
  });
  it('handles dashes as part of tokens', () => {
    expect(sanitizeFtsQuery('gt-r r34')).toBe('"gt-r"* OR "r34"*');
  });
});
