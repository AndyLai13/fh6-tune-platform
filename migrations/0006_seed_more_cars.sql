-- Sprint 6: add cars referenced by the wusyong0403 Bahamut pack
-- (and FH6 launch-lineup gaps the original seed missed).
--
-- Note: id 51 is already used by '2021 Ram 1500 TRX' in
-- 0002_seed_cars_tracks.sql. The wusyong pack's "2024 Ram 1500 TRX"
-- entry reuses the existing car_id=51 row rather than inserting a
-- second Ram variant (model is identical; the year-mismatch is
-- accepted as a known minor discrepancy — see plan deviation note).
--
-- New car ids therefore start at 52 and end at 67 (16 new rows).

INSERT INTO cars (id, year, make, model, slug) VALUES
  (52, 1989, 'Nissan',       'Silvia K''s',                'nissan-silvia-ks-1989'),
  (53, 1970, 'GMC',           'Jimmy',                      'gmc-jimmy-1970'),
  (54, 2001, 'Mitsubishi',    'Lancer Evolution VI TM Edition', 'mitsubishi-evo-vi-tm-2001'),
  (55, 2004, 'Porsche',       '911 GT3 (996)',              'porsche-911-gt3-996-2004'),
  (56, 2024, 'Ford',          'Mustang Dark Horse',         'ford-mustang-dark-horse-2024'),
  (57, 2016, 'Ariel',         'Nomad',                      'ariel-nomad-2016'),
  (58, 2022, 'Subaru',        'BRZ Forza Edition',          'subaru-brz-forza-edition-2022'),
  (59, 2015, 'Land Rover',    'Range Rover Sport SVR',      'land-rover-range-rover-sport-svr-2015'),
  (60, 2026, 'Toyota',        'GR GT Prototype',            'toyota-gr-gt-prototype-2026'),
  (61, 2024, 'Nissan',        'GT-R Nismo',                 'nissan-gtr-nismo-2024'),
  (62, 1985, 'Ford',          'RS200 Evolution',            'ford-rs200-evolution-1985'),
  (63, 2016, 'Lamborghini',   'Centenario LP 770-4',        'lamborghini-centenario-2016'),
  (64, 2023, 'Porsche',       '911 Dakar',                  'porsche-911-dakar-2023'),
  (65, 1999, 'Dodge',         'Viper GTS ACR Forza Edition','dodge-viper-gts-acr-fe-1999'),
  (66, 2015, 'Ultima',        'Evolution Coupe 1020',       'ultima-evolution-coupe-1020-2015'),
  (67, 2023, 'Toyota',        'Camry TRD',                  'toyota-camry-trd-2023');
