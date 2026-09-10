/**
 * Cloudflare Pages Function — model proxy.
 *
 * Serves the 3D body models from a same-origin path (`/models/<file>.glb`) so
 * the real CDN URL never appears in the git repo or in the browser. The upstream
 * location is read from environment variables configured in the Cloudflare
 * dashboard (Settings → Environment variables), NOT from source control:
 *
 *   MODELS_CDN_BASE    Base URL that hosts female.glb and male.glb
 *                      (e.g. https://cdn.example.com/bodymap)
 *
 * Optional per-file overrides (use when the CDN filenames/paths differ from the
 * app's filenames, or when each model lives at an unrelated URL):
 *
 *   MODELS_CDN_FEMALE  Full URL for the "female" model
 *   MODELS_CDN_MALE    Full URL for the "male" model
 *
 * Only the two known model files are proxied — this is an allowlist, not an
 * open proxy.
 */

const FILE_ENV = {
  'female.glb': 'MODELS_CDN_FEMALE',
  'male.glb': 'MODELS_CDN_MALE',
};

export async function onRequestGet(context) {
  const { params, env } = context;
  const file = params.file;

  if (!Object.prototype.hasOwnProperty.call(FILE_ENV, file)) {
    return new Response('Not found', { status: 404 });
  }

  const override = env[FILE_ENV[file]];
  const base = env.MODELS_CDN_BASE;
  const target = override || (base ? `${base.replace(/\/+$/, '')}/${file}` : null);

  if (!target) {
    return new Response(
      'Model source not configured. Set MODELS_CDN_BASE (or a per-file override) ' +
      'in the Cloudflare Pages environment variables.',
      { status: 500 },
    );
  }

  const upstream = await fetch(target, {
    // Let Cloudflare's edge cache the (large) binary so the origin CDN is hit rarely.
    cf: { cacheEverything: true, cacheTtl: 86400 },
  });

  if (!upstream.ok) {
    return new Response(`Upstream fetch failed (${upstream.status})`, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'model/gltf-binary');
  headers.set('Cache-Control', 'public, max-age=86400, immutable');

  return new Response(upstream.body, { status: 200, headers });
}
