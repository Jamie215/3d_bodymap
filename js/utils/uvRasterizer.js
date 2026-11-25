// uvRasterizer.js
// Pure math for mapping 3D mesh geometry to 2D texture space.
// No AppState, no Three.js dependency — operates on raw attribute arrays.

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Build the complete UV-to-pixel and pixel-to-region lookup tables
 * from a mesh geometry's index, UV, and regionID attributes.
 *
 * @param {BufferGeometry} geometry    — must have .index, .attributes.uv, .attributes._regionid
 * @param {number}         canvasWidth
 * @param {number}         canvasHeight
 * @param {Object}         idToRegionMap — numeric ID → region name
 * @returns {{ globalUVMap: Map, globalPixelRegionMap: Map, faceRegionMap: Map, pixelMap: PixelFaceMap }}
 */
export function buildGlobalUVMap(geometry, canvasWidth, canvasHeight, idToRegionMap) {
    const indexAttr    = geometry.index;
    const uvAttr       = geometry.attributes.uv;
    const regionIDAttr = geometry.attributes._regionid;

    if (!regionIDAttr) {
        console.error('No regionID attribute available to identify location');
    }

    const faceCount          = indexAttr.count / 3;
    const globalUVMap        = new Map();
    const globalPixelRegionMap = new Map();
    const faceRegionMap      = new Map();

    for (let faceIdx = 0; faceIdx < faceCount; faceIdx++) {
        const a = indexAttr.getX(faceIdx * 3);
        const b = indexAttr.getX(faceIdx * 3 + 1);
        const c = indexAttr.getX(faceIdx * 3 + 2);

        const uvA = uvToPixel(uvAttr, a, canvasWidth, canvasHeight);
        const uvB = uvToPixel(uvAttr, b, canvasWidth, canvasHeight);
        const uvC = uvToPixel(uvAttr, c, canvasWidth, canvasHeight);

        const dominantRegion = getDominantRegionForFace(regionIDAttr, a, b, c, idToRegionMap);
        faceRegionMap.set(faceIdx, dominantRegion);

        rasterizeTriangle(uvA, uvB, uvC, canvasWidth, canvasHeight, globalUVMap, globalPixelRegionMap, dominantRegion);
    }

    const pixelMap = buildPixelFaceMap(geometry, canvasWidth, canvasHeight);

    return { globalUVMap, globalPixelRegionMap, faceRegionMap, pixelMap };
}

/**
 * @typedef {Object} PixelFaceMap
 * @property {Int32Array}  pixelFace      — pixel (y * width + x) → owning face index, or -1
 * @property {Uint32Array} facePixelCount — face index → number of pixels it owns
 * @property {Int32Array}  tinyFaces      — flat [face, pixel, …] for faces that own no
 *                                          pixel (smaller than one pixel in the texture);
 *                                          each is linked to the pixel at its centre
 */

/**
 * Work out which triangle owns each texture pixel, for measuring painted area.
 *
 * A pixel belongs to the triangle whose UV footprint contains the pixel's
 * centre. This matches how painting picks pixels (Math.floor of u × width)
 * and how the GPU samples the texture. Unlike buildGlobalUVMap above, there
 * is no 1-pixel border, so each pixel is counted for exactly one triangle.
 *
 * @param {BufferGeometry} geometry — needs .index and .attributes.uv
 * @param {number} width
 * @param {number} height
 * @returns {PixelFaceMap}
 */
