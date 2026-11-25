// harness.js
// Test-only page script. Loads the real body model and drives the app's own
// drawing + coverage code with scripted strokes, so coverage numbers can be
// compared against an independent "what was actually painted" estimate.
//
// Exposed as window.harness; driven by tests/measure-real-model.mjs.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import AppState from '../../js/app/state.js';
import {
    initializeRegionMappings,
    buildGlobalUVMap,
    drawAtPointer
} from '../../js/services/drawingEngine.js';
import coverageCalculator from '../../js/services/coverageService.js';

const W = 1024;
const H = 1024;

// Independent reference data, built here (not by the app code under test)
let ref = null;
let samples = null;
const SAMPLE_COUNT = 4_000_000;

// ----------------------------------------------------------------------------
// Loading
// ----------------------------------------------------------------------------

async function load(file) {
    const gltf = await new GLTFLoader().loadAsync(file);
    const model = gltf.scene;

    // Same placement as modelLoader.js
    const bbox   = new THREE.Box3().setFromObject(model);
    const height = bbox.max.y - bbox.min.y;
    model.position.y = 1.0 - height / 2;

    let mesh = null;
    model.traverse((c) => { if (c.isMesh && c.name === 'Human') mesh = c; });
    if (!mesh) throw new Error('No "Human" mesh in model');
    model.updateMatrixWorld(true);

    AppState.model    = model;
    AppState.skinMesh = mesh;
    AppState.drawingInstances = [];
    AppState.currentDrawingIndex = 0;

    // White base texture, as in modelLoader.setupBaseTexture
    const base = document.createElement('canvas');
    base.width = W; base.height = H;
    const baseCtx = base.getContext('2d', { willReadFrequently: true });
    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(0, 0, W, H);
    AppState.baseTextureCanvas  = base;
    AppState.baseTextureContext = baseCtx;

    await initializeRegionMappings();
    const maps = buildGlobalUVMap(mesh.geometry, W, H);
    Object.assign(AppState, maps);
    coverageCalculator.initialize(mesh);

    ref = buildReference(mesh);
    samples = buildSurfaceSamples(mesh, SAMPLE_COUNT);
    return { height, faces: ref.faceCount, samples: samples.count };
}

// ----------------------------------------------------------------------------
// Independent reference: which face owns each texture pixel (pixel centres)
// ----------------------------------------------------------------------------

function buildReference(mesh) {
    const g   = mesh.geometry;
    const idx = g.index;
    const pos = g.attributes.position;
    const uv  = g.attributes.uv;
    const faceCount = idx.count / 3;
    const m = mesh.matrixWorld;

    const owner   = new Int32Array(W * H).fill(-1);
    const claims  = new Uint8Array(W * H);       // how many faces claim a pixel (overlap check)
    const area    = new Float64Array(faceCount);
    const pixels  = new Uint32Array(faceCount);
    const centroidPx = new Int32Array(faceCount);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

    for (let f = 0; f < faceCount; f++) {
        const i0 = idx.getX(3 * f), i1 = idx.getX(3 * f + 1), i2 = idx.getX(3 * f + 2);
        a.fromBufferAttribute(pos, i0).applyMatrix4(m);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m);
        area[f] = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;

        const x0 = uv.getX(i0) * W, y0 = (1 - uv.getY(i0)) * H;
        const x1 = uv.getX(i1) * W, y1 = (1 - uv.getY(i1)) * H;
        const x2 = uv.getX(i2) * W, y2 = (1 - uv.getY(i2)) * H;
        const cx = Math.min(W - 1, Math.max(0, Math.floor((x0 + x1 + x2) / 3)));
        const cy = Math.min(H - 1, Math.max(0, Math.floor((y0 + y1 + y2) / 3)));
        centroidPx[f] = cy * W + cx;

        const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
        if (d === 0) continue;
        const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
        const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const sx = px + 0.5, sy = py + 0.5;
                const l0 = ((y1 - y2) * (sx - x2) + (x2 - x1) * (sy - y2)) / d;
                const l1 = ((y2 - y0) * (sx - x2) + (x0 - x2) * (sy - y2)) / d;
                const l2 = 1 - l0 - l1;
                if (l0 < 0 || l1 < 0 || l2 < 0) continue;
                const p = py * W + px;
                if (owner[p] !== -1 && owner[p] !== f) claims[p]++;
                owner[p] = f;
            }
        }
    }
    for (let p = 0; p < W * H; p++) if (owner[p] >= 0) pixels[owner[p]]++;

    const region = (f) => AppState.faceRegionMap.get(f) || null;
    return { owner, claims, area, pixels, centroidPx, faceCount, region };
}

