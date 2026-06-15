import { describe, it, expect } from 'vitest';
import { COUNTRY_ZH, BODY_STYLE_ZH } from '~/lib/car-i18n';

describe('car-i18n maps', () => {
  it('maps known countries to Chinese', () => {
    expect(COUNTRY_ZH['Japan']).toBe('日本');
    expect(COUNTRY_ZH['Germany']).toBe('德國');
    expect(COUNTRY_ZH['USA']).toBe('美國');
    expect(COUNTRY_ZH['Italy']).toBe('義大利');
    expect(COUNTRY_ZH['UK']).toBe('英國');
    expect(COUNTRY_ZH['France']).toBe('法國');
    expect(COUNTRY_ZH['Sweden']).toBe('瑞典');
  });

  it('maps known body styles to Chinese', () => {
    expect(BODY_STYLE_ZH['Coupe']).toBe('雙門跑車');
    expect(BODY_STYLE_ZH['Hatchback']).toBe('掀背車');
    expect(BODY_STYLE_ZH['Sedan']).toBe('房車');
    expect(BODY_STYLE_ZH['SUV']).toBe('SUV');
    expect(BODY_STYLE_ZH['Roadster']).toBe('敞篷跑車');
  });

  it('returns undefined for unknown keys (caller can fall back to raw)', () => {
    expect(COUNTRY_ZH['Atlantis']).toBeUndefined();
    expect(BODY_STYLE_ZH['Flying Saucer']).toBeUndefined();
  });
});
