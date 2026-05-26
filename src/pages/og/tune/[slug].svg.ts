import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getTuneBySlug, getCarById } from '~/lib/db';
import { renderTuneOgSvg } from '~/lib/og-svg';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const raw = params.slug!;
  // Astro may include the .svg extension in the param depending on the route
  const slug = raw.replace(/\.svg$/, '');
  const tune = await getTuneBySlug(env.DB, slug);
  if (!tune) {
    return new Response('Not found', { status: 404 });
  }
  const car = await getCarById(env.DB, tune.car_id);
  const svg = renderTuneOgSvg(tune, car);
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
};