/** Painted area from the canvas itself: a pixel is painted if it isn't white. */
function referencePaintedArea(canvas) {
    const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const painted = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) {
        const o = 4 * p;
        if (!(data[o] === 255 && data[o + 1] === 255 && data[o + 2] === 255)) painted[p] = 1;
    }
    const counts = new Map();
    for (let p = 0; p < W * H; p++) {
        if (!painted[p]) continue;
        const f = ref.owner[p];
        if (f >= 0) counts.set(f, (counts.get(f) || 0) + 1);
    }
    let total = 0;
    const regions = {};
    const add = (f, amount) => {
        const r = ref.region(f);
        if (!r) return;
        total += amount;
        regions[r] = (regions[r] || 0) + amount;
    };
    for (const [f, n] of counts) add(f, ref.area[f] * n / ref.pixels[f]);
    // Faces too small to own a pixel centre: count them if their centroid pixel is painted
    for (let f = 0; f < ref.faceCount; f++) {
        if (ref.pixels[f] === 0 && painted[ref.centroidPx[f]]) add(f, ref.area[f]);
    }
    let paintedPixels = 0;
    for (let p = 0; p < W * H; p++) paintedPixels += painted[p];
    return { area: total, regions, paintedPixels };
}

// ----------------------------------------------------------------------------
// Independent ground truth: random points on the 3D surface
// ----------------------------------------------------------------------------
//
// Scatter points evenly over the real 3D surface (each triangle gets points in
// proportion to its 3D area, at random positions inside it). Each point's
// texture pixel comes from its own interpolated UV — the same lookup the GPU
// does when it shows the texture. Painted area ≈ share of points that land on
// a painted pixel × total area. This does NOT use the pixel → triangle map,
// so it checks the app's area maths independently.

/** Small seeded random generator, so runs are repeatable. */
function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildSurfaceSamples(mesh, target) {
    const idx = mesh.geometry.index;
    const uv  = mesh.geometry.attributes.uv;
    const rand = mulberry32(12345);
    let total = 0;
    for (let f = 0; f < ref.faceCount; f++) total += ref.area[f];

    const pixel = new Int32Array(Math.ceil(target * 1.01) + ref.faceCount);
    const face  = new Int32Array(pixel.length);
    let n = 0;
    for (let f = 0; f < ref.faceCount; f++) {
        // Expected count ∝ area; random rounding keeps it unbiased
        const expected = target * ref.area[f] / total;
        const k = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
        const i0 = idx.getX(3 * f), i1 = idx.getX(3 * f + 1), i2 = idx.getX(3 * f + 2);
        for (let j = 0; j < k; j++) {
            // Uniform random point in a triangle
            const r1 = Math.sqrt(rand()), r2 = rand();
            const a = 1 - r1, b = r1 * (1 - r2), c = r1 * r2;
            const u = a * uv.getX(i0) + b * uv.getX(i1) + c * uv.getX(i2);
            const v = a * uv.getY(i0) + b * uv.getY(i1) + c * uv.getY(i2);
            const px = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
            const py = Math.min(H - 1, Math.max(0, Math.floor((1 - v) * H)));
            pixel[n] = py * W + px;
            face[n] = f;
            n++;
        }
    }
    return { pixel: pixel.subarray(0, n), face: face.subarray(0, n), count: n, areaPerSample: total / n };
}

/** Painted area estimated from the surface points, with a 95% margin. */
function sampledPaintedArea(mask) {
    let hits = 0;
    const regions = {};
    for (let i = 0; i < samples.count; i++) {
        if (!mask[samples.pixel[i]]) continue;
        const r = ref.region(samples.face[i]);
        if (!r) continue;                 // the app also leaves out faces with no region
        hits++;
        regions[r] = (regions[r] || 0) + 1;
    }
    const area = hits * samples.areaPerSample;
    for (const r in regions) regions[r] *= samples.areaPerSample;
    return { area, hits, margin95: hits ? 1.96 / Math.sqrt(hits) : null, regions };
}

// ----------------------------------------------------------------------------
// Drawing
// ----------------------------------------------------------------------------

function newInstance() {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, W, H);
    const inst = {
        id: `drawing-${AppState.drawingInstances.length + 1}`,
        canvas, context,
        texture: new THREE.CanvasTexture(canvas),
        drawnRegionNames: new Set(),
        regionPixelMap: {},
        coloredFaces: new Set(),
        color: '#e63946'
    };
    AppState.drawingInstances.push(inst);
    AppState.currentDrawingIndex = AppState.drawingInstances.length - 1;
    return inst;
}

