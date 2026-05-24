import { TUNE_VALUE_RANGES } from '~/data/tune-schema';

export type TuneFieldGroup = {
  key: keyof import('~/data/tune-schema').TuneValues;
  legend: string;
  fields: Array<{
    path: string;
    label: string;
    range: keyof typeof TUNE_VALUE_RANGES;
    axis?: 'F' | 'R';
    unit?: string;
    step?: string;
  }>;
};

export const TUNE_FIELD_GROUPS: TuneFieldGroup[] = [
  { key: 'tires', legend: '輪胎', fields: [
    { path: 'tires.pressure_f', label: '胎壓', range: 'pressure', axis: 'F', unit: 'psi' },
    { path: 'tires.pressure_r', label: '胎壓', range: 'pressure', axis: 'R', unit: 'psi' }
  ]},
  { key: 'gearing', legend: '變速箱', fields: [
    { path: 'gearing.final', label: '終傳比', range: 'final', step: '0.01' },
    { path: 'gearing.g1', label: '1 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g2', label: '2 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g3', label: '3 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g4', label: '4 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g5', label: '5 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g6', label: '6 檔', range: 'gear', step: '0.01' }
  ]},
  { key: 'alignment', legend: '定位', fields: [
    { path: 'alignment.camber_f', label: '外傾角', range: 'camber', axis: 'F', unit: '°' },
    { path: 'alignment.camber_r', label: '外傾角', range: 'camber', axis: 'R', unit: '°' },
    { path: 'alignment.toe_f', label: '束角', range: 'toe', axis: 'F', unit: '°' },
    { path: 'alignment.toe_r', label: '束角', range: 'toe', axis: 'R', unit: '°' },
    { path: 'alignment.caster', label: '後傾角', range: 'caster', unit: '°' }
  ]},
  { key: 'antiroll', legend: '防傾桿', fields: [
    { path: 'antiroll.stiffness_f', label: '硬度', range: 'arb', axis: 'F' },
    { path: 'antiroll.stiffness_r', label: '硬度', range: 'arb', axis: 'R' }
  ]},
  { key: 'springs', legend: '彈簧', fields: [
    { path: 'springs.rate_f', label: '彈簧係數', range: 'spring_rate', axis: 'F', unit: 'lb/in', step: '1' },
    { path: 'springs.rate_r', label: '彈簧係數', range: 'spring_rate', axis: 'R', unit: 'lb/in', step: '1' },
    { path: 'springs.height_f', label: '車身高度', range: 'height', axis: 'F', unit: 'in' },
    { path: 'springs.height_r', label: '車身高度', range: 'height', axis: 'R', unit: 'in' }
  ]},
  { key: 'damping', legend: '阻尼', fields: [
    { path: 'damping.rebound_f', label: '回彈', range: 'damp', axis: 'F' },
    { path: 'damping.rebound_r', label: '回彈', range: 'damp', axis: 'R' },
    { path: 'damping.bump_f', label: '壓縮', range: 'damp', axis: 'F' },
    { path: 'damping.bump_r', label: '壓縮', range: 'damp', axis: 'R' }
  ]},
  { key: 'aero', legend: '空力', fields: [
    { path: 'aero.front', label: '前下擾流', range: 'aero_lb', unit: 'lb', step: '1' },
    { path: 'aero.rear', label: '後尾翼', range: 'aero_lb', unit: 'lb', step: '1' }
  ]},
  { key: 'brakes', legend: '煞車', fields: [
    { path: 'brakes.balance_pct_f', label: '前後分配', range: 'brake_pct', unit: '% F', step: '1' },
    { path: 'brakes.pressure_pct', label: '煞車力', range: 'brake_pct', unit: '%', step: '1' }
  ]},
  { key: 'diff', legend: '差速器', fields: [
    { path: 'diff.accel_pct', label: '加速鎖定', range: 'diff_pct', unit: '%', step: '1' },
    { path: 'diff.decel_pct', label: '減速鎖定', range: 'diff_pct', unit: '%', step: '1' }
  ]}
];
