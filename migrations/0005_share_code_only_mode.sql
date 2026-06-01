-- Sprint 6: allow share-code-only tunes (no per-tune detail values).
--
-- Changes:
--   - tune_values, pi_score, drivetrain: NOT NULL -> nullable
--   - pi_class CHECK: add 'R' (top class per author convention)
--   - new column: source_url TEXT (origin URL for seeded content)
--
-- SQLite cannot ALTER NOT NULL/CHECK in place, so the tunes table is
-- rebuilt via the standard create-new/copy/drop/rename pattern.
--
-- FTS5 (contentless table + manual triggers) is preserved verbatim from
-- 0003_fts_car_columns.sql + 0004_fts_unicode61.sql — content='', tokenize='unicode61',
-- same WHEN-clause on the AFTER UPDATE trigger.

-- D1 wraps multi-statement files atomically; explicit BEGIN TRANSACTION /
-- COMMIT / PRAGMA foreign_keys are rejected by the remote adapter, so we
-- rely on the implicit transaction (matches 0001/0003/0004).

-- Drop FTS objects that reference tunes (recreated below)
DROP TRIGGER IF EXISTS tunes_ai;
DROP TRIGGER IF EXISTS tunes_au;
DROP TRIGGER IF EXISTS tunes_ad;
DROP TABLE IF EXISTS tunes_fts;

CREATE TABLE tunes_new (
  id              INTEGER PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  share_code      TEXT NOT NULL,
  car_id          INTEGER NOT NULL REFERENCES cars(id),
  tune_type       TEXT NOT NULL CHECK (tune_type IN ('touge','drift','grip','drag','rally','offroad')),
  pi_class        TEXT NOT NULL CHECK (pi_class IN ('D','C','B','A','S1','S2','R','X')),
  pi_score        INTEGER,
  drivetrain      TEXT CHECK (drivetrain IS NULL OR drivetrain IN ('RWD','AWD','FWD')),
  power_hp        INTEGER,
  weight_lb       INTEGER,
  description     TEXT,
  tune_values     TEXT,
  source_url      TEXT,
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

INSERT INTO tunes_new (
  id, slug, name, share_code, car_id, tune_type, pi_class, pi_score,
  drivetrain, power_hp, weight_lb, description, tune_values, source_url,
  author_handle, edit_password_hash, ip_hash, rating_sum, rating_count,
  download_count, status, created_at, updated_at
)
SELECT
  id, slug, name, share_code, car_id, tune_type, pi_class, pi_score,
  drivetrain, power_hp, weight_lb, description, tune_values, NULL AS source_url,
  author_handle, edit_password_hash, ip_hash, rating_sum, rating_count,
  download_count, status, created_at, updated_at
FROM tunes;

DROP TABLE tunes;
ALTER TABLE tunes_new RENAME TO tunes;

-- Recreate indexes (verbatim from 0001_initial_schema.sql)
CREATE INDEX idx_tunes_car       ON tunes(car_id, status);
CREATE INDEX idx_tunes_type      ON tunes(tune_type, status);
CREATE INDEX idx_tunes_rating    ON tunes(rating_sum, rating_count) WHERE status = 'public';
CREATE INDEX idx_tunes_downloads ON tunes(download_count DESC)      WHERE status = 'public';

-- Recreate FTS5 (preserves 0003 + 0004 contentless + unicode61 setup)
CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle, car_make, car_model,
  content='',
  tokenize='unicode61'
);

CREATE TRIGGER tunes_ai AFTER INSERT ON tunes
WHEN new.status = 'public'
BEGIN
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  SELECT new.id, new.name, new.description, new.author_handle, c.make, c.model
  FROM cars c WHERE c.id = new.car_id;
END;

CREATE TRIGGER tunes_au AFTER UPDATE ON tunes
WHEN OLD.name != NEW.name
  OR OLD.description IS NOT NEW.description
  OR OLD.author_handle != NEW.author_handle
  OR OLD.car_id != NEW.car_id
  OR OLD.status != NEW.status
BEGIN
  INSERT INTO tunes_fts(tunes_fts, rowid, name, description, author_handle, car_make, car_model)
  SELECT 'delete', old.id, old.name, old.description, old.author_handle, c.make, c.model
  FROM cars c WHERE c.id = old.car_id;
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  SELECT new.id, new.name, new.description, new.author_handle, c.make, c.model
  FROM cars c WHERE c.id = new.car_id AND new.status = 'public';
END;

CREATE TRIGGER tunes_ad AFTER DELETE ON tunes BEGIN
  INSERT INTO tunes_fts(tunes_fts, rowid, name, description, author_handle, car_make, car_model)
  SELECT 'delete', old.id, old.name, old.description, old.author_handle, c.make, c.model
  FROM cars c WHERE c.id = old.car_id;
END;

-- Backfill FTS index from current public tunes
INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
SELECT t.id, t.name, t.description, t.author_handle, c.make, c.model
FROM tunes t JOIN cars c ON c.id = t.car_id
WHERE t.status = 'public';
