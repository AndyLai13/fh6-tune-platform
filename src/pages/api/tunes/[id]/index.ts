import type { APIRoute } from 'astro';
import { getTuneBySlug, getTuneForEdit } from '~/lib/db';
import { verifyEditPassword, verifyEditCookie, signEditCookie } from '~/lib/auth';
import { validateTuneValues } from '~/lib/tune-values';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const tune = await getTuneBySlug(locals.runtime.env.DB, params.id!);
  if (!tune) return new Response('not_found', { status: 404 });
  const { edit_password_hash: _p, ip_hash: _i, tune_values, ...rest } = tune;
  return Response.json({ ...rest, tune_values: JSON.parse(tune_values) });
};

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = locals.runtime.env;
  const slug = params.id!;
  const tune = await getTuneForEdit(env.DB, slug);
  if (!tune) return new Response('not_found', { status: 404 });

  const body = await request.json() as { edit_password?: string; updates: Partial<{
    name: string; description: string; tune_values: unknown;
  }> };

  const cookieToken = cookies.get('touge_edit')?.value;
  let authorized = false;

  if (cookieToken && await verifyEditCookie(cookieToken, slug, env.EDIT_COOKIE_SECRET)) {
    authorized = true;
  } else if (body.edit_password && await verifyEditPassword(body.edit_password, tune.edit_password_hash)) {
    authorized = true;
    const cookie = await signEditCookie(slug, env.EDIT_COOKIE_SECRET, 3600);
    cookies.set('touge_edit', cookie, { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 3600 });
  }

  if (!authorized) return new Response('unauthorized', { status: 401 });

  const updates = body.updates ?? {};
  const sets: string[] = [];
  const params2: unknown[] = [];
  if (typeof updates.name === 'string') { sets.push('name = ?'); params2.push(updates.name.slice(0, 120)); }
  if (typeof updates.description === 'string') { sets.push('description = ?'); params2.push(updates.description.slice(0, 4000)); }
  if (updates.tune_values !== undefined) {
    const v = validateTuneValues(updates.tune_values);
    if (!v.ok) return Response.json({ error: 'invalid_tune_values', details: v.errors }, { status: 400 });
    sets.push('tune_values = ?'); params2.push(JSON.stringify(v.data));
  }
  if (!sets.length) return Response.json({ updated: false });
  sets.push('updated_at = ?'); params2.push(Math.floor(Date.now() / 1000));
  params2.push(tune.id);

  await env.DB.prepare(`UPDATE tunes SET ${sets.join(', ')} WHERE id = ?`).bind(...params2).run();
  return Response.json({ updated: true });
};

export const DELETE: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = locals.runtime.env;
  const slug = params.id!;
  const tune = await getTuneForEdit(env.DB, slug);
  if (!tune) return new Response('not_found', { status: 404 });

  const cookieToken = cookies.get('touge_edit')?.value;
  const body = await request.json().catch(() => ({}));
  const password = (body as { edit_password?: string }).edit_password;

  const authorized =
    (cookieToken && await verifyEditCookie(cookieToken, slug, env.EDIT_COOKIE_SECRET)) ||
    (password && await verifyEditPassword(password, tune.edit_password_hash));

  if (!authorized) return new Response('unauthorized', { status: 401 });

  await env.DB.prepare("UPDATE tunes SET status = 'deleted' WHERE id = ?").bind(tune.id).run();
  cookies.delete('touge_edit', { path: '/' });
  return Response.json({ deleted: true });
};