/** A camera looking straight at the middle of a region, from `dist` away. */
function cameraForRegion(regionName, dist) {
    const mesh = AppState.skinMesh;
    const idx = mesh.geometry.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const centre = new THREE.Vector3();
    let total = 0;
    const faces = [];
    for (let f = 0; f < ref.faceCount; f++) {
        if (ref.region(f) !== regionName) continue;
        // Displayed (skinned) positions — what the raycaster sees
        mesh.getVertexPosition(idx.getX(3 * f), a).applyMatrix4(mesh.matrixWorld);
        mesh.getVertexPosition(idx.getX(3 * f + 1), b).applyMatrix4(mesh.matrixWorld);
        mesh.getVertexPosition(idx.getX(3 * f + 2), c).applyMatrix4(mesh.matrixWorld);
        const fc = a.clone().add(b).add(c).divideScalar(3);
        const n = b.clone().sub(a).cross(c.clone().sub(a));
        faces.push({ fc, n });
        centre.addScaledVector(fc, ref.area[f]);
        total += ref.area[f];
    }
    if (!faces.length) throw new Error(`No faces in region ${regionName}`);
    centre.divideScalar(total);
    let best = faces[0];
    for (const fz of faces) if (fz.fc.distanceTo(centre) < best.fc.distanceTo(centre)) best = fz;
    // Average normal of faces near the target, for a stable view direction
    const normal = new THREE.Vector3();
    for (const fz of faces) if (fz.fc.distanceTo(best.fc) < 0.03) normal.add(fz.n);
    normal.normalize();

    // Try both sides of the surface; keep the camera whose centre ray
    // actually lands on the target region (not on something in front of it).
    const rc = new THREE.Raycaster();
    for (const sign of [1, -1]) {
        const cam = new THREE.PerspectiveCamera(75, 1, 0.01, 100);
        cam.position.copy(best.fc).addScaledVector(normal, sign * dist);
        cam.up.set(0, Math.abs(normal.y) > 0.9 ? 0 : 1, Math.abs(normal.y) > 0.9 ? 1 : 0);
        cam.lookAt(best.fc);
        cam.updateMatrixWorld(true);
        cam.updateProjectionMatrix();
        rc.setFromCamera(new THREE.Vector2(0, 0), cam);
        const hit = rc.intersectObject(mesh, true)[0];
        if (hit && ref.region(hit.faceIndex) === regionName) return cam;
    }
    throw new Error(`No clear view of region ${regionName} from ${dist} units`);
}

/**
 * Horizontal stroke across the middle of a region, through drawAtPointer
 * (the same entry point real pointer events use).
 */
function stroke(cam, { radius, erase = false, from = -0.15, to = 0.15, y = 0, steps = 60 }) {
    AppState.brushRadius = radius;
    for (let i = 0; i <= steps; i++) {
        const x = steps === 0 ? from : from + (to - from) * (i / steps);
        drawAtPointer(cam, new THREE.Vector2(x, y), erase);
    }
}

/** drawnRegions as the app reports it (works before and after the #16 fix). */
function appDrawnRegions(inst) {
    if (typeof coverageCalculator.getDrawnRegions === 'function') {
        return [...coverageCalculator.getDrawnRegions(inst)];
    }
    return [...(inst.drawnRegionNames || [])];
}

function measure(inst) {
    const cov = coverageCalculator.calculateCoverage(inst);
    const truth = referencePaintedArea(inst.canvas);
    const appRegions = appDrawnRegions(inst).sort();
    const truthRegions = Object.keys(truth.regions).sort();
    const regionSum = Object.values(cov.regions).reduce((s, r) => s + r.coloredArea, 0);
    const sampled = inst.paintedMask ? sampledPaintedArea(inst.paintedMask) : null;
    // Regions with clear sampled paint (≥ 20 points) that the app doesn't list
    const sampledOnly = sampled
        ? Object.entries(sampled.regions)
            .filter(([r, a]) => !appRegions.includes(r) && a / samples.areaPerSample >= 20)
            .map(([r]) => r)
        : [];
    return {
        sampledArea: sampled?.area ?? null,
        sampledMargin95: sampled?.margin95 ?? null,
        sampledHits: sampled?.hits ?? null,
        sampledOnlyRegions: sampledOnly,
        // Per region: app area ÷ sampled area, for regions with ≥ 400 sample
        // points (sampling margin ≤ ~10%)
        regionRatios: sampled
            ? Object.entries(sampled.regions)
                .filter(([, a]) => a / samples.areaPerSample >= 400)
                .map(([r, a]) => ({
                    region: r,
                    ratio: (cov.regions[r]?.coloredArea || 0) / a,
                    margin95: 1.96 / Math.sqrt(a / samples.areaPerSample)
                }))
            : [],
        appArea: cov.overall.coloredArea,
        appPercent: cov.overall.percentage,
        appRegionSum: regionSum,
        truthArea: truth.area,
        truthPercent: truth.area / coverageCalculator.totalBodyArea * 100,
        paintedPixels: truth.paintedPixels,
        appRegions,
        truthRegions,
        missingRegions: truthRegions.filter((r) => !appRegions.includes(r)),
        extraRegions: appRegions.filter((r) => !truthRegions.includes(r))
    };
}

