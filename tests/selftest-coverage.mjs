// selftest-coverage.mjs
// Self-test for painted-area coverage (Jamie215/3d_bodymap#16).
// Runs in plain Node, no dependencies and no model files:
//
//   node tests/selftest-coverage.mjs
//
// Uses a small made-up mesh where the right answers are known exactly:
// a 1 × 1 (m) flat sheet split into three columns of different real widths
// (0.1, 0.2, 0.7) that all get the SAME width in the texture. So one texture
// pixel stands for very different real areas depending on the column, like
// the real body (hands vs back).

import assert from 'node:assert/strict';
import { buildPixelFaceMap } from '../js/utils/uvRasterizer.js';
import { computePaintedArea, forEachBrushPixel } from '../js/utils/paintedArea.js';

const W = 300;
const H = 300;

// ---------------------------------------------------------------------------
// Test mesh
// ---------------------------------------------------------------------------

/** Minimal stand-in for a Three.js BufferAttribute. */
function attr(values, itemSize) {
    return {
        count: values.length / itemSize,
        getX: (i) => values[i * itemSize],
        getY: (i) => values[i * itemSize + 1],
        getZ: (i) => values[i * itemSize + 2]
    };
}

function triangleArea(p, a, b, c) {
    const ab = [p[3 * b] - p[3 * a], p[3 * b + 1] - p[3 * a + 1], p[3 * b + 2] - p[3 * a + 2]];
    const ac = [p[3 * c] - p[3 * a], p[3 * c + 1] - p[3 * a + 1], p[3 * c + 2] - p[3 * a + 2]];
    const cx = ab[1] * ac[2] - ab[2] * ac[1];
    const cy = ab[2] * ac[0] - ab[0] * ac[2];
    const cz = ab[0] * ac[1] - ab[1] * ac[0];
    return Math.hypot(cx, cy, cz) / 2;
}

function buildMesh() {
    const realX = [0, 0.1, 0.3, 1.0];   // uneven real widths
    const texU  = [0, 1 / 3, 2 / 3, 1]; // even texture widths
    const positions = [];
    const uvs = [];
    const index = [];
    const faceToRegion = [];

    // Sheet: 3 columns × 1 row, using the top half of the texture (v 0.5–1)
    for (let col = 0; col <= 3; col++) {
        for (const [y, v] of [[0, 0.5], [1, 1]]) {
            positions.push(realX[col], y, 0);
            uvs.push(texU[col], v);
        }
    }
    for (let col = 0; col < 3; col++) {
        const bl = col * 2, tl = col * 2 + 1, br = col * 2 + 2, tr = col * 2 + 3;
        const region = col < 2 ? 'regionA' : 'regionB';  // A = 0.3 m², B = 0.7 m²
        index.push(bl, br, tr); faceToRegion.push(region);
        index.push(bl, tr, tl); faceToRegion.push(region);
    }

    // A sliver triangle, smaller than one texture pixel, in the bottom half.
    // Texture pixel coords ≈ (10.1, 280.1)…(10.4, 280.4): contains no pixel centre.
    const base = positions.length / 3;
    const px = (x, y) => [x / W, 1 - y / H];
    positions.push(5, 0, 0, 5.2, 0, 0, 5, 0.1, 0);       // real area 0.01
    uvs.push(...px(10.1, 280.1), ...px(10.4, 280.1), ...px(10.1, 280.4));
    index.push(base, base + 1, base + 2); faceToRegion.push('regionC');

    const geometry = {
        index: attr(index, 1),
        attributes: { position: attr(positions, 3), uv: attr(uvs, 2) }
    };
    const faceAreas = [];
    for (let f = 0; f < index.length / 3; f++) {
        faceAreas.push(triangleArea(positions, index[3 * f], index[3 * f + 1], index[3 * f + 2]));
    }
    return { geometry, faceAreas, faceToRegion, tinyFace: index.length / 3 - 1 };
}

const mesh = buildMesh();
const pixelMap = buildPixelFaceMap(mesh.geometry, W, H);
const measure = (mask) => computePaintedArea(mask, pixelMap, mesh.faceAreas, mesh.faceToRegion);

const newMask = () => new Uint8Array(W * H);
const paintRect = (mask, x0, x1, y0, y1, value = 1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = value;
};
const paintBrush = (mask, cx, cy, r, value = 1) =>
    forEachBrushPixel(cx, cy, r, W, H, (x, y) => { mask[y * W + x] = value; });

const close = (actual, expected, tol, msg) =>
    assert.ok(Math.abs(actual - expected) <= tol, `${msg}: expected ${expected}, got ${actual}`);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('every sheet pixel belongs to exactly one triangle', () => {
    for (let y = 0; y < 150; y++) {
        for (let x = 0; x < W; x++) assert.ok(pixelMap.pixelFace[y * W + x] >= 0, `pixel ${x},${y} unowned`);
    }
    const owned = pixelMap.facePixelCount.reduce((s, n) => s + n, 0);
    assert.equal(owned, W * 150);
});

