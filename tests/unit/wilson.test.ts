import { describe, expect, it } from 'vitest';
import { wilsonScore } from '~/lib/wilson';

describe('wilsonScore', () => {
  it('returns 0 when no reviews', () => {
    expect(wilsonScore(0, 0)).toBe(0);
  });
  it('lower bound increases with more positive reviews at same average', () => {
    const a = wilsonScore(10, 10);
    const b = wilsonScore(100, 100);
    expect(b).toBeGreaterThan(a);
  });
  it('rates many high reviews above few perfect ones', () => {
    const few = wilsonScore(20, 4);
    const many = wilsonScore(960, 200);
    expect(many).toBeGreaterThan(few);
  });
});
