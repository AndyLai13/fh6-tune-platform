-- Sprint 2: extend tunes_fts to denormalize car make/model so search hits car queries.
-- Strategy: drop the old triggers + FTS table, recreate FTS with extra columns,
-- recreate triggers to JOIN cars on write, then rebuild the index from existing rows.

DROP TRIGGER IF EXISTS tunes_ai;
DROP TRIGGER IF EXISTS tunes_au;
DROP TRIGGER IF EXISTS tunes_ad;
DROP TABLE IF EXISTS tunes_fts;

CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle, car_make, car_model,
  content=''
);

CREATE TRIGGER tunes_ai AFTER INSERT ON tunes BEGIN
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  VALUES (
    new.id,
    new.name,
    new.description,
    new.author_handle,
    (SELECT make FROM cars WHERE id = new.car_id),
    (SELECT model FROM cars WHERE id = new.car_id)
  );
END;

CREATE TRIGGER tunes_au AFTER UPDATE ON tunes BEGIN
  DELETE FROM tunes_fts WHERE rowid = old.id;
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  VALUES (
    new.id,
    new.name,
    new.description,
    new.author_handle,
    (SELECT make FROM cars WHERE id = new.car_id),
    (SELECT model FROM cars WHERE id = new.car_id)
  );
END;

CREATE TRIGGER tunes_ad AFTER DELETE ON tunes BEGIN
  DELETE FROM tunes_fts WHERE rowid = old.id;
END;

INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
SELECT t.id, t.name, t.description, t.author_handle, c.make, c.model
FROM tunes t JOIN cars c ON c.id = t.car_id
WHERE t.status != 'deleted';
