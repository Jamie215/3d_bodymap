// drawingInstanceManager.js
// Manages drawing instance lifecycle: creation/deletion, empty-drawing
// guards, texture refresh after deletion, and preview generation.
//
// Dependencies are injected via initInstanceManager() so this module
// has no direct coupling to the stage router or view layer.

import AppState from './state.js';
import { isDrawingBlank, updateInstanceColors } from '../services/drawingEngine.js';
import { createCombinedTexture } from '../services/submissionService.js';
import { showDeleteEmptyModal } from '../components/modal.js';

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
// INSTANCE CRUD
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

    const isLastInstance = AppState.drawingInstances.length === 1;

    const messages = {
        returnToSummary: isLastInstance
            ? "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the home view."
            : "You haven't made a drawing yet. If you proceed, this area will be deleted.",
        proceedToSurvey:
            "You haven't made a drawing yet. Please draw an area before continuing to the questionnaire.",
        returnFromEdit: isLastInstance
            ? "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the home view."
            : "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the survey."
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

    switch (action) {
        case 'returnToSummary':
            deleteDrawingInstance(currentIndex);
            goTo('summary');
            break;

        case 'returnFromEdit':
            deleteDrawingInstance(currentIndex);
            if (AppState.drawingInstances.length === 0) {
                AppState.isEditingFromSurvey = false;
                goTo('summary');
            } else {
                if (AppState.currentSurveyIndex >= AppState.drawingInstances.length) {
                    AppState.currentSurveyIndex = AppState.drawingInstances.length - 1;
                }
                AppState.currentDrawingIndex = AppState.currentSurveyIndex;
                AppState.isEditingFromSurvey = false;
                goTo('area-survey');
            }
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