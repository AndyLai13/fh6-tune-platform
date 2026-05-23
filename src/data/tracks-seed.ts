export type TrackSeed = {
  name: string;
  slug: string;
  surface: 'asphalt' | 'dirt' | 'snow' | 'mixed';
  length_km?: number;
  region?: string;
};

export const tracksSeed: TrackSeed[] = [
  { name: 'Mt. Akina Downhill', slug: 'mt-akina-downhill', surface: 'asphalt', length_km: 5.2, region: 'Touge' },
  { name: 'Hakone Pass', slug: 'hakone-pass', surface: 'asphalt', length_km: 6.8, region: 'Touge' },
  { name: 'Irohazaka', slug: 'irohazaka', surface: 'asphalt', length_km: 4.4, region: 'Touge' },
  { name: 'Mt. Fuji Touge', slug: 'mt-fuji-touge', surface: 'asphalt', length_km: 7.1, region: 'Touge' },
  { name: 'Tsukuba Circuit', slug: 'tsukuba-circuit', surface: 'asphalt', length_km: 2.0, region: 'Circuit' },
  { name: 'Fuji Speedway', slug: 'fuji-speedway', surface: 'asphalt', length_km: 4.5, region: 'Circuit' },
  { name: 'Suzuka Circuit', slug: 'suzuka-circuit', surface: 'asphalt', length_km: 5.8, region: 'Circuit' },
  { name: 'Bayshore Route', slug: 'bayshore-route', surface: 'asphalt', length_km: 12.0, region: 'Highway' },
  { name: 'Mt. Aso Dirt', slug: 'mt-aso-dirt', surface: 'dirt', length_km: 4.2, region: 'Off-road' },
  { name: 'Hokkaido Snow Run', slug: 'hokkaido-snow-run', surface: 'snow', length_km: 6.3, region: 'Off-road' }
];
