// measure-real-model.mjs
// Compares the app's coverage numbers with the area actually painted, on the
// real body model, using scripted strokes at several brush sizes.
//
// Needs the model files locally (they are not in git):
//   models/female.glb, models/male.glb
//
// Usage:
//   node tests/measure-real-model.mjs [female|male] [--json out.json]
//
// Uses Playwright's Chromium (pre-installed in the cloud environment;
// locally: npm i -D playwright && npx playwright install chromium).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// require() so a globally installed Playwright is found too
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const modelName = args.find((a) => !a.startsWith('--') && !a.endsWith('.json')) || 'female';
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const modelFile = path.join(ROOT, 'models', `${modelName}.glb`);
if (!fs.existsSync(modelFile)) {
    console.error(`Missing ${modelFile}. Put the model files in models/ (not committed).`);
    process.exit(2);
}

// --- tiny static server ------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css' };
const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// --- run in the browser ------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${base}/tests/harness/index.html`);
await page.waitForFunction(() => window.harness, null, { timeout: 30000 });

// Region to stroke across, and camera distance (closer for small parts so the
// stroke stays on that part).
const REGIONS = [
    ['back_mid.L', 0.5],
    ['thigh_anterior.R', 0.5],
    ['hand_dorsal_ulnar.L', 0.25],
    ['face_maxilla.L', 0.3]
];

const result = await page.evaluate(async ({ file, regions }) => {
    const info = await window.harness.load(file);
    const stats = window.harness.meshStats();
    const brush = regions.map(([r, d]) => window.harness.brushSizeScenario(r, [5, 10, 30], d));
    const erase = regions.map(([r, d]) => window.harness.eraseScenario(r, d));
    return { info, stats, brush, erase };
}, { file: `/models/${modelName}.glb`, regions: REGIONS });

await browser.close();
server.close();

// --- report ------------------------------------------------------------------
const pct = (x) => `${x.toFixed(3)}%`;
const ratio = (a, b) => (b > 0 ? `${(a / b).toFixed(2)}×` : 'n/a');

console.log(`\nModel: ${modelName}  height ${result.info.height.toFixed(3)} units, ${result.stats.faces} triangles`);
console.log(`Triangles too small to contain a pixel centre: ${result.stats.tinyFaces}`);
console.log(`  …together ${(100 * result.stats.tinyAreaShare).toFixed(2)}% of the body surface; largest share by part:`);
for (const t of result.stats.tinyByPart.slice(0, 5)) {
    console.log(`     ${t.part}: ${(100 * t.shareOfPart).toFixed(1)}% of that part's area`);
}
console.log(`Texture pixels claimed by more than one triangle (UV overlap): ${result.stats.pixelsClaimedTwice}`);
console.log(`Surface sample points (independent check): ${result.info.samples.toLocaleString()}`);

console.log('\nTriangle size and texture density by body part (area units are model units² ×1e6):');
console.table(result.stats.rows.map((r) => ({
    part: r.part, triangles: r.faces,
    'median triangle': r.medianFaceMm2.toFixed(2),
    pixels: r.pixels,
    'area per pixel': r.mm2PerPixel?.toFixed(3)
})));

console.log('\nBrush size: app coverage vs area actually painted (% of whole body)');
console.table(result.brush.flat().map((r) => ({
    region: r.region, radius: r.radius,
    'app %': pct(r.appPercent), 'painted %': pct(r.truthPercent),
    'app / painted': ratio(r.appArea, r.truthArea),
    'app / surface-sampled': r.sampledArea == null ? 'n/a'
        : `${ratio(r.appArea, r.sampledArea)} ±${(100 * r.sampledMargin95).toFixed(1)}%`,
    'regions only sampling finds': (r.sampledOnlyRegions || []).join(', ') || '-',
    'regions missed by app': r.missingRegions.join(', ') || '-',
    'regions app has but not painted': r.extraRegions.join(', ') || '-',
    'region sums = total': Math.abs(r.appRegionSum - r.appArea) < 1e-12 * Math.max(1, r.appArea)
})));

console.log('\nErase: paint (radius 25), then erase a band through the middle (radius 10)');
console.table(result.erase.map((r) => ({
    region: r.region,
    'app % before': pct(r.before.appPercent), 'app % after': pct(r.after.appPercent),
    'painted % before': pct(r.before.truthPercent), 'painted % after': pct(r.after.truthPercent),
    'app / sampled after': r.after.sampledArea == null ? 'n/a' : ratio(r.after.appArea, r.after.sampledArea)
})));

if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ model: modelName, ...result }, null, 2));
    console.log(`\nFull results written to ${jsonOut}`);
}
