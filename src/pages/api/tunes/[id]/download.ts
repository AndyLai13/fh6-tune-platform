import type { APIRoute } from 'astro';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { checkRateLimit } from '~/lib/rate-limit';
import { getTuneBySlug, incrementDownload } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ params, clientAddress }) => {
  const tune = await getTuneBySlug(env.DB, params.id!);
  if (!tune) return new Response('not_found', { status: 404 });

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'download', 50, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  await incrementDownload(env.DB, tune.id);
  return Response.json({ ok: true });
};
