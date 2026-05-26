import type { APIRoute } from 'astro';
import { renderDefaultOgSvg } from '~/lib/og-svg';

export const prerender = false;

export const GET: APIRoute = () => {
  return new Response(renderDefaultOgSvg(), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};
