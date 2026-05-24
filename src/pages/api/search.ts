import type { APIRoute } from 'astro';
import { searchTunes } from '~/lib/db';
import { sanitizeFtsQuery } from '~/lib/fts';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });
  const fts = sanitizeFtsQuery(q);
  if (!fts) return Response.json({ results: [] });
  const result = await searchTunes(env.DB, fts, 24);
  return Response.json({ results: result.results });
};
