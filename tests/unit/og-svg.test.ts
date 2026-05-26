import { describe, it, expect } from 'vitest';
import { renderTuneOgSvg, renderDefaultOgSvg } from '../../src/lib/og-svg';

describe('renderTuneOgSvg', () => {
  it('embeds tune name, car, type, PI class into 1200x630 SVG', () => {
    const svg = renderTuneOgSvg(
      { name: '森林拉力 GR Yaris', tune_type: 'rally', pi_class: 'A', pi_score: 800, author_handle: 'demo' },
      { year: 2021, make: 'Toyota', model: 'GR Yaris' }
    );
    expect(svg).toMatch(/^<svg[^>]+width="1200"[^>]+height="630"/);
    expect(svg).toContain('森林拉力 GR Yaris');
    expect(svg).toContain('2021 Toyota GR Yaris');
    expect(svg).toContain('RALLY');
    expect(svg).toContain('A · 800');
    expect(svg).toContain('@demo');
    expect(svg).toContain('touge.gg');
  });

  it('escapes XML-unsafe characters in tune name', () => {
    const svg = renderTuneOgSvg(
      { name: 'GT3 RS <special> & "fast"', tune_type: 'grip', pi_class: 'S1', pi_score: 880, author_handle: 'x' },
      { year: 2022, make: 'Porsche', model: '911 GT3 RS' }
    );
    expect(svg).not.toContain('<special>');
    expect(svg).toContain('&lt;special&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;fast&quot;');
  });

  it('truncates very long tune names to fit', () => {
    const longName = '超級長的調校名稱'.repeat(20);
    const svg = renderTuneOgSvg(
      { name: longName, tune_type: 'touge', pi_class: 'A', pi_score: 800, author_handle: 'x' },
      { year: 2020, make: 'Foo', model: 'Bar' }
    );
    expect(svg).toMatch(/…<\/text>/);
  });
});

describe('renderDefaultOgSvg', () => {
  it('returns a 1200x630 SVG with site name', () => {
    const svg = renderDefaultOgSvg();
    expect(svg).toMatch(/^<svg[^>]+width="1200"[^>]+height="630"/);
    expect(svg).toContain('touge.gg');
    expect(svg).toContain('Forza Horizon 6');
  });
});
