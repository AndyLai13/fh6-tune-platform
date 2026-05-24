import type { TuneValues } from '~/data/tune-schema';

export type TuneRow = {
  id: number;
  slug: string;
  name: string;
  share_code: string;
  car_id: number;
  tune_type: string;
  pi_class: string;
  pi_score: number;
  drivetrain: string;
  power_hp: number | null;
  weight_lb: number | null;
  description: string | null;
  tune_values: string;
  author_handle: string;
  edit_password_hash: string;
  ip_hash: string;
  rating_sum: number;
  rating_count: number;
  download_count: number;
  status: string;
  created_at: number;
  updated_at: number;
};

export async function getCarBySlug(db: D1Database, slug: string) {
  return db.prepare('SELECT * FROM cars WHERE slug = ?').bind(slug).first<{ id: number; year: number; make: string; model: string; slug: string }>();
}

export async function getCarById(db: D1Database, id: number) {
  return db.prepare('SELECT * FROM cars WHERE id = ?').bind(id).first<{ id: number; year: number; make: string; model: string; slug: string }>();
}

export async function getTrackBySlug(db: D1Database, slug: string) {
  return db.prepare('SELECT * FROM tracks WHERE slug = ?').bind(slug).first();
}

export async function listAllTracks(db: D1Database) {
  return db.prepare(`
    SELECT id, name, slug, surface, length_km, region
    FROM tracks
    ORDER BY region, name
  `).all<{ id: number; name: string; slug: string; surface: string; length_km: number | null; region: string | null }>();
}

export async function getTuneBySlug(db: D1Database, slug: string): Promise<TuneRow | null> {
  return db.prepare("SELECT * FROM tunes WHERE slug = ? AND status = 'public'").bind(slug).first<TuneRow>();
}

export async function getTuneForEdit(db: D1Database, slug: string): Promise<TuneRow | null> {
  return db.prepare("SELECT * FROM tunes WHERE slug = ? AND status != 'deleted'").bind(slug).first<TuneRow>();
}

export type ListFilters = {
  carSlug?: string;
  tuneType?: string;
  piClass?: string;
  drivetrain?: string;
  surface?: string;
  minRating?: number;
  search?: string;
  sort?: 'downloads' | 'rating' | 'newest' | 'reviews';
  limit?: number;
  offset?: number;
};

export async function listTunes(db: D1Database, filters: ListFilters = {}) {
  const wh: string[] = ["t.status = 'public'"];
  const params: unknown[] = [];
  if (filters.carSlug) { wh.push('c.slug = ?'); params.push(filters.carSlug); }
  if (filters.tuneType) { wh.push('t.tune_type = ?'); params.push(filters.tuneType); }
  if (filters.piClass) { wh.push('t.pi_class = ?'); params.push(filters.piClass); }
  if (filters.drivetrain) { wh.push('t.drivetrain = ?'); params.push(filters.drivetrain); }
  if (typeof filters.minRating === 'number') {
    wh.push('CASE WHEN t.rating_count = 0 THEN 0 ELSE t.rating_sum / t.rating_count END >= ?');
    params.push(filters.minRating);
  }
  const sort = filters.sort ?? 'downloads';
  const orderBy = {
    downloads: 't.download_count DESC',
    newest: 't.created_at DESC',
    reviews: 't.rating_count DESC',
    rating: '(CAST(t.rating_sum AS REAL) / NULLIF(t.rating_count, 0)) DESC'
  }[sort];
  const limit = Math.min(filters.limit ?? 24, 100);
  const offset = filters.offset ?? 0;

  const sql = `
    SELECT t.*, c.year AS car_year, c.make AS car_make, c.model AS car_model, c.slug AS car_slug
    FROM tunes t
    JOIN cars c ON c.id = t.car_id
    WHERE ${wh.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return db.prepare(sql).bind(...params).all();
}

export async function searchTunes(db: D1Database, query: string, limit = 24) {
  return db.prepare(`
    SELECT t.*, c.year AS car_year, c.make AS car_make, c.model AS car_model, c.slug AS car_slug
    FROM tunes_fts f
    JOIN tunes t ON t.id = f.rowid
    JOIN cars c ON c.id = t.car_id
    WHERE tunes_fts MATCH ? AND t.status = 'public'
    ORDER BY rank
    LIMIT ?
  `).bind(query, limit).all();
}

export type InsertTuneInput = Omit<TuneRow, 'id' | 'rating_sum' | 'rating_count' | 'download_count' | 'created_at' | 'updated_at' | 'status'>;

export async function insertTune(db: D1Database, input: InsertTuneInput) {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.prepare(`
    INSERT INTO tunes (
      slug, name, share_code, car_id, tune_type, pi_class, pi_score,
      drivetrain, power_hp, weight_lb, description, tune_values,
      author_handle, edit_password_hash, ip_hash, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', ?, ?)
  `).bind(
    input.slug, input.name, input.share_code, input.car_id, input.tune_type, input.pi_class, input.pi_score,
    input.drivetrain, input.power_hp, input.weight_lb, input.description, input.tune_values,
    input.author_handle, input.edit_password_hash, input.ip_hash, now, now
  ).run();
  return result.meta.last_row_id as number;
}

export async function attachTracks(db: D1Database, tuneId: number, trackIds: number[]) {
  if (!trackIds.length) return;
  const stmts = trackIds.map((tid) =>
    db.prepare('INSERT INTO tune_tracks (tune_id, track_id) VALUES (?, ?)').bind(tuneId, tid)
  );
  await db.batch(stmts);
}

export async function detachAllTracks(db: D1Database, tuneId: number) {
  await db.prepare('DELETE FROM tune_tracks WHERE tune_id = ?').bind(tuneId).run();
}

export async function listTracksForTune(db: D1Database, tuneId: number) {
  return db.prepare(`
    SELECT t.name, t.length_km, t.region
    FROM tune_tracks tt
    JOIN tracks t ON t.id = tt.track_id
    WHERE tt.tune_id = ?
    ORDER BY t.name
  `).bind(tuneId).all<{ name: string; length_km: number | null; region: string | null }>();
}

export async function incrementDownload(db: D1Database, tuneId: number) {
  await db.prepare('UPDATE tunes SET download_count = download_count + 1 WHERE id = ?').bind(tuneId).run();
}

export async function listReviews(db: D1Database, tuneId: number, limit = 20) {
  return db.prepare(`
    SELECT id, author_handle, rating, body, created_at
    FROM reviews WHERE tune_id = ? AND status = 'public'
    ORDER BY created_at DESC LIMIT ?
  `).bind(tuneId, limit).all();
}

export async function insertReview(db: D1Database, tuneId: number, authorHandle: string, rating: number, body: string | null, ipHash: string) {
  const now = Math.floor(Date.now() / 1000);
  const batch = await db.batch([
    db.prepare(`
      INSERT INTO reviews (tune_id, author_handle, rating, body, ip_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'public', ?)
    `).bind(tuneId, authorHandle, rating, body, ipHash, now),
    db.prepare('UPDATE tunes SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?').bind(rating, tuneId)
  ]);
  return batch;
}

export async function insertReport(db: D1Database, targetKind: 'tune' | 'review', targetId: number, reason: string, ipHash: string) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO reports (target_kind, target_id, reason, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(targetKind, targetId, reason, ipHash, now).run();
}
