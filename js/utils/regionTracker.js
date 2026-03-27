// regionTracker.js
// Tracks which anatomical regions have drawn/erased pixels.
// Operates on drawing instance objects — no Three.js or DOM dependency.

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Record that a pixel was drawn in a specific region.
 *
 * @param {{ uv: {x,y} }}  hit            — raycast hit with UV coordinates
 * @param {Object}          instance       — drawing instance (has .canvas, .drawnRegionNames, .regionPixelMap)
 * @param {string|null}     regionName     — anatomical region at the hit point
 */
export function updateRegionMapFromHit(hit, instance, regionName) {
    if (!regionName) return;

    const x   = Math.round(hit.uv.x * instance.canvas.width);
    const y   = Math.round((1 - hit.uv.y) * instance.canvas.height);
    const key = `${x},${y}`;

    instance.drawnRegionNames = instance.drawnRegionNames || new Set();
    instance.drawnRegionNames.add(regionName);

    if (!instance.regionPixelMap) instance.regionPixelMap = {};
    if (!instance.regionPixelMap[regionName]) {
        instance.regionPixelMap[regionName] = new Set();
    }
    instance.regionPixelMap[regionName].add(key);
}

/**
 * Remove pixels from region tracking when erasing.
 *
 * IMPORTANT: iterates ALL regions for each pixel, not just the raycast-hit
 * region, to keep pixel tracking synchronised with the visual canvas state.
 *
 * @param {{ uv: {x,y} }}  hit        — raycast hit with UV coordinates
 * @param {Object}          instance   — drawing instance
 * @param {number}          radius     — brush radius in pixels
 */
export function eraseFromRegionMap(hit, instance, radius) {
    const x = Math.round(hit.uv.x * instance.canvas.width);
    const y = Math.round((1 - hit.uv.y) * instance.canvas.height);

    if (!instance.regionPixelMap) return;

    const radiusSq = radius * radius;

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            if (dx * dx + dy * dy > radiusSq) continue;

            const px = x + dx;
            const py = y + dy;
            if (px < 0 || py < 0 || px >= instance.canvas.width || py >= instance.canvas.height) continue;

            const eraseKey = `${px},${py}`;

            // Check ALL regions for this pixel
            for (const region of Object.keys(instance.regionPixelMap)) {
                const pixelSet = instance.regionPixelMap[region];
                if (pixelSet && pixelSet.has(eraseKey)) {
                    pixelSet.delete(eraseKey);
                    if (pixelSet.size === 0) {
                        delete instance.regionPixelMap[region];
                        instance.drawnRegionNames.delete(region);
                    }
                }
            }
        }
    }
}