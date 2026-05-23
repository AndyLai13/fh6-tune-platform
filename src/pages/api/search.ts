import type { APIRoute } from 'astro';
import { searchTunes } from '~/lib/db';

export const prerender = false;

function sanitizeFts(query: string): string {
  return query
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"*`)
    .join(' OR ');
}

export const GET: APIRoute = async ({ url, locals }) => {
  const q = url.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });
  const fts = sanitizeFts(q);
  if (!fts) return Response.json({ results: [] });
  const result = await searchTunes(locals.runtime.env.DB, fts, 24);
  return Response.json({ results: result.results });
};
