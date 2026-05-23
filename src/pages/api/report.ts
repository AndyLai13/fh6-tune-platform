import type { APIRoute } from 'astro';
import { verifyTurnstile } from '~/lib/turnstile';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { checkRateLimit } from '~/lib/rate-limit';
import { insertReport } from '~/lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  const body = await request.json() as {
    target_kind?: 'tune' | 'review';
    target_id?: number;
    reason?: string;
    turnstile_token?: string;
  };

  if (!body.turnstile_token || !(await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET_KEY, clientAddress))) {
    return Response.json({ error: 'turnstile_failed' }, { status: 400 });
  }
  if (body.target_kind !== 'tune' && body.target_kind !== 'review') {
    return Response.json({ error: 'invalid_target_kind' }, { status: 400 });
  }
  if (!body.target_id || !body.reason) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'report', 10, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  await insertReport(env.DB, body.target_kind, body.target_id, body.reason.slice(0, 500), ipHash);
  return Response.json({ ok: true }, { status: 201 });
};
