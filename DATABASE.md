# Connecting a Database for Data Collection

This guide covers **where submitted study data should go** now that the app is
being handed off, and gives a step-by-step walkthrough for wiring it up.

It answers three things:

1. Is Firebase still the right choice for a ~30-participant study?
2. What to use instead, and why.
3. How to implement it — schema, server endpoint, client wiring, deploy, and
   getting the data back out for analysis.

---

## Background: how submission works today

The app is a static, no-build site deployed on **Cloudflare Pages**. It already
ships one **Pages Function** — `functions/models/[file].js` — that proxies the
private 3D-model assets from a same-origin `/models/*` path (see
[DEPLOY.md](./DEPLOY.md)).

Firebase (Firestore) was used during testing but has been removed:

- `js/services/firebaseService.js` is **gitignored** (it held the project
  credentials) and is not in the repo.
- The `<script>` tags in `index.html` and the `firebaseService.init()` call in
  `js/app/main.js` are commented out.

The submission path itself is intact. `prepareSubmissionData()` in
`js/services/submissionService.js` assembles a `SubmissionPayload` object, and
`js/app/appController.js` has a clearly marked stub where the backend call goes:

```js
// ── Integration point ──────────────────────────────────────
// Replace with your platform's API call:
//   const response = await apiService.submit(submissionData);
//   const success = response.ok;
//
// For now, simulate success to keep the app testable:
const success = true;
// ───────────────────────────────────────────────────────────
```

### What one submission contains

`SubmissionPayload` (typed in `submissionService.js`) includes session timing,
model type, per-area questionnaire responses, coverage metrics, device metadata
— **and base64-encoded PNG images**:

| Image | Size | Count per submission |
|---|---|---|
| Per-area UV drawing (`drawingImageData`) | 1024 × 1024 PNG | one per pain/symptom area |
| Multi-view snapshots (`combinedDrawing`) | 400 × 400 PNG × 4 (front/back/left/right) | 4 |

Because of the images, a **single submission is typically several megabytes of
JSON**. This one fact drives most of the database decision below.

---

## 1. Is Firebase still the best choice?

**Short answer: no — not the best fit for this project.** It would *work*, but
for a small clinical study already hosted on Cloudflare it carries avoidable
friction and risk. It is not a scale problem (any database is trivially fine for
30 participants); it's a fit, security, and data-handling problem.

Concerns specific to this app:

- **Second cloud vendor.** The app lives entirely on Cloudflare Pages and
  already uses a Pages Function. Firebase pulls in Google Cloud as a separate
  console, SDK, and bill, and re-introduces the Firebase JS SDK into the browser.
- **Credentials + rules in the browser.** The Firebase web SDK config
  (`apiKey`, project id, etc.) is embedded in client code, and the *only* thing
  standing between an anonymous visitor and your database is a correctly written
  Firestore Security Rule. A single loose rule exposes the whole collection.
  (This is exactly why `firebaseService.js` had to be gitignored.)
- **The 1 MiB document limit.** Firestore caps a document at 1 MiB. Our
  submissions are multiple MB of base64 image data, so you'd be forced to split
  images into Cloud Storage and stitch references back together anyway — the
  same work as the recommendation below, but across two Google products.
- **Data residency.** Health-adjacent research data at a Canadian university
  often needs to stay in Canada for the REB. Firestore *can* be pinned to the
  Montreal region (`northamerica-northeast1`), but only at project creation and
  it's easy to get wrong.

### Comparison

| Criterion (for a ~30-participant clinical study) | Cloudflare Pages Function + D1 + R2 | Supabase (Postgres + Storage) | Firebase / Firestore |
|---|---|---|---|
| Fits existing Cloudflare deployment | ✅ same vendor, same pattern as `functions/` | ➖ second vendor | ➖ second vendor |
| DB credentials exposed to browser | ✅ **none** — client POSTs same-origin | ➖ public anon key + row-level security | ➖ public config + security rules |
| Handles multi-MB image payloads | ✅ images → R2, metadata → D1 | ✅ images → Storage bucket, rows → Postgres | ➖ 1 MiB/doc limit forces a split |
| Researcher-friendly admin UI / export | ➖ SQL via CLI or dashboard console | ✅ table editor, SQL editor, 1-click CSV | ✅ console UI |
| Canadian data residency | ➖ limited guarantees | ✅ `ca-central-1` region | ✅ Montreal region (set at creation) |
| Cost at this scale | ✅ free tier | ✅ free tier | ✅ free (Spark) tier |

