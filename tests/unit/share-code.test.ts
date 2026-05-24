import { describe, expect, it } from 'vitest';
import { formatShareCode } from '~/lib/share-code';

describe('formatShareCode', () => {
  it('passes through already-formatted codes', () => {
    expect(formatShareCode('821-471-933')).toBe('821-471-933');
  });
  it('inserts hyphens into 9-char alphanumeric', () => {
    expect(formatShareCode('821471933')).toBe('821-471-933');
  });
  it('uppercases letters', () => {
    expect(formatShareCode('abc123def')).toBe('ABC-123-DEF');
  });
  it('strips non-alphanumeric noise before formatting', () => {
    expect(formatShareCode('821 471 933')).toBe('821-471-933');
    expect(formatShareCode('821.471.933')).toBe('821-471-933');
    expect(formatShareCode('821/471/933')).toBe('821-471-933');
  });
  it('returns partial for shorter input', () => {
    expect(formatShareCode('821')).toBe('821');
    expect(formatShareCode('821471')).toBe('821-471');
  });
  it('truncates longer than 9 alphanumeric to 9', () => {
    expect(formatShareCode('821471933EXTRA')).toBe('821-471-933');
  });
  it('handles empty input', () => {
    expect(formatShareCode('')).toBe('');
  });
});
