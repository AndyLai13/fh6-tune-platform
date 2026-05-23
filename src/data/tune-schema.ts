export type TuneValues = {
  tires: { pressure_f: number; pressure_r: number };
  gearing: {
    final: number;
    g1: number; g2: number; g3: number;
    g4: number; g5: number; g6: number;
  };
  alignment: {
    camber_f: number; camber_r: number;
    toe_f: number; toe_r: number;
    caster: number;
  };
  antiroll: { stiffness_f: number; stiffness_r: number };
  springs: {
    rate_f: number; rate_r: number;
    height_f: number; height_r: number;
  };
  damping: {
    rebound_f: number; rebound_r: number;
    bump_f: number; bump_r: number;
  };
  aero: { front: number; rear: number };
  brakes: { balance_pct_f: number; pressure_pct: number };
  diff: { accel_pct: number; decel_pct: number };
};

export const TUNE_VALUE_RANGES: Record<string, { min: number; max: number }> = {
  pressure: { min: 0, max: 100 },
  gear: { min: 0, max: 10 },
  final: { min: 0, max: 10 },
  camber: { min: -10, max: 10 },
  toe: { min: -5, max: 5 },
  caster: { min: 0, max: 10 },
  arb: { min: 0, max: 65 },
  spring_rate: { min: 0, max: 2500 },
  height: { min: 0, max: 10 },
  damp: { min: 0, max: 20 },
  aero_lb: { min: 0, max: 600 },
  brake_pct: { min: 0, max: 200 },
  diff_pct: { min: 0, max: 100 }
};
