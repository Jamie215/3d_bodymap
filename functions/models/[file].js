/**
 * Cloudflare Pages Function — model asset proxy.
 *
 * Serves the 3D body assets from a same-origin path (`/models/<file>`) so the
 * real CDN URL never appears in the git repo or in the browser. The upstream
 * location is read from environment variables configured in the Cloudflare
 * dashboard (Settings → Environment variables), NOT from source control:
 *
 *   MODELS_CDN_BASE    Base URL that hosts the asset files
 *                      (e.g. https://cdn.example.com/bodymap)
 *
 * Optional per-file overrides (use when the CDN filenames/paths differ from the
 * app's filenames, or when a file lives at an unrelated URL):
 *
 *   MODELS_CDN_FEMALE         Full URL for female.glb
 *   MODELS_CDN_MALE           Full URL for male.glb
 *   MODELS_CDN_AO             Full URL for body_ao_modified.png
 *   MODELS_CDN_PREVIEW1       Full URL for the female preview SVG
 *   MODELS_CDN_PREVIEW2       Full URL for the male preview SVG
 *
 * Only the known asset files are proxied — this is an allowlist, not an open
 * proxy.
 */

const FILES = {
  'female.glb':            { env: 'MODELS_CDN_FEMALE',         type: 'model/gltf-binary' },
  'male.glb':              { env: 'MODELS_CDN_MALE',           type: 'model/gltf-binary' },
  'body_ao_modified.png':  { env: 'MODELS_CDN_AO',             type: 'image/png' },
  'Type 1.svg':            { env: 'MODELS_CDN_PREVIEW1', type: 'image/svg+xml' },
  'Type 2.svg':            { env: 'MODELS_CDN_PREVIEW2',   type: 'image/svg+xml' },
};

export async function onRequestGet(context) {
  const { params, env } = context;
  const file = params.file;
  const spec = FILES[file];

  if (!spec) {
    return new Response('Not found', { status: 404 });
  }

  const override = env[spec.env];
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
    // Let Cloudflare's edge cache the binaries so the origin CDN is hit rarely.
    cf: { cacheEverything: true, cacheTtl: 86400 },
  });

  if (!upstream.ok) {
    return new Response(`Upstream fetch failed (${upstream.status})`, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', spec.type);
  headers.set('Cache-Control', 'public, max-age=86400, immutable');

  return new Response(upstream.body, { status: 200, headers });
}
