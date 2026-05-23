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
  { year: 2003, make: 'Nissan', model: '350Z', slug: 'nissan-350z-2003' },
  { year: 2015, make: 'Nissan', model: '370Z Nismo', slug: 'nissan-370z-nismo-2015' },
  { year: 2020, make: 'Nissan', model: 'GT-R R35 Nismo', slug: 'nissan-gtr-r35-nismo-2020' },
  // Toyota
  { year: 1986, make: 'Toyota', model: 'Sprinter Trueno AE86', slug: 'toyota-sprinter-trueno-ae86-1986' },
  { year: 1994, make: 'Toyota', model: 'Supra MK4', slug: 'toyota-supra-mk4-1994' },
  { year: 1999, make: 'Toyota', model: 'Chaser JZX100', slug: 'toyota-chaser-jzx100-1999' },
  { year: 1994, make: 'Toyota', model: 'Celica GT-Four ST205', slug: 'toyota-celica-gt-four-st205-1994' },
  { year: 2020, make: 'Toyota', model: 'GR Supra MK5', slug: 'toyota-gr-supra-mk5-2020' },
  { year: 2021, make: 'Toyota', model: 'GR Yaris', slug: 'toyota-gr-yaris-2021' },
  { year: 2022, make: 'Toyota', model: 'GR86', slug: 'toyota-gr86-2022' },
  // Mazda
  { year: 1989, make: 'Mazda', model: 'RX-7 FC3S', slug: 'mazda-rx7-fc3s-1989' },
  { year: 1992, make: 'Mazda', model: 'RX-7 FD3S', slug: 'mazda-rx7-fd3s-1992' },
  { year: 1989, make: 'Mazda', model: 'MX-5 Miata NA', slug: 'mazda-mx5-miata-na-1989' },
  // Honda
  { year: 1995, make: 'Honda', model: 'Integra Type R DC2', slug: 'honda-integra-type-r-dc2-1995' },
  { year: 1997, make: 'Honda', model: 'Civic Type R EK9', slug: 'honda-civic-type-r-ek9-1997' },
  { year: 1999, make: 'Honda', model: 'S2000 AP1', slug: 'honda-s2000-ap1-1999' },
  { year: 2002, make: 'Honda', model: 'NSX-R', slug: 'honda-nsx-r-2002' },
  { year: 2017, make: 'Honda', model: 'Civic Type R FK8', slug: 'honda-civic-type-r-fk8-2017' },
  // Mitsubishi
  { year: 1999, make: 'Mitsubishi', model: 'Lancer Evolution VI', slug: 'mitsubishi-evo-vi-1999' },
  { year: 2008, make: 'Mitsubishi', model: 'Lancer Evolution X', slug: 'mitsubishi-evo-x-2008' },
  { year: 1997, make: 'Mitsubishi', model: '3000GT VR-4', slug: 'mitsubishi-3000gt-vr4-1997' },
  // Subaru
  { year: 1998, make: 'Subaru', model: 'Impreza 22B STI', slug: 'subaru-impreza-22b-sti-1998' },
  { year: 2004, make: 'Subaru', model: 'Impreza WRX STI', slug: 'subaru-impreza-wrx-sti-2004' },
  { year: 2022, make: 'Subaru', model: 'BRZ tS', slug: 'subaru-brz-ts-2022' },
  // BMW
  { year: 1988, make: 'BMW', model: 'M3 E30 Sport Evolution', slug: 'bmw-m3-e30-sport-evo-1988' },
  { year: 2002, make: 'BMW', model: 'M3 E46', slug: 'bmw-m3-e46-2002' },
  { year: 2019, make: 'BMW', model: 'M2 Competition', slug: 'bmw-m2-competition-2019' },
  // Porsche
  { year: 1973, make: 'Porsche', model: '911 Carrera RS 2.7', slug: 'porsche-911-carrera-rs-1973' },
  { year: 2022, make: 'Porsche', model: '911 GT3 RS (992)', slug: 'porsche-911-gt3-rs-992-2022' },
  { year: 2022, make: 'Porsche', model: 'Cayman GT4 RS', slug: 'porsche-cayman-gt4-rs-2022' },
  // Audi
  { year: 1986, make: 'Audi', model: 'Sport Quattro S1', slug: 'audi-sport-quattro-s1-1986' },
  { year: 2022, make: 'Audi', model: 'R8 V10 Performance', slug: 'audi-r8-v10-performance-2022' },
  // Mercedes-AMG
  { year: 2021, make: 'Mercedes-AMG', model: 'GT Black Series', slug: 'mercedes-amg-gt-black-series-2021' },
  // Lamborghini
  { year: 2021, make: 'Lamborghini', model: 'Huracán STO', slug: 'lamborghini-huracan-sto-2021' },
  // Ferrari
  { year: 1987, make: 'Ferrari', model: 'F40', slug: 'ferrari-f40-1987' },
  { year: 2018, make: 'Ferrari', model: '488 Pista', slug: 'ferrari-488-pista-2018' },
  // McLaren
  { year: 2017, make: 'McLaren', model: '720S', slug: 'mclaren-720s-2017' },
  // Lotus
  { year: 2018, make: 'Lotus', model: 'Exige Cup 430', slug: 'lotus-exige-cup-430-2018' },
  // Lancia
  { year: 1992, make: 'Lancia', model: 'Delta HF Integrale Evo', slug: 'lancia-delta-hf-integrale-evo-1992' },
  // Alpine
  { year: 2022, make: 'Alpine', model: 'A110 S', slug: 'alpine-a110-s-2022' },
  // Ford
  { year: 1970, make: 'Ford', model: 'Mustang Boss 302', slug: 'ford-mustang-boss-302-1970' },
  { year: 2016, make: 'Ford', model: 'Mustang Shelby GT350R', slug: 'ford-mustang-shelby-gt350r-2016' },
  { year: 2023, make: 'Ford', model: 'F-150 Raptor R', slug: 'ford-f150-raptor-r-2023' },
  // Chevrolet
  { year: 2023, make: 'Chevrolet', model: 'Corvette C8 Z06', slug: 'chevrolet-corvette-c8-z06-2023' },
  // Dodge
  { year: 2018, make: 'Dodge', model: 'Challenger SRT Demon', slug: 'dodge-challenger-srt-demon-2018' },
  // Ram
  { year: 2021, make: 'Ram', model: '1500 TRX', slug: 'ram-1500-trx-2021' }
];
