// drawingEngine.js
// Core drawing service: texture painting, pointer dispatch, and
// region mapping initialization.

import * as THREE from 'three';
import AppState from '../app/state.js';
import { buildGlobalUVMap as rasterizeBuildGlobalUVMap } from '../utils/uvRasterizer.js';
import { forEachBrushPixel } from '../utils/paintedArea.js';

const raycaster         = new THREE.Raycaster();
const mirroredRaycaster = new THREE.Raycaster();

// ============================================================================
// REGION MAPPINGS
// ============================================================================

export async function initializeRegionMappings() {
    try {
        const response    = await fetch('../../assets/region_id_mapping.json');
        const mappingData = await response.json();

        const idToRegionMap = {};
        for (const [id, region] of Object.entries(mappingData.id_to_region)) {
            idToRegionMap[parseInt(id)] = region;
        }

        AppState.regionToIdMap = mappingData.region_to_id;
        AppState.idToRegionMap = idToRegionMap;
    } catch (error) {
        console.error('Failed to load vertex group mappings', error);
        AppState.idToRegionMap = { 0: 'unassigned' };
        AppState.regionToIdMap = {};
    }
}

// ============================================================================
// UV MAP BUILDING — thin wrapper around uvRasterizer
// ============================================================================

/**
 * Build the global UV map by delegating to the pure rasterizer.
 * Passes AppState.idToRegionMap so the rasterizer stays stateless.
 */
export function buildGlobalUVMap(geometry, canvasWidth, canvasHeight) {
    return rasterizeBuildGlobalUVMap(geometry, canvasWidth, canvasHeight, AppState.idToRegionMap);
}

// ============================================================================
// CORE DRAWING
// ============================================================================

/**
 * Paint or erase a circular brush stroke at a UV coordinate.
 * Only iterates the brush bounding box (not the full 1024×1024 canvas).
 *
 * Also updates the drawing's painted mask (1 = painted, 0 = not) for exactly
 * the pixels changed here. Coverage and drawnRegions are measured from that
 * mask, so they always match what the participant sees.
 */
function drawAtUV(uv, instance, radius, isErasing = false) {
    const { canvas, context } = instance;
    const width  = canvas.width;
    const height = canvas.height;
    const cx = Math.floor(uv.x * width);
    const cy = Math.floor((1 - uv.y) * height);

    if (!instance.paintedMask) instance.paintedMask = new Uint8Array(width * height);
    const mask = instance.paintedMask;

    const minPx = Math.max(0, cx - radius);
    const minPy = Math.max(0, cy - radius);
    const regionW = Math.min(width - 1, cx + radius) - minPx + 1;
    const regionH = Math.min(height - 1, cy + radius) - minPy + 1;
    if (regionW <= 0 || regionH <= 0) return;

    if (!isErasing) {
        context.fillStyle = instance.color;
    }

    // Batch-read the base texture once for erase mode
    const baseCtx = AppState.baseTextureContext;
    let baseData  = null;
    if (isErasing && baseCtx) {
        baseData = baseCtx.getImageData(minPx, minPy, regionW, regionH).data;
    }

    forEachBrushPixel(cx, cy, radius, width, height, (px, py) => {
        if (!AppState.globalUVMap.has(`${px},${py}`)) return;

        if (isErasing && baseData) {
            const offset = ((py - minPy) * regionW + (px - minPx)) * 4;
            context.fillStyle = `rgba(${baseData[offset]},${baseData[offset + 1]},${baseData[offset + 2]},${baseData[offset + 3] / 255})`;
        }

        context.fillRect(px, py, 1, 1);
        mask[py * width + px] = isErasing ? 0 : 1;
    });
}

// ============================================================================
// POINTER DISPATCH
// ============================================================================

/** Cast a ray from the camera through the pointer and draw/erase on the hit. */
export function drawAtPointer(camera, pointer, isErasing = false) {
    if (!AppState.skinMesh) return;

    AppState.skinMesh.updateMatrixWorld(true);

    raycaster.setFromCamera(pointer, camera);
    raycaster.near = camera.near;
    raycaster.far  = camera.far;

    const intersects = raycaster.intersectObject(AppState.skinMesh, true);

    if (intersects.length > 0) {
        const hit = intersects[0];
        processHit(hit, isErasing);

        // Mirror drawing across the body centerline seam
        const distanceFromCenter = Math.abs(hit.point.x);
        const seamThreshold = 0.0075;

        if (distanceFromCenter <= seamThreshold) {
            const mirroredOrigin = raycaster.ray.origin.clone().multiply(new THREE.Vector3(-1, 1, 1));
            const mirroredDir    = raycaster.ray.direction.clone().multiply(new THREE.Vector3(-1, 1, 1));

            mirroredRaycaster.set(mirroredOrigin, mirroredDir);
            mirroredRaycaster.near = camera.near;
            mirroredRaycaster.far  = camera.far;

            const mirroredHits = mirroredRaycaster.intersectObject(AppState.skinMesh, true);
            if (mirroredHits.length > 0) {
                processHit(mirroredHits[0], isErasing);
            }
        }
    }
}

/** Process a single raycast hit — paint or erase pixels (and the painted mask). */
function processHit(hit, isErasing) {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];

    drawAtUV(hit.uv, currentInstance, AppState.brushRadius, isErasing);

    currentInstance.texture.needsUpdate = true;
}
