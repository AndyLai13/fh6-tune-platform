import { describe, expect, it } from 'vitest';
import { validateTuneValues, sampleTuneValues } from '~/lib/tune-values';

describe('validateTuneValues', () => {
  it('accepts a complete valid object', () => {
    const r = validateTuneValues(sampleTuneValues());
    expect(r.ok).toBe(true);
  });
  it('rejects when a required field is missing', () => {
    const v: any = sampleTuneValues();
    delete v.tires.pressure_f;
    const r = validateTuneValues(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/tires\.pressure_f/);
  });
  it('rejects when a field is out of range', () => {
    const v = sampleTuneValues();
    v.alignment.camber_f = -99;
    const r = validateTuneValues(v);
    expect(r.ok).toBe(false);
  });
  it('rejects when a field is not a number', () => {
    const v: any = sampleTuneValues();
    v.springs.rate_f = 'soft';
    const r = validateTuneValues(v);
    expect(r.ok).toBe(false);
  });
});
