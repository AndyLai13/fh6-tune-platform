-- Fix 2022 → 2023 model year for Porsche 911 GT3 RS (992).
-- FH6 lists it as a 2023 model (matches Porsche official model year);
-- original seed in 0002 used the 2022 Goodwood reveal date by mistake.
-- Safe to UPDATE in place: 0 tunes reference this car_id at time of migration.

UPDATE cars
SET year = 2023,
    slug = 'porsche-911-gt3-rs-992-2023'
WHERE slug = 'porsche-911-gt3-rs-992-2022';
