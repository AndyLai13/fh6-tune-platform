import type { TuneValues } from '~/data/tune-schema';
import { TUNE_VALUE_RANGES } from '~/data/tune-schema';

type Range = keyof typeof TUNE_VALUE_RANGES;

const SCHEMA: Array<{ path: string; range: Range }> = [
  { path: 'tires.pressure_f', range: 'pressure' }, { path: 'tires.pressure_r', range: 'pressure' },
  { path: 'gearing.final', range: 'final' },
  { path: 'gearing.g1', range: 'gear' }, { path: 'gearing.g2', range: 'gear' },
  { path: 'gearing.g3', range: 'gear' }, { path: 'gearing.g4', range: 'gear' },
  { path: 'gearing.g5', range: 'gear' }, { path: 'gearing.g6', range: 'gear' },
  { path: 'alignment.camber_f', range: 'camber' }, { path: 'alignment.camber_r', range: 'camber' },
  { path: 'alignment.toe_f', range: 'toe' }, { path: 'alignment.toe_r', range: 'toe' },
  { path: 'alignment.caster', range: 'caster' },
  { path: 'antiroll.stiffness_f', range: 'arb' }, { path: 'antiroll.stiffness_r', range: 'arb' },
  { path: 'springs.rate_f', range: 'spring_rate' }, { path: 'springs.rate_r', range: 'spring_rate' },
  { path: 'springs.height_f', range: 'height' }, { path: 'springs.height_r', range: 'height' },
  { path: 'damping.rebound_f', range: 'damp' }, { path: 'damping.rebound_r', range: 'damp' },
  { path: 'damping.bump_f', range: 'damp' }, { path: 'damping.bump_r', range: 'damp' },
  { path: 'aero.front', range: 'aero_lb' }, { path: 'aero.rear', range: 'aero_lb' },
  { path: 'brakes.balance_pct_f', range: 'brake_pct' }, { path: 'brakes.pressure_pct', range: 'brake_pct' },
  { path: 'diff.accel_pct', range: 'diff_pct' }, { path: 'diff.decel_pct', range: 'diff_pct' }
];

function getPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export type ValidateResult = { ok: true; data: TuneValues } | { ok: false; errors: string[] };

export function validateTuneValues(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object') return { ok: false, errors: ['must be an object'] };
  const errors: string[] = [];
  for (const { path, range } of SCHEMA) {
    const v = getPath(input, path);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${path}: must be a number`);
      continue;
    }
    const { min, max } = TUNE_VALUE_RANGES[range];
    if (v < min || v > max) errors.push(`${path}: ${v} not in [${min}, ${max}]`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: input as TuneValues };
}

export function sampleTuneValues(): TuneValues {
  return {
    tires: { pressure_f: 28.5, pressure_r: 30.0 },
    gearing: { final: 3.97, g1: 3.21, g2: 2.18, g3: 1.56, g4: 1.20, g5: 0.97, g6: 0.79 },
    alignment: { camber_f: -2.4, camber_r: -1.8, toe_f: -0.1, toe_r: 0.2, caster: 6.2 },
    antiroll: { stiffness_f: 28.5, stiffness_r: 22.0 },
    springs: { rate_f: 685, rate_r: 520, height_f: 4.4, height_r: 4.5 },
    damping: { rebound_f: 9.4, rebound_r: 7.1, bump_f: 3.8, bump_r: 2.6 },
    aero: { front: 155, rear: 204 },
    brakes: { balance_pct_f: 52, pressure_pct: 115 },
    diff: { accel_pct: 42, decel_pct: 18 }
  };
}
