import { describe, it, expect } from 'vitest';
import type { TuneRow } from '~/lib/db';

describe('TuneRow type allows null for share-code-only fields', () => {
  it('accepts null tune_values, pi_score, drivetrain, source_url', () => {
    const row: TuneRow = {
      id: 1,
      slug: 'x',
      name: 'X',
      share_code: '123-456-789',
      car_id: 1,
      tune_type: 'touge',
      pi_class: 'R',
      pi_score: null,
      drivetrain: null,
      power_hp: null,
      weight_lb: null,
      description: null,
      tune_values: null,
      source_url: 'https://example.com',
      author_handle: 'a',
      edit_password_hash: 'h',
      ip_hash: 'i',
      rating_sum: 0,
      rating_count: 0,
      download_count: 0,
      status: 'public',
      created_at: 0,
      updated_at: 0
    };
    expect(row.tune_values).toBeNull();
    expect(row.pi_class).toBe('R'); // 'R' must be in the union type
  });

  it('still accepts non-null tune_values for legacy/full-detail tunes', () => {
    const row: TuneRow = {
      id: 2,
      slug: 'y',
      name: 'Y',
      share_code: '999-888-777',
      car_id: 1,
      tune_type: 'touge',
      pi_class: 'A',
      pi_score: 800,
      drivetrain: 'RWD',
      power_hp: 280,
      weight_lb: 2400,
      description: 'desc',
      tune_values: '{}',
      source_url: null,
      author_handle: 'a',
      edit_password_hash: 'h',
      ip_hash: 'i',
      rating_sum: 0,
      rating_count: 0,
      download_count: 0,
      status: 'public',
      created_at: 0,
      updated_at: 0
    };
    expect(row.tune_values).toBe('{}');
    expect(row.drivetrain).toBe('RWD');
  });
});
