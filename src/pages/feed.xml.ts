import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c] as string));
}

export const GET: APIRoute = async ({ url }) => {
  const base = `${url.protocol}//${url.host}`;
  const result = await env.DB.prepare(`
    SELECT t.slug, t.name, t.description, t.author_handle, t.created_at,
           c.year AS car_year, c.make AS car_make, c.model AS car_model
    FROM tunes t JOIN cars c ON c.id = t.car_id
    WHERE t.status = 'public'
    ORDER BY t.created_at DESC LIMIT 20
  `).all<{ slug: string; name: string; description: string | null; author_handle: string; created_at: number; car_year: number; car_make: string; car_model: string }>();
  const tunes = result.results ?? [];

  const items = tunes.map((t) => {
    const pubDate = new Date(t.created_at * 1000).toUTCString();
    const title = `${t.name} — ${t.car_year} ${t.car_make} ${t.car_model}`;
    const desc = t.description ?? `${t.car_year} ${t.car_make} ${t.car_model} tune by @${t.author_handle}`;
    return `<item>
      <title>${escapeXml(title)}</title>
      <link>${base}/tune/${escapeXml(t.slug)}</link>
      <guid isPermaLink="true">${base}/tune/${escapeXml(t.slug)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>@${escapeXml(t.author_handle)}</author>
      <description>${escapeXml(desc)}</description>
    </item>`;
  }).join('\n  ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>touge</title>
    <link>${base}/</link>
    <description>Forza Horizon 6 玩家調校資料庫 · 最新 20 筆調校</description>
    <language>zh-TW</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
