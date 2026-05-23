import { describe, expect, it } from 'vitest';
import { makeSlug, makeTuneSlug } from '~/lib/slug';

describe('makeSlug', () => {
  it('lowercases and hyphenates ASCII text', () => {
    expect(makeSlug('Touge Master')).toBe('touge-master');
  });

  it('strips non-ASCII characters', () => {
    expect(makeSlug('走山大師 Touge Master')).toBe('touge-master');
  });

  it('collapses multiple spaces and special chars', () => {
    expect(makeSlug('  Hello   World !!! ')).toBe('hello-world');
  });

  it('returns empty string for purely non-ASCII input', () => {
    expect(makeSlug('走山大師')).toBe('');
  });

  it('truncates at 80 chars', () => {
    expect(makeSlug('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('makeTuneSlug', () => {
  it('combines name + car + random suffix', () => {
    const slug = makeTuneSlug('Touge Master', 'nissan-skyline-gtr-r34-1999');
    expect(slug).toMatch(/^touge-master-nissan-skyline-gtr-r34-1999-[a-z0-9]{6}$/);
  });

  it('uses fallback when name has no ASCII', () => {
    const slug = makeTuneSlug('走山', 'nissan-skyline-gtr-r34-1999');
    expect(slug).toMatch(/^tune-nissan-skyline-gtr-r34-1999-[a-z0-9]{6}$/);
  });
});
