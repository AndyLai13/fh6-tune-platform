-- Sprint 2: extend tunes_fts to denormalize car make/model so search hits car queries.
--
-- Schema change: switch from `content='tunes'` (auto-sync external content) to
-- `content=''` (manual content). Required because we need to denormalize columns
-- from the joined `cars` table that don't exist on `tunes`. Triggers below maintain
-- the index manually. The `tunes_au` WHEN clause skips no-op rebuilds for
-- non-indexed column changes (download_count, rating_sum/count, updated_at).
--
-- Note: contentless FTS5 tables require the special
--   INSERT INTO tunes_fts(tunes_fts, rowid, ...) VALUES ('delete', rowid, ...)
-- syntax to remove rows — plain DELETE is rejected by the FTS5 extension.

DROP TRIGGER IF EXISTS tunes_ai;
DROP TRIGGER IF EXISTS tunes_au;
DROP TRIGGER IF EXISTS tunes_ad;
DROP TABLE IF EXISTS tunes_fts;

CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle, car_make, car_model,
  content=''
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

INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
SELECT t.id, t.name, t.description, t.author_handle, c.make, c.model
FROM tunes t JOIN cars c ON c.id = t.car_id
WHERE t.status = 'public';
