import type { APIRoute } from 'astro';
import { verifyTurnstile } from '~/lib/turnstile';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { checkRateLimit } from '~/lib/rate-limit';
import { getTuneBySlug, insertReview } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  const tune = await getTuneBySlug(env.DB, params.id!);
  if (!tune) return new Response('not_found', { status: 404 });

  const body = await request.json() as {
    author_handle?: string; rating?: number; body?: string;
    turnstile_token?: string; honeypot?: string;
  };

  if (body.honeypot) return Response.json({ error: 'spam' }, { status: 400 });
  if (!body.turnstile_token || !(await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET_KEY, clientAddress))) {
    return Response.json({ error: 'turnstile_failed' }, { status: 400 });
  }

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'review', 20, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: 'invalid_rating' }, { status: 400 });
  }

  const handle = (body.author_handle || 'anonymous').slice(0, 40);
  const text = body.body ? body.body.slice(0, 1000) : null;

  await insertReview(env.DB, tune.id, handle, rating, text, ipHash);
  return Response.json({ ok: true }, { status: 201 });
};
