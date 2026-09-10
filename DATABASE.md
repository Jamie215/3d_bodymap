# Connecting a Database for Data Collection

This guide covers **where submitted study data goes** and how to stand it up for
a study of ~30 participants. It documents the reference backend, walks through
the setup end to end, and explains how to swap in a different database later.

---

## Background: how submission works

The app is a static, no-build site deployed on **Cloudflare Pages**. It already
ships one **Pages Function** — `functions/models/[file].js` — that proxies the
private 3D-model assets from a same-origin `/models/*` path (see
[DEPLOY.md](./DEPLOY.md)).

Submission follows the same same-origin pattern. `prepareSubmissionData()` in
`js/services/submissionService.js` assembles a `SubmissionPayload`, and
`js/app/appController.js` hands it to `submitSubmission()` in
`js/services/backendService.js`, which POSTs it to `/api/submit`. No database
SDK or credentials are loaded in the browser.

### What one submission contains

`SubmissionPayload` (typed in `submissionService.js`) includes session timing,
model type, per-area questionnaire responses, coverage metrics, device metadata
— **and base64-encoded PNG images**:

| Image | Size | Count per submission |
|---|---|---|
| Per-area UV drawing (`drawingImageData`) | 1024 × 1024 PNG | one per pain/symptom area |
| Multi-view snapshots (`combinedDrawing`) | 400 × 400 PNG × 4 (front/back/left/right) | 4 |

Because of the images, a **single submission is typically several megabytes of
JSON**. This is why the storage layer splits images out to object storage rather
than jamming them into a single database row.

---

## The reference backend

The reference implementation is a **Cloudflare Pages Function
(`functions/api/submit.js`) that stores images in R2 and metadata in D1.** It's
the recommended setup because it:

- **reuses the deployment the app already runs on** — same vendor, same
  `functions/` pattern as the model proxy, one console and one bill;
- **keeps every credential server-side** — the client only POSTs to its own
  origin, so nothing sensitive ships in the browser;
- **handles the multi-MB image payloads cleanly** — images go to R2 (no
  per-record size limit), and only lightweight metadata goes to D1;
- **costs nothing at this scale** — comfortably inside Cloudflare's free tiers.

Because the app depends only on the `POST /api/submit` contract (see
[Swapping the backend](#swapping-the-backend)), this can be replaced with any
other database later without touching the client. The main reason to choose
something else up front is **data residency**: Cloudflare's Canadian-residency
guarantees are limited, so if your REB requires data to stay in Canada, use the
**Supabase (`ca-central-1`)** alternative in the [appendix](#appendix-alternative--supabase-for-canadian-residency).

| | Cloudflare Pages Function + D1 + R2 (reference) | Supabase (Postgres + Storage) |
|---|---|---|
| Fits the existing Cloudflare deployment | ✅ same vendor, same `functions/` pattern | ➖ second vendor |
| Credentials in the browser | ✅ none — client POSTs same-origin | ➖ public anon key + row-level security |
| Multi-MB image payloads | ✅ images → R2, metadata → D1 | ✅ images → Storage bucket, rows → Postgres |
| Admin UI / export | ➖ SQL via CLI or dashboard console | ✅ table editor, SQL editor, 1-click CSV |
| Canadian data residency | ➖ limited guarantees | ✅ `ca-central-1` region |
| Cost at this scale | ✅ free tier | ✅ free tier |

---

## Walkthrough — Cloudflare Pages Function + D1 + R2

> **Architecture.** The browser sends the full `SubmissionPayload` to a
> same-origin endpoint `POST /api/submit`. The Function extracts the base64
> images, stores each as an object in an **R2** bucket, replaces them in the
> payload with their R2 keys, and writes the (now small) metadata row to a
> **D1** (SQLite) table. No keys or bucket names are ever in client code.

> **Note.** The client wiring and the Function itself are already committed
> (`js/services/backendService.js`, `functions/api/submit.js`, `schema.sql`,
> `wrangler.toml`). The steps below are the account-side setup that connects
> them to real Cloudflare resources.

### Prerequisites

- A Cloudflare account with this app already deployed as a Pages project
  (per [DEPLOY.md](./DEPLOY.md)).
- The Wrangler CLI for setup and data export:
  ```bash
  npm install -g wrangler
  wrangler login
  ```

### Step 1 — Create the D1 database

```bash
wrangler d1 create bodymap-submissions
```

Wrangler prints a `database_id` — paste it into `wrangler.toml` (Step 4).

The schema is already in the repo at `schema.sql`:

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

### Step 3 — Review the submission Function

`functions/api/submit.js` is already in the repo. It receives the payload, moves
the base64 images to R2 under a per-submission `<uuid>/…` prefix, and writes the
metadata row to D1. It expects two bindings, configured next:

```
env.DB           D1 database  (binding name "DB")
env.SUBMISSIONS  R2 bucket    (binding name "SUBMISSIONS")
```

No edits are needed unless you rename the database or bucket.

### Step 4 — Configure the bindings

`wrangler.toml` is in the repo root — fill in the `database_id` from Step 1:

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

### Step 5 — Run it locally

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

### Step 6 — Deploy

Push to the branch connected to Cloudflare Pages. Pages picks up `functions/`
and the `wrangler.toml` bindings automatically — no build step
(per [DEPLOY.md](./DEPLOY.md)). Do one end-to-end submission on the live URL and
confirm the row appears with `--remote`.

### Step 7 — Get the data out for analysis

Export the metadata table:

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

## Swapping the backend

The app is deliberately decoupled from any specific database. The stable part is
a **contract**, and the Cloudflare Function is just one implementation of it:

> **Contract** — the app POSTs the `SubmissionPayload` as JSON to a same-origin
> `/api/submit`, and treats any `2xx` response as success. That's it.

This lives in one place: `submitSubmission()` in `js/services/backendService.js`.
So a successor choosing a different database has two options, from least to most
work:

1. **Keep the URL, replace what's behind it.** Rewrite only
   `functions/api/submit.js` (and swap the D1/R2 bindings for the new store).
   Nothing else in the app changes. This is the path if you stay on Cloudflare
   Pages but change where data lands.
2. **Change how the app reaches the backend.** If the new backend can't sit
   behind a same-origin `/api/submit` (e.g. it needs a vendor SDK or a different
   URL), edit `submitSubmission()` in `backendService.js` — the *only* file that
   knows how data leaves the app. `appController.js`, `submissionService.js`, and
   the payload shape stay untouched.

In both cases `prepareSubmissionData()` and the `SubmissionPayload` shape are
unchanged, so any downstream analysis code keeps working.

## Appendix: Alternative — Supabase (for Canadian residency)

Pick this if you need guaranteed Canadian data residency or want a
point-and-click admin UI. Trade-off: it's a second vendor, and a public anon key
ships in the client, so **Row-Level Security must be configured**.

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

5. **Point the app at it.** Because Supabase can't sit behind a same-origin
   `/api/submit`, edit `submitSubmission()` in `js/services/backendService.js`
   (the one seam): load `@supabase/supabase-js`, upload each base64 image to the
   Storage bucket, then insert the row with `payload` referencing the returned
   storage paths — same data model as the Cloudflare Function.

6. **Export.** Use the dashboard's table editor (CSV export button) or the SQL
   editor; images are in the Storage browser.

The overall data model is identical to the Cloudflare approach (small structured
row + images in object storage); only the vendor and the split of client-vs-server
work differ.
