import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const base = `${url.protocol}//${url.host}`;
  const tunesResult = await env.DB.prepare("SELECT slug, updated_at FROM tunes WHERE status='public' ORDER BY updated_at DESC LIMIT 50000").all();
  const carsResult = await env.DB.prepare('SELECT slug FROM cars').all();
  const tracksResult = await env.DB.prepare('SELECT slug FROM tracks').all();
  const tunersResult = await env.DB.prepare("SELECT DISTINCT author_handle FROM tunes WHERE status='public'").all();
  const tunes = (tunesResult.results ?? []) as Array<{ slug: string; updated_at: number }>;
  const cars = (carsResult.results ?? []) as Array<{ slug: string }>;
  const tracks = (tracksResult.results ?? []) as Array<{ slug: string }>;
  const tuners = (tunersResult.results ?? []) as Array<{ author_handle: string }>;

  const items = [
    `<url><loc>${base}/</loc></url>`,
    `<url><loc>${base}/browse</loc></url>`,
    `<url><loc>${base}/tracks</loc></url>`,
    `<url><loc>${base}/about</loc></url>`,
    ...cars.map((c) => `<url><loc>${base}/browse?car=${c.slug}</loc></url>`),
    ...tracks.map((t) => `<url><loc>${base}/tracks/${t.slug}</loc></url>`),
    ...tuners.map((t) => `<url><loc>${base}/tuner/${encodeURIComponent(t.author_handle)}</loc></url>`),
    ...tunes.map((t) => `<url><loc>${base}/tune/${t.slug}</loc><lastmod>${new Date(t.updated_at * 1000).toISOString()}</lastmod></url>`)
  ].join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
};
