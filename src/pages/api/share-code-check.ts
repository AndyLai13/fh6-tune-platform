import type { APIRoute } from 'astro';
import { getTuneByShareCode } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code')?.trim();
  if (!code || code.length < 5) return Response.json({ exists: false });
  const existing = await getTuneByShareCode(env.DB, code);
  if (!existing) return Response.json({ exists: false });
  return Response.json({ exists: true, existingSlug: existing.slug, existingName: existing.name });
};
