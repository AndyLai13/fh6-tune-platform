export type CarSeed = {
  year: number;
  make: string;
  model: string;
  slug: string;
};

export const carsSeed: CarSeed[] = [
  // Nissan
  { year: 1989, make: 'Nissan', model: 'Skyline GT-R R32', slug: 'nissan-skyline-gtr-r32-1989' },
  { year: 1995, make: 'Nissan', model: 'Skyline GT-R R33', slug: 'nissan-skyline-gtr-r33-1995' },
  { year: 1999, make: 'Nissan', model: 'Skyline GT-R R34', slug: 'nissan-skyline-gtr-r34-1999' },
  { year: 1993, make: 'Nissan', model: '240SX S13', slug: 'nissan-240sx-s13-1993' },
  { year: 1998, make: 'Nissan', model: 'Silvia S15 Spec-R', slug: 'nissan-silvia-s15-1998' },
  // Toyota
  { year: 1986, make: 'Toyota', model: 'Sprinter Trueno AE86', slug: 'toyota-sprinter-trueno-ae86-1986' },
  { year: 1994, make: 'Toyota', model: 'Supra MK4', slug: 'toyota-supra-mk4-1994' },
  { year: 1999, make: 'Toyota', model: 'Chaser JZX100', slug: 'toyota-chaser-jzx100-1999' },
  // Mazda
  { year: 1992, make: 'Mazda', model: 'RX-7 FD3S', slug: 'mazda-rx7-fd3s-1992' },
  { year: 1989, make: 'Mazda', model: 'MX-5 Miata NA', slug: 'mazda-mx5-miata-na-1989' },
  // Honda
  { year: 1999, make: 'Honda', model: 'S2000 AP1', slug: 'honda-s2000-ap1-1999' },
  { year: 1997, make: 'Honda', model: 'Civic Type R EK9', slug: 'honda-civic-type-r-ek9-1997' },
  { year: 2002, make: 'Honda', model: 'NSX-R', slug: 'honda-nsx-r-2002' },
  // Mitsubishi
  { year: 2008, make: 'Mitsubishi', model: 'Lancer Evolution X', slug: 'mitsubishi-evo-x-2008' },
  { year: 1999, make: 'Mitsubishi', model: 'Lancer Evolution VI', slug: 'mitsubishi-evo-vi-1999' },
  // Subaru
  { year: 2004, make: 'Subaru', model: 'Impreza WRX STI', slug: 'subaru-impreza-wrx-sti-2004' }
];