### Recommendation

**Primary: a Cloudflare Pages Function that writes to D1 (metadata) + R2
(images).** It reuses the pattern already in the repo, keeps everything on one
vendor, and — most importantly — is the only option where **no database
credential ever reaches the browser**. The client just does
`POST /api/submit` to its own origin; the Function holds the bindings. That is a
categorical security improvement over the old Firebase client-SDK model, and it
handles the image payloads cleanly.

**Choose the alternative (Supabase, `ca-central-1`) if** your ethics board
requires guaranteed Canadian data residency, or you want a point-and-click admin
UI and SQL console for exploring and exporting data without the CLI. A compact
Supabase walkthrough is in the [appendix](#appendix-alternative-supabase-for-canadian-residency).

Either way, **not Firebase** — its residency edge is matched by both
alternatives, and its downsides (browser-exposed rules, the 1 MiB limit, a
second vendor) are not.

---

## 2. Walkthrough — Cloudflare Pages Function + D1 + R2

> **Architecture.** The browser sends the full `SubmissionPayload` to a
> same-origin endpoint `POST /api/submit`. The Function extracts the base64
> images, stores each as an object in an **R2** bucket, replaces them in the
> payload with their R2 keys, and writes the (now small) metadata row to a
> **D1** (SQLite) table. No keys or bucket names are ever in client code.

### Prerequisites

- A Cloudflare account with this app already deployed as a Pages project
  (per [DEPLOY.md](./DEPLOY.md)).
- The Wrangler CLI for setup and data export:
  ```bash
  npm install -g wrangler
  wrangler login
  ```

### Step 1 — Create the D1 database and schema

```bash
wrangler d1 create bodymap-submissions
```

Wrangler prints a `database_id` — keep it for Step 5.

Save the schema to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS submissions (
  id                TEXT PRIMARY KEY,   -- server-generated UUID
  created_at        TEXT NOT NULL,      -- when the server received it (ISO 8601)
  start_time        TEXT,               -- payload.startTime
  completion_time   TEXT,               -- payload.completionTime
  duration_seconds  INTEGER,
  model_type        TEXT,
  total_areas       INTEGER,
  device_type       TEXT,
  operating_system  TEXT,
  browser           TEXT,
  user_agent        TEXT,
  payload_json      TEXT NOT NULL       -- full payload, image fields replaced by R2 keys
);

CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at);
```

Apply it (add `--remote` to run against the deployed database, omit it for the
local dev copy):

```bash
wrangler d1 execute bodymap-submissions --remote --file=./schema.sql
```

The scalar columns make it easy to browse and filter; `payload_json` keeps the
complete structured record (per-area drawings, coverage breakdowns, questionnaire
answers) for full-fidelity analysis.

### Step 2 — Create the R2 bucket (for the images)

```bash
wrangler r2 bucket create bodymap-submissions
```

Images are large and don't belong in a SQL row, so they live here as objects.
The bucket is private by default — objects are only reachable through your
Function or the Cloudflare dashboard.

### Step 3 — Add the submission Function

Create `functions/api/submit.js`. This mirrors the allowlist/validation style of
the existing model proxy:

```js
/**
 * Cloudflare Pages Function — study data submission endpoint.
 *
 * Receives the SubmissionPayload from the browser (POST /api/submit), stores the
 * base64 images in R2, and writes the remaining metadata to D1. No database
 * credentials are ever exposed to the client — the bindings below are injected
 * by Cloudflare at runtime (configured in Step 5).
 *
 * Bindings (see wrangler.toml / dashboard):
 *   env.DB           D1 database  (bodymap-submissions)
 *   env.SUBMISSIONS  R2 bucket    (bodymap-submissions)
 */

