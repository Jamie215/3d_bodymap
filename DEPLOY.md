# Deploying to Cloudflare Pages

This app is a fully static, no-build ES-module site. Cloudflare Pages serves it
directly from the repository. The 3D model files (`female.glb`, `male.glb`) are
**not** stored in this repo — they are served from a private CDN through a Pages
Function proxy so the CDN URL never appears in git or in the browser.

## 1. Create the Pages project

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**,
and select this repository.

Build settings:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `/` (repository root) |

There is no build step — Pages just publishes the repo contents and picks up the
`functions/` directory automatically.

## 2. Configure the model source (keeps the CDN URL private)

The proxy lives at `functions/models/[file].js` and serves `/models/female.glb`
and `/models/male.glb`. It reads the real CDN location from **environment
variables** — set these in the dashboard, not in code:

**Settings → Environment variables → Production** (and Preview, if you use preview
deploys), add:

| Variable | Value |
|---|---|
| `MODELS_CDN_BASE` | Base URL hosting the two models, e.g. `https://cdn.example.com/bodymap` |

The proxy fetches `${MODELS_CDN_BASE}/female.glb` and `${MODELS_CDN_BASE}/male.glb`.

If your CDN filenames or paths differ, set full per-file URLs instead (either or
both — they override the base):

| Variable | Value |
|---|---|
| `MODELS_CDN_FEMALE` | Full URL of the "Type 1" model |
| `MODELS_CDN_MALE` | Full URL of the "Type 2" model |

Because these are Cloudflare environment variables, the CDN URL stays out of the
git repo and is never sent to the browser — visitors only ever see
`https://<your-site>.pages.dev/models/female.glb`.

> Note: this is obscurity, not access control. If the CDN itself requires no
> auth, anyone who independently learned the real URL could still fetch it. It
> does fully keep the URL out of GitHub and out of the app's client code.

## 3. Deploy

Push to the connected branch. Pages builds (no-op) and publishes automatically.

## Local development

Plain static servers (`python -m http.server`) do **not** run Pages Functions, so
the model proxy won't work under them. To test the full site including the proxy:

```bash
npx wrangler pages dev . --binding MODELS_CDN_BASE=https://cdn.example.com/bodymap
```

(Everything except the 3D models works under any static server.)
