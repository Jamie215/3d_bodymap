// drawingInstanceManager.js
// Manages drawing instance lifecycle: creation, deletion, blank-check,
// texture update, color assignment, empty-drawing guards, texture
// refresh after deletion, and preview generation.

import * as THREE from 'three';
import AppState from './state.js';
import { createCombinedTexture } from '../services/submissionService.js';
import { showDeleteEmptyModal } from '../components/modal.js';
import { clearSurveyInstance } from '../services/surveyManager.js';
import texturePool from '../services/texturePool.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLOR_PALETTE = [
    '#4269d0', '#efb118', '#ff725c', '#6cc5b0', '#03831c',
    '#ff8ab7', '#a463f2', '#97bbf5', '#9c6b4e', '#333399'
];

// ============================================================================
// MODULE STATE
// ============================================================================

let renderer = null;
let scene    = null;
let camera   = null;
let goTo     = null;   // stage-routing callback, set at init time

let pendingAction = null;   // { type: string } — deferred empty-drawing action

// ============================================================================
// INITIALISATION
// ============================================================================

/**
 * Call once at startup to provide external dependencies.
 *
 * @param {Object} deps
 * @param {THREE.WebGLRenderer} deps.renderer
 * @param {THREE.Scene}          deps.scene
 * @param {THREE.Camera}         deps.camera
 * @param {Function}             deps.goTo  — stage-routing function
 */
export function initInstanceManager(deps) {
    renderer = deps.renderer;
    scene    = deps.scene;
    camera   = deps.camera;
    goTo     = deps.goTo;
}

// ============================================================================
// INSTANCE CREATION
// ============================================================================

/**
 * Create a new drawing instance with a fresh texture from the pool.
 * Assigns a colour from the palette and overlays the base texture.
 */
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
        color: COLOR_PALETTE[AppState.drawingInstances.length % COLOR_PALETTE.length]
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

// ============================================================================
// BLANK-CHECK
// ============================================================================

/**
 * Check whether the current drawing instance is visually blank.
 * Scans pixel data for any non-white content.
 *
 * @returns {boolean} true if the canvas contains only white pixels
 */
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

// ============================================================================
// TEXTURE UPDATE
// ============================================================================

/**
 * Apply the current drawing instance's texture to the 3D model
 * and rebuild drawnRegionNames from the regionPixelMap.
 */
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

/**
 * Reassign palette colors to all drawing instances.
 * Called after deletion/re-indexing to keep colours sequential.
 */
export function updateInstanceColors() {
    AppState.drawingInstances.forEach((instance, index) => {
        const newColor = COLOR_PALETTE[index % COLOR_PALETTE.length];
        instance.color = newColor;
        redrawInstanceWithNewColor(instance);
    });
}

/**
 * Repaint all non-white pixels with the instance's current color.
 * @param {Object} instance — a drawing instance object
 */
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

// ============================================================================
// INSTANCE DELETION
// ============================================================================

/**
 * Remove a drawing instance by index.
 * Disposes its texture, re-indexes remaining instances, and updates
 * AppState.currentDrawingIndex / currentSurveyIndex to stay in bounds.
 */
export function deleteDrawingInstance(index) {
    if (index < 0 || index >= AppState.drawingInstances.length) return;

    const deletedInstance = AppState.drawingInstances.splice(index, 1)[0];
    if (deletedInstance.texture) {
        deletedInstance.texture.dispose();
    }

    // Re-index surviving instances
    AppState.drawingInstances.forEach((instance, idx) => {
        instance.id = `drawing-${idx + 1}`;
    });

    updateInstanceColors();

    // Keep cursors in bounds
    if (AppState.drawingInstances.length === 0) {
        AppState.currentDrawingIndex = 0;
        AppState.currentSurveyIndex  = 0;
    } else if (index >= AppState.drawingInstances.length) {
        AppState.currentDrawingIndex = AppState.drawingInstances.length - 1;
        if (AppState.currentSurveyIndex >= AppState.drawingInstances.length) {
            AppState.currentSurveyIndex = AppState.drawingInstances.length - 1;
        }
    } else {
        AppState.currentDrawingIndex = index;
        if (AppState.currentSurveyIndex > index) {
            AppState.currentSurveyIndex--;
        } else if (
            AppState.currentSurveyIndex === index &&
            AppState.currentSurveyIndex >= AppState.drawingInstances.length
        ) {
            AppState.currentSurveyIndex = AppState.drawingInstances.length - 1;
        }
    }
}

