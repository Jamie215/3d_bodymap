// drawingEngine.js
// Core drawing service: texture painting, pointer dispatch, and
// drawing-instance lifecycle (create, blank-check, update, recolor).
//
// UV rasterization math → utils/uvRasterizer.js
// Region pixel tracking → utils/regionTracker.js

import AppState from '../app/state.js';
import texturePool from '../utils/textureManager.js';
import { buildGlobalUVMap as rasterizeBuildGlobalUVMap } from '../utils/uvRasterizer.js';
import { updateRegionMapFromHit, eraseFromRegionMap } from '../utils/regionTracker.js';

const raycaster         = new THREE.Raycaster();
const mirroredRaycaster = new THREE.Raycaster();

const colorPalette = [
    '#4269d0', '#efb118', '#ff725c', '#6cc5b0', '#03831c',
    '#ff8ab7', '#a463f2', '#97bbf5', '#9c6b4e', '#333399'
];

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

// ============================================================================
// INSTANCE LIFECYCLE
// ============================================================================

/** Create a new drawing instance with a fresh texture from the pool. */
export function addNewDrawingInstance() {
    const instanceId    = `drawing-${AppState.drawingInstances.length + 1}`;
    const textureBundle = texturePool.getNewTexture(instanceId);

    const newInstance = {
        id: instanceId,
        canvas: textureBundle.canvas,
        context: textureBundle.context,
        texture: textureBundle.texture,
        drawnRegionNames: new Set(),
        regionPixelMap: {},
        coloredFaces: new Set(),
        questionnaireData: null,
        uvDrawingData: null,
        color: colorPalette[AppState.drawingInstances.length % colorPalette.length]
    };

    // Overlay the persistent base texture
    if (AppState.baseTextureCanvas) {
        const snapshot = document.createElement('canvas');
        snapshot.width  = AppState.baseTextureCanvas.width;
        snapshot.height = AppState.baseTextureCanvas.height;
        snapshot.getContext('2d').drawImage(AppState.baseTextureCanvas, 0, 0);
        newInstance.context.drawImage(snapshot, 0, 0);
    }

    AppState.drawingInstances.push(newInstance);
    AppState.currentDrawingIndex = AppState.drawingInstances.length - 1;
    updateCurrentDrawing();
}

/** Check whether the current drawing instance is visually blank (all-white). */
export function isDrawingBlank() {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if (!currentInstance || !currentInstance.canvas) return true;

    const ctx = currentInstance.context;
    const { width, height } = currentInstance.canvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;

    for (let i = 0; i < imageData.length; i += 4) {
        if (!(imageData[i] === 255 && imageData[i + 1] === 255 && imageData[i + 2] === 255 && imageData[i + 3] === 255)) {
            return false;
        }
    }
    return true;
}

/** Apply the current drawing instance's texture to the 3D model. */
export function updateCurrentDrawing() {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if (!currentInstance || !AppState.skinMesh?.material) return;

    AppState.skinMesh.userData.canvas  = currentInstance.canvas;
    AppState.skinMesh.userData.context = currentInstance.context;
    AppState.skinMesh.userData.texture = currentInstance.texture;

    AppState.skinMesh.material.map        = currentInstance.texture;
    AppState.skinMesh.material.needsUpdate = true;
    currentInstance.texture.needsUpdate    = true;

    // Rebuild drawnRegionNames from the regionPixelMap
    const pixelMap = currentInstance.regionPixelMap;
    currentInstance.drawnRegionNames = new Set(
        Object.keys(pixelMap).filter(group => pixelMap[group].size > 0)
    );
}

// ============================================================================
// INSTANCE RECOLORING
// ============================================================================

/** Reassign palette colors to all drawing instances (after deletion/reindex). */
export function updateInstanceColors() {
    AppState.drawingInstances.forEach((instance, index) => {
        const newColor = colorPalette[index % colorPalette.length];
        instance.color = newColor;
        redrawInstanceWithNewColor(instance);
    });
}

/** Repaint all non-white pixels with the instance's current color. */
function redrawInstanceWithNewColor(instance) {
    const { canvas, context, color } = instance;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels    = imageData.data;
    const newColor  = hexToRgb(color);

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        if (a > 0 && !(r === 255 && g === 255 && b === 255)) {
            pixels[i]     = newColor.r;
            pixels[i + 1] = newColor.g;
            pixels[i + 2] = newColor.b;
        }
    }

    context.putImageData(imageData, 0, 0);
    instance.texture.needsUpdate = true;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 0, g: 0, b: 0 };
}