const MAX_BODY_BYTES = 25 * 1024 * 1024; // reject absurdly large posts (~25 MB)

// Turn a base64 data URL ("data:image/png;base64,....") into raw bytes for R2.
function dataUrlToBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function putImage(env, key, dataUrl) {
  const bytes = dataUrlToBytes(dataUrl);
  if (!bytes) return null;
  await env.SUBMISSIONS.put(key, bytes, {
    httpMetadata: { contentType: 'image/png' },
  });
  return key;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Basic guards
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.areas)) {
    return Response.json({ error: 'Malformed submission' }, { status: 422 });
  }

  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  try {
    // 2. Move the multi-view snapshots to R2, replace with keys.
    const combined = payload.combinedDrawing || {};
    for (const view of ['front', 'back', 'left', 'right']) {
      if (combined[view]) {
        combined[view] = await putImage(env, `${id}/combined-${view}.png`, combined[view]);
      }
    }

    // 3. Move each area's drawing image to R2, replace with a key.
    for (const area of payload.areas) {
      if (area && area.drawingImageData) {
        area.drawingImageData = await putImage(
          env, `${id}/area-${area.areaNumber}.png`, area.drawingImageData,
        );
      }
    }

    // 4. Write the (now lightweight) metadata row to D1.
    const d = payload.deviceInfo || {};
    await env.DB.prepare(
      `INSERT INTO submissions
        (id, created_at, start_time, completion_time, duration_seconds,
         model_type, total_areas, device_type, operating_system, browser,
         user_agent, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      receivedAt,
      payload.startTime ?? null,
      payload.completionTime ?? null,
      payload.durationSeconds ?? null,
      payload.modelType ?? null,
      payload.totalAreas ?? null,
      d.deviceType ?? null,
      d.operatingSystem ?? null,
      d.browser ?? null,
      d.userAgent ?? null,
      JSON.stringify(payload),
    ).run();

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return Response.json({ error: 'Storage failed', detail: String(err) }, { status: 500 });
  }
}

// Reject non-POST verbs cleanly.
export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  return onRequestPost(context);
}
```

> Because the endpoint is same-origin, the browser's fetch does not need — and
> should not send — any credential. The images are stored under an
> `<uuid>/…` prefix so every submission's assets group together in R2.

### Step 4 — Wire the client

Replace the stub in `js/app/appController.js` (inside the general-questionnaire
`completeButton` handler). The `prepareSubmissionData()` call is already there —
only the "Integration point" block changes:

```js
const submissionData = await prepareSubmissionData();

// ── Integration point ──────────────────────────────────────
const response = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submissionData),
});
const success = response.ok;
// ───────────────────────────────────────────────────────────

if (success) {
    clearSurveyInstance();
    goTo('summary');
} else {
    console.error('Submission failed:', response.status);
    alert('There was an error submitting your data. Please try again.');
}
```

That is the entire client change — no SDK, no config object, no keys. (This
replaces the old Firebase approach, so you do **not** need to restore
`firebaseService.js` or the commented-out `<script>` tags in `index.html`.)

### Step 5 — Configure the bindings

Create (or extend) `wrangler.toml` in the repo root so the Function can see the
database and bucket. Fill in the `database_id` from Step 1:

```toml
name = "3d-bodymap"          # your Pages project name
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "bodymap-submissions"
database_id = "PASTE-THE-ID-FROM-STEP-1"

[[r2_buckets]]
binding = "SUBMISSIONS"
bucket_name = "bodymap-submissions"
```

You can instead add these under **Pages project → Settings → Functions →
D1 database bindings / R2 bucket bindings** in the dashboard — the binding
*names* must be `DB` and `SUBMISSIONS` to match the Function code.

### Step 6 — Run it locally

```bash
# Serves the site AND runs Functions, with a local D1 + R2 you can throw away.
wrangler pages dev . --binding MODELS_CDN_BASE=https://cdn.example.com/bodymap
```

Apply the schema to the local D1 once (omit `--remote`):

```bash
wrangler d1 execute bodymap-submissions --file=./schema.sql
```

Complete a run in the browser, then confirm the row landed:

```bash
wrangler d1 execute bodymap-submissions --command "SELECT id, created_at, model_type, total_areas FROM submissions;"
```

### Step 7 — Deploy

Push to the branch connected to Cloudflare Pages. Pages picks up `functions/`
and the `wrangler.toml` bindings automatically — no build step
(per [DEPLOY.md](./DEPLOY.md)). Do one end-to-end submission on the live URL and
confirm the row appears with `--remote`.

### Step 8 — Get the data out for analysis

Export the metadata table to CSV:

```bash
wrangler d1 execute bodymap-submissions --remote \
  --command "SELECT * FROM submissions;" --json > submissions.json
```

For a full analysis dump, `payload_json` holds every questionnaire answer and
coverage metric; parse it in R/Python/pandas. To pull the drawing images:

```bash
# List a submission's objects, then download one:
wrangler r2 object get bodymap-submissions/<uuid>/area-1.png --file area-1.png
```

The R2 bucket and D1 table are also browsable in the Cloudflare dashboard.

---

## Security & privacy notes (please read before collecting real data)

- **Same-origin only, no keys client-side.** The Function never returns stored
  data and holds all bindings server-side, so there is nothing sensitive in the
  shipped JavaScript.
- **Anonymous write endpoint.** Anyone who finds the URL can POST. For a small
  study with an unlisted participant link this is usually acceptable, but if you
  want to stop casual abuse, add [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
  (a privacy-friendly CAPTCHA) and verify its token at the top of the Function,
  or gate access with a per-study passcode checked server-side.
- **Don't collect identifiers you don't need.** The current payload has no name,
  DOB, or contact info — keep it that way unless the protocol requires otherwise,
  and document what is collected for the REB.
- **Retention & deletion.** Decide a retention window up front. A submission is
  deletable by removing its D1 row and its `r2 object delete` for the
  `<uuid>/…` prefix.
- **Residency.** Cloudflare's Canadian-residency guarantees are limited; if your
  REB requires data to stay in Canada, use the Supabase (`ca-central-1`)
  alternative below instead.

---

## Appendix: Alternative — Supabase (for Canadian residency)

Pick this if you need guaranteed Canadian data residency or want a
point-and-click admin UI. Trade-off: it's a second vendor, and (like Firebase) a
public anon key ships in the client, so **Row-Level Security must be configured**.

1. **Create the project.** At [supabase.com](https://supabase.com) create a
   project and choose region **`ca-central-1` (Canada Central)**. Note the
   project URL and the `anon` public key.

2. **Create the table** (SQL editor):

   ```sql
   create table submissions (
     id uuid primary key default gen_random_uuid(),
     created_at timestamptz default now(),
     model_type text,
     total_areas int,
     duration_seconds int,
     device_type text,
     browser text,
     payload jsonb not null   -- image fields replaced with Storage paths
   );
   ```

3. **Create a Storage bucket** named `submissions` (private) for the PNGs.

4. **Lock it down with RLS** — insert-only for anonymous participants, no read:

   ```sql
   alter table submissions enable row level security;
   create policy "anon can insert" on submissions
     for insert to anon with check (true);
   -- no select/update/delete policy → clients cannot read or modify anything
   ```

   Add an equivalent insert-only Storage policy on the `submissions` bucket.

5. **Wire the client.** Load `@supabase/supabase-js`, upload each base64 image to
   the Storage bucket, then insert the row with `payload` referencing the
   returned storage paths — same shape as the Cloudflare Function, but performed
   from the browser with the anon key.

6. **Export.** Use the dashboard's table editor (CSV export button) or the SQL
   editor; images are in the Storage browser.

The overall data model is identical to the Cloudflare approach (small structured
row + images in object storage); only the vendor and the split of client-vs-server
work differ. The Cloudflare approach keeps all secrets server-side, which is why
it's the primary recommendation unless residency or admin-UI needs tip you here.
