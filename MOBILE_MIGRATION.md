# Mobile Migration Plan — Web → Native Android / iOS

Plan for packaging the 3D Pain & Symptom Assessment web app as native Android
and iOS apps with **on-device local data storage**. Scoped to the actual state
of this repository.

## TL;DR

- **Approach: wrap with [Capacitor](https://capacitorjs.com/), don't rewrite.**
  The app is already a self-contained client-side web app; Capacitor runs it in
  a native WebView and hands it native APIs. Almost none of the ~8,700 lines of
  app code change.
- **Local storage is a net-new feature** — there is no persistence today, so
  there's nothing to port, just something to add.
- **Realistic effort: ~3–4 weeks** for one engineer to a submittable build on
  both platforms. A prototype on a real device is ~2–3 days.
- **Top risks, in order:** (1) the 3D assets aren't in the repo, (2) all libs
  load from CDN and must be vendored for offline use, (3) this is clinical
  patient data, so regulatory/store-privacy classification is a separate track.

---

## Where the app stands today

| Aspect | Current state | Impact on migration |
|---|---|---|
| Architecture | Vanilla ES modules, no bundler, no framework, runs from `index.html` | Ideal for a WebView wrapper |
| 3D engine | Three.js r175 — UV painting on a 315-region mesh, raycasting, custom GPU shader, coverage math | Runs as-is in mobile WebViews (WebGL) |
| UI libs | SurveyJS (Knockout), Driver.js, D3, Font Awesome | All DOM/JS — fine in WebView |
| Dependency loading | **All from CDN** (jsdelivr/unpkg) via import map in `index.html` | Must be vendored locally — see Phase 2 |
| 3D assets | `.glb` / AO texture / SVGs pulled from a **private CDN** via `functions/models/[file].js` proxy; `*.glb` is git-ignored | Must be obtained + bundled — see Phase 3 |
| Persistence | **None.** Firebase removed. `submissionService.js` assembles a JSON payload in memory; only `sessionStorage` used for UI flags | Local storage is new work — see Phase 4 |

---

## Phase 0 — Prerequisites (blockers, resolve first)

- [ ] **Obtain the 3D asset files.** `female.glb`, `male.glb`,
      `body_ao_modified.png`, `female.svg`, `male.svg` are served from a private
      CDN and `*.glb` is in `.gitignore`. Get the actual files before anything
      else — they block offline bundling.
- [ ] **Confirm distribution target.** True app-store apps (Capacitor) vs. an
      installable PWA changes scope. This plan assumes store apps.
- [ ] **Confirm regulatory status.** This is patient symptom data. Decide
      whether local-only storage is acceptable, whether the app is a regulated
      medical device, and what the EmPOWER/SPINA owners require. This can dwarf
      the engineering — settle it before store submission, ideally before start.
- [ ] Accounts: Apple Developer Program ($99/yr), Google Play Console ($25 one-time).
- [ ] Tooling: Node + npm, Xcode (macOS, for iOS), Android Studio.

---

## Phase 1 — Capacitor scaffold (1–2 days)

Capacitor treats a folder of static web assets as the app's `webDir`.

```bash
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init "3D Body Map" com.empower.bodymap --web-dir .
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npx cap copy          # copy web assets into native projects
npx cap open ios      # / android — build & run
```

- `--web-dir .` points Capacitor at the repo root (where `index.html` lives).
  If a build/bundling step is introduced in Phase 2, point `webDir` at its
  output folder instead.
- Exit criterion: the app launches in the iOS Simulator and an Android
  emulator, loading from local files (not a dev server).

---

## Phase 2 — Vendor CDN dependencies for offline use (2–4 days)

A store app must not depend on runtime CDN — it has to work offline and pass
review. Everything currently loaded from the network in `index.html` must ship
inside the app.

Dependencies to bundle locally:
- `three@0.175.0` (module build + the `three/addons/` used, e.g. `GLTFLoader`)
- `survey-knockout` + `knockout@3.5.1` (CSS + JS)
- `driver.js@1.3.1` (CSS + JS)
- `d3.v7` (note: README says "loaded, not actively used" — confirm, then drop
  if unused to cut size)
- Font Awesome 7 (CSS + web fonts)

Steps:
1. Download each library into a local `vendor/` (or introduce a lightweight
   bundler — esbuild/Vite — if you'd rather manage deps via npm).
2. Rewrite the import map and `<script>`/`<link>` tags in `index.html` to
   reference local paths.
3. Self-host Font Awesome font files (WebView won't fetch them from a CDN
   offline).
4. Verify zero network requests at runtime (DevTools / proxy) — the app should
   run fully in airplane mode.

Decision point: stay no-build (simplest, matches current repo philosophy) or
adopt a bundler. No-build is fine and recommended unless you want npm-managed
deps.

---

## Phase 3 — Bundle 3D assets, remove the CDN proxy (1–3 days)

The Cloudflare Pages Function (`functions/models/[file].js`) does not exist in a
native app. Ship the assets inside the bundle instead.

Asset path references to update (all currently point at `./models/...`):
- `js/views/selectionView.js:32-33` — model list (`female.glb`, `female.svg`, `male.glb`, `male.svg`)
- `js/app/appController.js:112` — default model selection
- `js/services/modelLoader.js:168` — `./models/body_ao_modified.png`

Steps:
1. Place the real asset files in a bundled `assets/models/` directory (remove
   the `*.glb` ignore rule, or use a git-LFS/out-of-band mechanism if you don't
   want binaries in git).
2. Point the three references above at the bundled path.
3. Delete/retire the `functions/` proxy from the mobile build (keep it for the
   web deployment if that continues in parallel).
4. Verify models load offline on-device. `GLTFLoader` reads from the local path
   with no code change beyond the URL.

---

## Phase 4 — Local data storage (the requested feature, 3–5 days)

Today `submissionService.prepareSubmissionData()` returns a `SubmissionPayload`
that was meant to POST to a backend. For on-device storage, persist it instead.

Important: payloads are **large** — each contains multiple base64 PNGs (per-area
UV drawings + 4 view snapshots), easily hundreds of KB to several MB.
**Do not use `localStorage`** (≈5MB cap, synchronous).

Recommended storage:
- `@capacitor/filesystem` — write each assessment as a JSON file, or
- `@capacitor-community/sqlite` — if you want queryable records/metadata.
  A hybrid (SQLite for metadata + Filesystem for the big base64 blobs) scales
  best, but start simple with Filesystem.

Work items:
1. Add a small `localStore` service: `save(payload)`, `list()`, `get(id)`,
   `delete(id)`.
2. Call `save()` at the point `submissionService` currently hands off the
   payload (the submit action in the summary flow).
3. Add a "Saved assessments" view: list saved records, open/review, delete.
   Can reuse the existing summary rendering for the review screen.
4. Optional: an export/share action (`@capacitor/share` or Filesystem export)
   so a clinician can get the JSON off the device.
5. Handle storage-quota and write-failure errors gracefully.

---

## Phase 5 — Mobile UX & performance (3–5 days)

- Touch drawing on the 3D model — verify painting, orbit, and the drawing-vs-
  rotate gesture modes feel right on a real touchscreen (the app already has a
  `rotatePrompt` and responsive manager to build on).
- Safe areas / notches — `viewport-fit=cover` is already set; audit against
  device insets.
- **Test WebGL on a low-end device early.** A 315-region mesh + custom shader is
  the main performance unknown on cheaper Android hardware. Do this in Phase 1,
  not here, if possible.
- App icons, splash screens (`@capacitor/splash-screen`), status-bar styling.
- Lock orientation if the UX assumes it.

---

## Phase 6 — Store submission (2–4 days + review wait)

- iOS: signing, provisioning, App Store Connect listing, privacy nutrition
  labels (declare local-only data handling). Review typically 1–3 days.
- Android: signed AAB, Play Console listing, Data Safety form.
- Health-data category disclosures on both stores — tied to the Phase 0
  regulatory decision.

---

## Effort summary

| Phase | Effort |
|---|---|
| 0 — Prerequisites | Gating, not dev time (but can block everything) |
| 1 — Capacitor scaffold | 1–2 days |
| 2 — Vendor CDN deps | 2–4 days |
| 3 — Bundle assets, drop proxy | 1–3 days |
| 4 — Local storage feature | 3–5 days |
| 5 — Mobile UX & performance | 3–5 days |
| 6 — Store submission | 2–4 days + review |
| **Total** | **~3–4 weeks, one engineer** |

Prototype on a device: ~2–3 days (Phases 1 + a shortcut through 2–3).

---

## Alternatives considered

- **PWA (installable web app)** — fastest (manifest + service worker +
  IndexedDB, a few days), but not a true store app and iOS restricts PWAs.
  Good fallback if store distribution isn't mandatory. Local storage would use
  IndexedDB (same payload-size reasoning applies).
- **Native rewrite (React Native / Flutter)** — rejected. Would require
  re-implementing the entire 3D drawing engine (UV painting, custom shader,
  raycasting, coverage) and replacing SurveyJS with no native equivalent.
  Months of work for no functional gain over the WebView approach.

---

## Open questions to resolve with stakeholders

1. Is D3 actually needed? (README says loaded-but-unused — dropping it trims the bundle.)
2. Where do the 3D asset files live and who can provide them?
3. Local-only storage, or eventual sync back to EmPOWER/SPINA? (Affects Phase 4 and regulatory scope.)
4. Is this a regulated medical device in the target markets?
5. Continue the web (Cloudflare Pages) deployment in parallel, or replace it?