export function buildPixelFaceMap(geometry, width, height) {
    const indexAttr = geometry.index;
    const uvAttr    = geometry.attributes.uv;
    const faceCount = indexAttr.count / 3;

    const pixelFace      = new Int32Array(width * height).fill(-1);
    const facePixelCount = new Uint32Array(faceCount);
    const centrePixel    = new Int32Array(faceCount);

    for (let face = 0; face < faceCount; face++) {
        const a = indexAttr.getX(face * 3);
        const b = indexAttr.getX(face * 3 + 1);
        const c = indexAttr.getX(face * 3 + 2);

        // Continuous texture coordinates (pixel units, y down like the canvas)
        const x0 = uvAttr.getX(a) * width, y0 = (1 - uvAttr.getY(a)) * height;
        const x1 = uvAttr.getX(b) * width, y1 = (1 - uvAttr.getY(b)) * height;
        const x2 = uvAttr.getX(c) * width, y2 = (1 - uvAttr.getY(c)) * height;

        const cx = clamp(Math.floor((x0 + x1 + x2) / 3), 0, width - 1);
        const cy = clamp(Math.floor((y0 + y1 + y2) / 3), 0, height - 1);
        centrePixel[face] = cy * width + cx;

        const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
        if (denom === 0) continue; // zero-area in the texture

        const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
        const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
        const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));

        for (let py = minY; py <= maxY; py++) {
            const sy = py + 0.5;
            for (let px = minX; px <= maxX; px++) {
                const sx = px + 0.5;
                // Barycentric weights of the pixel centre
                const w0 = ((y1 - y2) * (sx - x2) + (x2 - x1) * (sy - y2)) / denom;
                const w1 = ((y2 - y0) * (sx - x2) + (x0 - x2) * (sy - y2)) / denom;
                const w2 = 1 - w0 - w1;
                if (w0 < 0 || w1 < 0 || w2 < 0) continue;
                // A centre exactly on a shared edge goes to the later face
                pixelFace[py * width + px] = face;
            }
        }
    }

    for (let p = 0; p < pixelFace.length; p++) {
        if (pixelFace[p] >= 0) facePixelCount[pixelFace[p]]++;
    }

    const tiny = [];
    for (let face = 0; face < faceCount; face++) {
        if (facePixelCount[face] === 0) tiny.push(face, centrePixel[face]);
    }

    return { pixelFace, facePixelCount, tinyFaces: Int32Array.from(tiny) };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Convert UV coordinates to pixel coordinates on the texture canvas. */
function uvToPixel(uvAttr, vertexIndex, canvasWidth, canvasHeight) {
    const u = uvAttr.getX(vertexIndex);
    const v = uvAttr.getY(vertexIndex);
    return {
        x: Math.floor(u * canvasWidth),
        y: Math.floor((1 - v) * canvasHeight)
    };
}

/** Get the region name for a single vertex. */
function getVertexRegion(regionIDAttr, vertexIndex, idToRegionMap) {
    const regionID = regionIDAttr.getX(vertexIndex);
    return idToRegionMap[regionID] || null;
}

/** Determine which anatomical region a 3D face belongs to (majority vote). */
function getDominantRegionForFace(regionIDAttr, vertexA, vertexB, vertexC, idToRegionMap) {
    const regionA = getVertexRegion(regionIDAttr, vertexA, idToRegionMap);
    const regionB = getVertexRegion(regionIDAttr, vertexB, idToRegionMap);
    const regionC = getVertexRegion(regionIDAttr, vertexC, idToRegionMap);

    const regions = [regionA, regionB, regionC].filter(r => r && r !== 'unassigned');
    if (regions.length === 0) return null;

    const counts = {};
    regions.forEach(region => {
        counts[region] = (counts[region] || 0) + 1;
    });

    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

/** Fill triangle area in UV space with region data (with 1px dilation). */
function rasterizeTriangle(p0, p1, p2, canvasWidth, canvasHeight, globalUVMap, globalPixelRegionMap, dominantRegion) {
    const minX = Math.max(0, Math.min(p0.x, p1.x, p2.x));
    const maxX = Math.min(canvasWidth - 1, Math.max(p0.x, p1.x, p2.x));
    const minY = Math.max(0, Math.min(p0.y, p1.y, p2.y));
    const maxY = Math.min(canvasHeight - 1, Math.max(p0.y, p1.y, p2.y));

    const dilation = 1;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (pointInTriangle({ x, y }, p0, p1, p2)) {
                for (let dy = -dilation; dy <= dilation; dy++) {
                    for (let dx = -dilation; dx <= dilation; dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        if (px < 0 || py < 0 || px >= canvasWidth || py >= canvasHeight) continue;
                        const key = `${px},${py}`;
                        globalUVMap.set(key, true);
                        globalPixelRegionMap.set(key, dominantRegion);
                    }
                }
            }
        }
    }
}

/** Barycentric point-in-triangle test. */
function pointInTriangle(p, a, b, c) {
    const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
    const s = (1 / (2 * area)) * (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y);
    const t = (1 / (2 * area)) * (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y);
    const u = 1 - s - t;
    return s >= 0 && t >= 0 && u >= 0;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
