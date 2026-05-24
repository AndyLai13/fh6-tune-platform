-- Sprint 4: switch tunes_fts tokenizer to unicode61 so CJK characters survive indexing.
-- Strategy: same drop-recreate-backfill pattern as 0003. Triggers preserved verbatim from 0003.

DROP TRIGGER IF EXISTS tunes_ai;
DROP TRIGGER IF EXISTS tunes_au;
DROP TRIGGER IF EXISTS tunes_ad;
DROP TABLE IF EXISTS tunes_fts;

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

INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
SELECT t.id, t.name, t.description, t.author_handle, c.make, c.model
FROM tunes t JOIN cars c ON c.id = t.car_id
WHERE t.status = 'public';
