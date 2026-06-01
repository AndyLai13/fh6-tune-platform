import type { APIRoute } from 'astro';
import { verifyTurnstile } from '~/lib/turnstile';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { hashEditPassword, validatePasswordStrength } from '~/lib/auth';
import { makeTuneSlug } from '~/lib/slug';
import { validateTuneValues } from '~/lib/tune-values';
import { checkRateLimit } from '~/lib/rate-limit';
import { getCarById, insertTune, attachTracks, listTunes, type TuneType, type PiClass, type Drivetrain } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

type UploadBody = {
  name: string;
  share_code: string;
  car_id: number;
  tune_type: string;
  pi_class: string;
  pi_score: number;
  drivetrain: string;
  power_hp?: number;
  weight_lb?: number;
  description?: string;
  tune_values: unknown;
  author_handle: string;
  edit_password: string;
  track_ids?: number[];
  turnstile_token: string;
  honeypot?: string;
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: UploadBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.honeypot) return Response.json({ error: 'spam' }, { status: 400 });
  if (!body.turnstile_token || !(await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET_KEY, clientAddress))) {
    return Response.json({ error: 'turnstile_failed' }, { status: 400 });
  }

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'upload', 5, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  const pwCheck = validatePasswordStrength(body.edit_password ?? '');
  if (!pwCheck.ok) return Response.json({ error: 'weak_password', reason: pwCheck.reason }, { status: 400 });

  const car = await getCarById(env.DB, body.car_id);
  if (!car) return Response.json({ error: 'unknown_car' }, { status: 400 });

  const tv = validateTuneValues(body.tune_values);
  if (!tv.ok) return Response.json({ error: 'invalid_tune_values', details: tv.errors }, { status: 400 });

  const TUNE_TYPES = ['touge', 'drift', 'grip', 'drag', 'rally', 'offroad'] as const;
  const PI_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'] as const;
  const DRIVETRAINS = ['RWD', 'AWD', 'FWD'] as const;
  if (!TUNE_TYPES.includes(body.tune_type as TuneType)) {
    return Response.json({ error: 'invalid_tune_type' }, { status: 400 });
  }
  if (!PI_CLASSES.includes(body.pi_class as PiClass)) {
    return Response.json({ error: 'invalid_pi_class' }, { status: 400 });
  }
  if (!DRIVETRAINS.includes(body.drivetrain as Drivetrain)) {
    return Response.json({ error: 'invalid_drivetrain' }, { status: 400 });
  }

  const passwordHash = await hashEditPassword(body.edit_password);
  const slug = makeTuneSlug(body.name, car.slug);

  let tuneId: number;
  try {
    tuneId = await insertTune(env.DB, {
      slug,
      name: body.name.slice(0, 120),
      share_code: body.share_code.slice(0, 32),
      car_id: car.id,
      tune_type: body.tune_type as TuneType,
      pi_class: body.pi_class as PiClass,
      pi_score: body.pi_score,
      drivetrain: body.drivetrain as Drivetrain,
      power_hp: body.power_hp ?? null,
      weight_lb: body.weight_lb ?? null,
      description: body.description?.slice(0, 4000) ?? null,
      tune_values: JSON.stringify(tv.data),
      source_url: null,
      author_handle: (body.author_handle || 'anonymous').slice(0, 40),
      edit_password_hash: passwordHash,
      ip_hash: ipHash
    });
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return Response.json({ error: 'slug_collision_retry' }, { status: 409 });
    }
    throw err;
  }

  if (body.track_ids?.length) {
    await attachTracks(env.DB, tuneId, body.track_ids.slice(0, 10));
  }

  return Response.json({ slug, edit_url: `/edit/${slug}` }, { status: 201 });
};

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams;
  const result = await listTunes(env.DB, {
    carSlug: q.get('car') ?? undefined,
    tuneType: q.get('type') ?? undefined,
    piClass: q.get('pi') ?? undefined,
    drivetrain: q.get('drivetrain') ?? undefined,
    minRating: q.get('min_rating') ? Number(q.get('min_rating')) : undefined,
    sort: (q.get('sort') as 'downloads' | 'rating' | 'newest' | 'reviews') ?? undefined,
    limit: q.get('limit') ? Number(q.get('limit')) : undefined,
    offset: q.get('offset') ? Number(q.get('offset')) : undefined
  });
  return Response.json(result);
};
