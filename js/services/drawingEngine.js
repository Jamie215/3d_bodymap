// drawingEngine.js
// Core drawing service: texture painting, pointer dispatch, and
// region mapping initialization.

import * as THREE from 'three';
import AppState from '../app/state.js';
import { buildGlobalUVMap as rasterizeBuildGlobalUVMap } from '../utils/uvRasterizer.js';
import { updateRegionMapFromHit, eraseFromRegionMap } from '../utils/regionTracker.js';

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
 */
export function drawAtUV(uv, canvas, context, radius, isErasing = false) {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    const cx = Math.floor(uv.x * canvas.width);
    const cy = Math.floor((1 - uv.y) * canvas.height);

    const radiusSq = radius * radius;

    const minPx = Math.max(0, cx - radius);
    const maxPx = Math.min(canvas.width - 1, cx + radius);
    const minPy = Math.max(0, cy - radius);
    const maxPy = Math.min(canvas.height - 1, cy + radius);

    const regionW = maxPx - minPx + 1;
    const regionH = maxPy - minPy + 1;

    if (!isErasing) {
        context.fillStyle = currentInstance.color;
    }

    // Batch-read the base texture once for erase mode
    const baseCtx = AppState.baseTextureContext;
    let baseData  = null;
    if (isErasing && baseCtx) {
        baseData = baseCtx.getImageData(minPx, minPy, regionW, regionH).data;
    }

    for (let py = minPy; py <= maxPy; py++) {
        for (let px = minPx; px <= maxPx; px++) {
            const dx = px - cx;
            const dy = py - cy;
            if (dx * dx + dy * dy > radiusSq) continue;

            const key = `${px},${py}`;
            if (!AppState.globalUVMap.has(key)) continue;

            if (isErasing && baseData) {
                const localX = px - minPx;
                const localY = py - minPy;
                const offset = (localY * regionW + localX) * 4;
                context.fillStyle = `rgba(${baseData[offset]},${baseData[offset + 1]},${baseData[offset + 2]},${baseData[offset + 3] / 255})`;
            }

            context.fillRect(px, py, 1, 1);
        }
    }
}

// ============================================================================
// POINTER DISPATCH
// ============================================================================

/** Cast a ray from the camera through the pointer and draw/erase on the hit. */
export function drawAtPointer(camera, pointer, isErasing = false) {
    if (!AppState.skinMesh) {
        console.warn("Doesn't have a skinmesh");
        return;
    }

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

/** Process a single raycast hit — paint pixels and update tracking. */
function processHit(hit, isErasing) {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    const { canvas, context, texture } = currentInstance;

    const hitRegion = AppState.faceRegionMap?.get(hit.faceIndex) || null;

    drawAtUV(hit.uv, canvas, context, AppState.brushRadius, isErasing);

    if (!isErasing) {
        updateRegionMapFromHit(hit, currentInstance, hitRegion);

        if (!currentInstance.coloredFaces) currentInstance.coloredFaces = new Set();
        currentInstance.coloredFaces.add(hit.faceIndex);
    } else {
        // Snapshot which regions still have pixels BEFORE erasing
        const regionsBefore = currentInstance.regionPixelMap
            ? new Set(Object.keys(currentInstance.regionPixelMap))
            : new Set();

        eraseFromRegionMap(hit, currentInstance, AppState.brushRadius);

        // Find regions that were fully cleared by this erase stroke
        const regionsAfter = currentInstance.regionPixelMap
            ? new Set(Object.keys(currentInstance.regionPixelMap))
            : new Set();

        const clearedRegions = new Set();
        for (const region of regionsBefore) {
            if (!regionsAfter.has(region)) {
                clearedRegions.add(region);
            }
        }

        // Remove face indices belonging to fully-cleared regions
        if (clearedRegions.size > 0 && currentInstance.coloredFaces && AppState.faceRegionMap) {
            for (const faceIdx of currentInstance.coloredFaces) {
                const faceRegion = AppState.faceRegionMap.get(faceIdx);
                if (faceRegion && clearedRegions.has(faceRegion)) {
                    currentInstance.coloredFaces.delete(faceIdx);
                }
            }
        }

        // Always remove the directly-hit face as before
        if (currentInstance.coloredFaces) {
            currentInstance.coloredFaces.delete(hit.faceIndex);
        }
    }

    texture.needsUpdate = true;
}