test('sub-pixel triangle is listed as tiny and linked to its centre pixel', () => {
    assert.equal(pixelMap.facePixelCount[mesh.tinyFace], 0);
    const i = Array.from(pixelMap.tinyFaces).indexOf(mesh.tinyFace);
    assert.ok(i >= 0 && i % 2 === 0, 'tiny face missing');
    assert.equal(pixelMap.tinyFaces[i + 1], 280 * W + 10);
});

test('painting everything gives the full real area per region', () => {
    const mask = newMask();
    paintRect(mask, 0, W, 0, 150);
    const r = measure(mask);
    close(r.totalArea, 1.0, 1e-9, 'total');
    close(r.regionAreas.regionA, 0.3, 1e-9, 'regionA');
    close(r.regionAreas.regionB, 0.7, 1e-9, 'regionB');
});

test('uneven texture stretch cancels out (area, not pixel count)', () => {
    // The last column is 1/3 of the pixels but 0.7 of the real area
    const mask = newMask();
    paintRect(mask, 200, W, 0, 150);
    close(measure(mask).totalArea, 0.7, 1e-9, 'last column');
    const mask2 = newMask();
    paintRect(mask2, 0, 100, 0, 150);
    close(measure(mask2).totalArea, 0.1, 1e-9, 'first column');
});

test('half a triangle painted counts about half its area', () => {
    const mask = newMask();
    paintRect(mask, 200, 250, 0, 150);   // left half of the 0.7 column
    close(measure(mask).totalArea, 0.35, 0.01, 'half column');
});

test('bigger brush gives proportionally bigger area', () => {
    const areaPerPixel = 0.7 / (100 * 150);
    const areas = [5, 10, 20].map((r) => {
        const mask = newMask();
        paintBrush(mask, 250, 75, r);
        const a = measure(mask).totalArea;
        close(a, Math.PI * r * r * areaPerPixel, 0.06 * Math.PI * r * r * areaPerPixel, `radius ${r} vs πr²`);
        return a;
    });
    close(areas[1] / areas[0], 4, 0.4, 'r10 / r5');
    close(areas[2] / areas[1], 4, 0.3, 'r20 / r10');
});

test('erasing reduces area by the erased amount', () => {
    const mask = newMask();
    paintRect(mask, 0, W, 0, 150);
    paintRect(mask, 200, W, 0, 150, 0);   // erase the last column
    const r = measure(mask);
    close(r.totalArea, 0.3, 1e-9, 'after erase');
    assert.equal(r.regionAreas.regionB, undefined, 'regionB should be gone');
});

test('region touched only by the brush edge is included', () => {
    const mask = newMask();
    paintBrush(mask, 190, 75, 15);   // centre in regionA, edge crosses into regionB
    const regions = Object.keys(measure(mask).regionAreas).sort();
    assert.deepEqual(regions, ['regionA', 'regionB']);
});

test('region sums equal the total', () => {
    const mask = newMask();
    paintBrush(mask, 190, 75, 40);
    paintBrush(mask, 10, 280, 2);    // also hits the tiny triangle
    const r = measure(mask);
    const sum = Object.values(r.regionAreas).reduce((s, a) => s + a, 0);
    close(sum, r.totalArea, 1e-12, 'sum vs total');
    close(r.regionAreas.regionC, 0.01, 1e-12, 'tiny triangle counted');
});

test('tiny triangle counts only when its centre pixel is painted', () => {
    const mask = newMask();
    mask[280 * W + 11] = 1;          // neighbour, not the centre pixel
    assert.equal(measure(mask).regionAreas.regionC, undefined);
    mask[280 * W + 10] = 1;
    close(measure(mask).regionAreas.regionC, 0.01, 1e-12, 'tiny');
});

test('brush stays inside the texture at the edges', () => {
    let n = 0;
    forEachBrushPixel(0, 0, 3, W, H, (x, y) => {
        assert.ok(x >= 0 && y >= 0 && x < W && y < H);
        n++;
    });
    assert.ok(n > 0);
    let single = 0;
    forEachBrushPixel(5, 5, 0, W, H, () => single++);
    assert.equal(single, 1);
});

test('empty mask gives zero', () => {
    const r = measure(newMask());
    assert.equal(r.totalArea, 0);
    assert.equal(r.paintedFaceCount, 0);
});

// ---------------------------------------------------------------------------

let failed = 0;
for (const { name, fn } of tests) {
    try {
        fn();
        console.log(`  ok    ${name}`);
    } catch (err) {
        failed++;
        console.log(`  FAIL  ${name}\n        ${err.message}`);
    }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
