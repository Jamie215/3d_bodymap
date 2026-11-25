// paintedArea.js
// Pure maths for measuring how much of the body is painted.
// No AppState, no Three.js, no DOM — so it can be unit-tested in Node.
//
// How it works (see Jamie215/3d_bodymap#16):
//   - Each drawing area keeps a "painted mask": one byte per texture pixel,
//     1 = painted, 0 = not. The brush sets pixels to 1, the eraser to 0.
//   - Each texture pixel belongs to one mesh triangle (the triangle whose
//     UV footprint contains the pixel's centre) — see buildPixelFaceMap in
//     uvRasterizer.js.
//   - A triangle's painted area = its real 3D area × (painted pixels in it ÷
//     all pixels in it). So every pixel is weighted by its own triangle's
//     "3D area per pixel", which cancels out uneven texture stretching and
//     uneven triangle sizes.

/**
 * Visit every pixel inside a round brush centred on (cx, cy).
 * This is the brush shape used for painting, erasing and the mask.
 *
 * @param {number} cx, cy  — centre pixel
 * @param {number} radius  — brush radius in pixels
 * @param {number} width, height — texture size (pixels outside are skipped)
 * @param {(px: number, py: number) => void} visit
 */
export function forEachBrushPixel(cx, cy, radius, width, height, visit) {
    const radiusSq = radius * radius;
    const minPx = Math.max(0, cx - radius);
    const maxPx = Math.min(width - 1, cx + radius);
    const minPy = Math.max(0, cy - radius);
    const maxPy = Math.min(height - 1, cy + radius);

    for (let py = minPy; py <= maxPy; py++) {
        for (let px = minPx; px <= maxPx; px++) {
            const dx = px - cx;
            const dy = py - cy;
            if (dx * dx + dy * dy > radiusSq) continue;
            visit(px, py);
        }
    }
}

/**
 * Work out painted 3D area per triangle and per region from a painted mask.
 *
 * @param {Uint8Array}  mask            — 1 byte per pixel, non-zero = painted
 * @param {Object}      pixelMap        — from buildPixelFaceMap()
 * @param {Int32Array}  pixelMap.pixelFace       — pixel → face index, or -1
 * @param {Uint32Array} pixelMap.facePixelCount  — face → number of pixels it owns
 * @param {Int32Array}  pixelMap.tinyFaces       — flat [face, pixel, face, pixel, …]
 *                                                 for faces too small to own a pixel
 * @param {ArrayLike<number>}      faceAreas     — face → real 3D area
 * @param {ArrayLike<string|null>} faceToRegion  — face → region name (null = none)
 * @returns {{ regionAreas: Object<string, number>, totalArea: number, paintedFaceCount: number }}
 *   Faces with no region are left out of every total, as before.
 */
export function computePaintedArea(mask, pixelMap, faceAreas, faceToRegion) {
    const { pixelFace, facePixelCount, tinyFaces } = pixelMap;

    // Count painted pixels per face
    const paintedCounts = new Map();
    for (let p = 0; p < mask.length; p++) {
        if (!mask[p]) continue;
        const face = pixelFace[p];
        if (face < 0) continue;
        paintedCounts.set(face, (paintedCounts.get(face) || 0) + 1);
    }

    const regionAreas = {};
    let totalArea = 0;
    let paintedFaceCount = 0;

    const addArea = (face, area) => {
        paintedFaceCount++;
        const region = faceToRegion[face];
        if (!region || !area) return;
        regionAreas[region] = (regionAreas[region] || 0) + area;
        totalArea += area;
    };

    for (const [face, painted] of paintedCounts) {
        addArea(face, faceAreas[face] * painted / facePixelCount[face]);
    }

    // Triangles smaller than a pixel: all-or-nothing on their centre pixel
    for (let i = 0; i < tinyFaces.length; i += 2) {
        const face = tinyFaces[i];
        const pixel = tinyFaces[i + 1];
        if (mask[pixel]) addArea(face, faceAreas[face]);
    }

    return { regionAreas, totalArea, paintedFaceCount };
}