// ----------------------------------------------------------------------------
// Scenarios
// ----------------------------------------------------------------------------

/** One stroke at several brush sizes, a fresh drawing each time. */
function brushSizeScenario(regionName, radii = [5, 10, 30], dist = 0.5) {
    const cam = cameraForRegion(regionName, dist);
    return radii.map((radius) => {
        const inst = newInstance();
        stroke(cam, { radius });
        return { region: regionName, radius, ...measure(inst) };
    });
}

/** Paint a thick stroke, then erase a thinner band through its middle. */
function eraseScenario(regionName, dist = 0.5) {
    const cam = cameraForRegion(regionName, dist);
    const inst = newInstance();
    stroke(cam, { radius: 25 });
    const before = measure(inst);
    stroke(cam, { radius: 10, erase: true, from: -0.05, to: 0.05 });
    const after = measure(inst);
    return { region: regionName, before, after };
}

/** How triangle size and texture density vary across the body. */
function meshStats() {
    const byPart = {};
    for (let f = 0; f < ref.faceCount; f++) {
        const r = ref.region(f);
        const part = r ? (coverageCalculator.regionToBodyPart[r] || 'other') : 'unassigned';
        (byPart[part] ||= { faces: 0, area: 0, pixels: 0, faceAreas: [] });
        byPart[part].faces++;
        byPart[part].area += ref.area[f];
        byPart[part].pixels += ref.pixels[f];
        byPart[part].faceAreas.push(ref.area[f]);
    }
    let overlap = 0, tinyFaces = 0, tinyArea = 0;
    const tinyByPart = {};
    for (let p = 0; p < W * H; p++) if (ref.claims[p]) overlap++;
    for (let f = 0; f < ref.faceCount; f++) {
        if (ref.pixels[f] !== 0) continue;
        tinyFaces++;
        tinyArea += ref.area[f];
        const r = ref.region(f);
        const part = r ? (coverageCalculator.regionToBodyPart[r] || 'other') : 'unassigned';
        tinyByPart[part] = (tinyByPart[part] || 0) + ref.area[f];
    }
    const rows = Object.entries(byPart).map(([part, s]) => {
        s.faceAreas.sort((x, y) => x - y);
        return {
            part,
            faces: s.faces,
            areaCm2: s.area * 1e4,
            medianFaceMm2: s.faceAreas[Math.floor(s.faceAreas.length / 2)] * 1e6,
            pixels: s.pixels,
            mm2PerPixel: s.pixels ? (s.area / s.pixels) * 1e6 : null
        };
    }).sort((x, y) => x.mm2PerPixel - y.mm2PerPixel);
    return {
        faces: ref.faceCount,
        totalBodyAreaM2: coverageCalculator.totalBodyArea,
        tinyFaces,
        tinyAreaShare: tinyArea / coverageCalculator.totalBodyArea,
        tinyByPart: Object.entries(tinyByPart)
            .map(([part, a]) => ({ part, shareOfPart: a / (byPart[part]?.area || 1) }))
            .sort((x, y) => y.shareOfPart - x.shareOfPart),
        pixelsClaimedTwice: overlap,
        rows
    };
}

/** Single dab at the region centre: which face was hit, which regions got paint. */
function dab(regionName, radius, dist = 0.5) {
    const cam = cameraForRegion(regionName, dist);
    const inst = newInstance();
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), cam);
    const hit = rc.intersectObject(AppState.skinMesh, true)[0];
    stroke(cam, { radius, from: 0, to: 0, steps: 0 });
    return { radius, hitRegion: hit ? ref.region(hit.faceIndex) : null, painted: Object.keys(referencePaintedArea(inst.canvas).regions) };
}

window.harness = { dab, load, meshStats, brushSizeScenario, eraseScenario };
document.getElementById('status').textContent = 'ready';
