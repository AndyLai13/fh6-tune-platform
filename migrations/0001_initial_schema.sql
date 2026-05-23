CREATE TABLE tunes (
  id              INTEGER PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  share_code      TEXT NOT NULL,
  car_id          INTEGER NOT NULL REFERENCES cars(id),
  tune_type       TEXT NOT NULL CHECK (tune_type IN ('touge','drift','grip','drag','rally','offroad')),
  pi_class        TEXT NOT NULL CHECK (pi_class IN ('D','C','B','A','S1','S2','X')),
  pi_score        INTEGER NOT NULL,
  drivetrain      TEXT NOT NULL CHECK (drivetrain IN ('RWD','AWD','FWD')),
  power_hp        INTEGER,
  weight_lb       INTEGER,
  description     TEXT,
  tune_values     TEXT NOT NULL,
  author_handle   TEXT NOT NULL,
  edit_password_hash TEXT NOT NULL,
  ip_hash         TEXT NOT NULL,
  rating_sum      INTEGER NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  download_count  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'public' CHECK (status IN ('public','hidden','deleted')),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX idx_tunes_car ON tunes(car_id, status);
CREATE INDEX idx_tunes_type ON tunes(tune_type, status);
CREATE INDEX idx_tunes_rating ON tunes(rating_sum, rating_count) WHERE status = 'public';
CREATE INDEX idx_tunes_downloads ON tunes(download_count DESC) WHERE status = 'public';

CREATE TABLE cars (
  id     INTEGER PRIMARY KEY,
  year   INTEGER NOT NULL,
  make   TEXT NOT NULL,
  model  TEXT NOT NULL,
  slug   TEXT UNIQUE NOT NULL
);
CREATE INDEX idx_cars_slug ON cars(slug);
CREATE INDEX idx_cars_make ON cars(make);

CREATE TABLE tracks (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  surface    TEXT NOT NULL CHECK (surface IN ('asphalt','dirt','snow','mixed')),
  length_km  REAL,
  region     TEXT
);

CREATE TABLE tune_tracks (
  tune_id   INTEGER NOT NULL REFERENCES tunes(id) ON DELETE CASCADE,
  track_id  INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  fit_score INTEGER,
  PRIMARY KEY (tune_id, track_id)
);

CREATE TABLE reviews (
  id            INTEGER PRIMARY KEY,
  tune_id       INTEGER NOT NULL REFERENCES tunes(id) ON DELETE CASCADE,
  author_handle TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT,
  ip_hash       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'public' CHECK (status IN ('public','hidden','deleted')),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_reviews_tune ON reviews(tune_id, status, created_at DESC);

CREATE TABLE reports (
  id           INTEGER PRIMARY KEY,
  target_kind  TEXT NOT NULL CHECK (target_kind IN ('tune','review')),
  target_id    INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  ip_hash      TEXT NOT NULL,
  resolved     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle,
  content='tunes', content_rowid='id'
);

CREATE TRIGGER tunes_ai AFTER INSERT ON tunes BEGIN
  INSERT INTO tunes_fts(rowid, name, description, author_handle)
  VALUES (new.id, new.name, new.description, new.author_handle);
END;

CREATE TRIGGER tunes_au AFTER UPDATE ON tunes BEGIN
  UPDATE tunes_fts SET name = new.name, description = new.description, author_handle = new.author_handle
  WHERE rowid = new.id;
END;

CREATE TRIGGER tunes_ad AFTER DELETE ON tunes BEGIN
  DELETE FROM tunes_fts WHERE rowid = old.id;
END;
