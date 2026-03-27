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
 * @returns {{ globalUVMap: Map, globalPixelRegionMap: Map, faceRegionMap: Map }}
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

    return { globalUVMap, globalPixelRegionMap, faceRegionMap };
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