/**
 * Update the 3D model texture after an area is deleted.
 * Shows the combined remaining drawings, or falls back to the base texture.
 */
export function refreshTextureAfterDelete() {
    if (AppState.drawingInstances.length > 0) {
        const combinedCanvas = createCombinedTexture();
        const tempTexture = new THREE.CanvasTexture(combinedCanvas);
        tempTexture.needsUpdate = true;

        if (AppState.skinMesh) {
            AppState.skinMesh.material.map = tempTexture;
            AppState.skinMesh.material.needsUpdate = true;
        }
    } else {
        if (AppState.skinMesh && AppState.baseTextureTexture) {
            AppState.skinMesh.material.map = AppState.baseTextureTexture;
            AppState.skinMesh.material.needsUpdate = true;
        }
    }

    renderer.render(scene, camera);
}

// ============================================================================
// PREVIEW GENERATION
// ============================================================================

/**
 * Render a 400×400 snapshot of the current drawing instance for the
 * confirmation modal. Temporarily resizes the renderer, then restores it.
 *
 * @returns {Promise<string>} base-64 PNG data URL
 */
export async function generateDrawingPreview() {
    const cameraUtils      = AppState.cameraUtils;
    const currentInstance   = AppState.drawingInstances[AppState.currentDrawingIndex];

    if (cameraUtils && currentInstance?.drawnRegionNames?.size > 0) {
        await cameraUtils.focusOnDrawing(currentInstance.drawnRegionNames);
    }

    const previewWidth  = 400;
    const previewHeight = 400;
    const originalSize       = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio = renderer.getPixelRatio();

    renderer.setSize(previewWidth, previewHeight, false);
    renderer.setPixelRatio(1);
    renderer.render(scene, camera);
    const preview = renderer.domElement.toDataURL('image/png');

    // Restore original renderer size
    renderer.setSize(originalSize.x, originalSize.y, false);
    renderer.setPixelRatio(originalPixelRatio);
    renderer.render(scene, camera);

    return preview;
}

// ============================================================================
// EMPTY-DRAWING GUARDS
// ============================================================================

/**
 * Check whether the current drawing is blank and, if so, show the
 * "delete empty" modal. Stores the intended action for later execution.
 *
 * @param {'returnToSummary'|'proceedToSurvey'|'returnFromEdit'} actionType
 * @returns {boolean} true if the drawing was blank (modal shown, action deferred)
 */
export function handleEmptyDrawing(actionType) {
    if (!isDrawingBlank()) return false;

    pendingAction = { type: actionType };

    const messages = {
        returnToSummary: 
            "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the home view.",
        proceedToSurvey:
            "You haven't made a drawing yet. Please draw an area before continuing to the questionnaire.",
        returnFromEdit: 
            "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the home view."
    };

    showDeleteEmptyModal(
        messages[actionType] ||
        "You haven't made a drawing yet. If you proceed, this area will be deleted."
    );

    return true;
}

/**
 * Execute the action that was deferred by handleEmptyDrawing().
 * Deletes the blank instance and routes to the appropriate stage.
 */
export function executePendingAction() {
    if (!pendingAction) return;

    const currentIndex = AppState.currentDrawingIndex;
    const action       = pendingAction.type;
    pendingAction      = null;

    // The user may have been in the area survey before editing the drawing
    // and triggering this action. Clear any stale survey instance so the
    // next survey render (area or general) starts fresh.
    clearSurveyInstance();

    switch (action) {
        case 'returnToSummary':
            deleteDrawingInstance(currentIndex);
            goTo('summary');
            break;

        case 'returnFromEdit':
            deleteDrawingInstance(currentIndex);
            // User erased their drawing and confirmed deletion — they want
            // to abandon this area entirely, so always return to summary
            // regardless of how many other areas exist.
            AppState.isEditingFromSurvey = false;
            goTo('summary');
            break;

        case 'proceedToSurvey':
            // Don't delete — this case only shows the warning message
            break;
    }

    renderer.render(scene, camera);
}

/**
 * Discard any deferred action (e.g. when the user dismisses the modal).
 */
export function clearPendingAction() {
    pendingAction = null;
}