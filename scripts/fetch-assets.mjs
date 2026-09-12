#!/usr/bin/env node
/**
 * fetch-assets.mjs — download the 3D model assets into ./models/ for local /
 * mobile (Capacitor) builds.
 *
 * Why this exists
 * ---------------
 * The app requests its assets from `./models/<file>`. On the web deployment a
 * Cloudflare Pages Function (functions/models/[file].js) proxies those paths to
 * a private CDN and even renames some files (the preview SVGs are stored as
 * "Type 1.svg" / "Type 2.svg" upstream but served to the app as
 * female.svg / male.svg). A native app has no such proxy, so this script
 * reproduces that mapping and writes real files into ./models/ before the
 * assets are bundled (e.g. before `npx cap copy`).
 *
 * The ./models/ directory is git-ignored — assets are fetched at build time,
 * never committed. Keeps the ~62MB of GLBs out of git history.
 *
 * Usage
 * -----
 *   node scripts/fetch-assets.mjs
 *
 * The asset base URL can be overridden without editing this file:
 *   MODELS_CDN_BASE=https://my-bucket.example.com node scripts/fetch-assets.mjs
 *
 * Requires Node 18+ (uses the global fetch API).
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root is one level up from this scripts/ directory.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO_ROOT, 'models');

const BASE = (process.env.MODELS_CDN_BASE
  || 'https://pub-9b7305666fc84472bb83963721edb455.r2.dev').replace(/\/+$/, '');

/**
 * Each asset: the filename the APP requests (local), and the filename as it is
 * stored upstream (remote). They differ for the preview SVGs — see header.
 */
const ASSETS = [
  { local: 'female.glb',            remote: 'female.glb' },
  { local: 'male.glb',              remote: 'male.glb' },
  { local: 'body_ao_modified.png',  remote: 'body_ao_modified.png' },
  { local: 'female.svg',            remote: 'Type 1.svg' }, // Type 1 = female
  { local: 'male.svg',              remote: 'Type 2.svg' }, // Type 2 = male
];

function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function download({ local, remote }) {
  const url = `${BASE}/${encodeURIComponent(remote)}`;
  const dest = join(OUT_DIR, local);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${remote}: HTTP ${res.status} ${res.statusText} (${url})`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    throw new Error(`${remote}: downloaded 0 bytes (${url})`);
  }

  await writeFile(dest, buf);
  const label = local === remote ? local : `${local}  (from "${remote}")`;
  console.log(`  ✓ ${label.padEnd(34)} ${humanSize(buf.length)}`);
}

async function main() {
  console.log(`Fetching 3D assets from ${BASE}`);
  console.log(`           into ${OUT_DIR}\n`);

  await mkdir(OUT_DIR, { recursive: true });

  const results = await Promise.allSettled(ASSETS.map(download));
  const failures = results.filter((r) => r.status === 'rejected');

  if (failures.length) {
    console.error('\nSome assets failed to download:');
    for (const f of failures) console.error(`  ✗ ${f.reason.message}`);
    console.error(
      '\nIf this is a restricted network, run the script from a machine that ' +
      'can reach the asset host, or set MODELS_CDN_BASE to a reachable mirror.',
    );
    process.exit(1);
  }

  console.log('\nAll assets present in ./models/ — ready to bundle.');
}

main().catch((err) => {
  console.error('fetch-assets failed:', err);
  process.exit(1);
});
