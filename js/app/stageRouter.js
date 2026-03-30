// stageRouter.js
// Owns the goTo(stage) function — the single place that orchestrates
// what happens when the application transitions between stages.
//
// Each stage case handles: texture application, camera positioning,
// interaction mode, UI element visibility, and survey rendering.
//
// Dependencies are injected via initStageRouter() at startup.

import * as THREE from 'three';
import AppState from './state.js';
import { setVisibleRegions } from '../utils/regionVisibility.js';
import { enableInteraction, cleanupInteraction, syncEraserState } from '../utils/interaction.js';
import { setupCursorManagement, disableCursorManagement } from '../utils/cursorManager.js';
import { createCombinedTexture } from '../services/submissionService.js';
import { renderAreaSurvey, renderGeneralSurvey } from '../services/surveyManager.js';
import coverageCalculator from '../services/coverageService.js';

// ============================================================================
// MODULE STATE
// ============================================================================

let renderer = null;
let scene    = null;
let camera   = null;
let controls = null;
let views    = null;   // { summary, selection, drawing, survey }
let setStage = null;   // callback from main.js that swaps DOM slots

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
 * @param {OrbitControls}        deps.controls
 * @param {Object}               deps.views    — { summary, selection, drawing, survey }
 * @param {Function}             deps.setStage — DOM slot-swapping callback from main.js
 */
export function initStageRouter(deps) {
    renderer = deps.renderer;
    scene    = deps.scene;
    camera   = deps.camera;
    controls = deps.controls;
    views    = deps.views;
    setStage = deps.setStage;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Configure the "Done Drawing" / "Done Editing" button label and style
 * based on whether the user is editing an existing area or creating a new one.
 */
function updateDrawingNavigationButtons() {
    const { drawing } = views;

    if (AppState.isEditingFromSurvey) {
        drawing.continueButton.textContent = 'Done Editing';
        drawing.continueButton.classList.add('button-drawing-center');
        drawing.continueButton.classList.remove('button-success');
        drawing.continueButton.classList.add('button-primary');
    } else {
        drawing.continueButton.textContent = 'Done Drawing';
        drawing.continueButton.classList.remove('button-success');
        drawing.continueButton.classList.add('button-primary');
        drawing.continueButton.classList.add('button-drawing-center');
    }
}

// ============================================================================
// PUBLIC — STAGE ROUTING
// ============================================================================

/**
 * Transition the application to a new stage.
 *
 * @param {'summary'|'selection'|'drawing'|'area-survey'|'general-survey'} stage
 */
export function goTo(stage) {
    const { summary, drawing, survey } = views;
    const cameraUtils = AppState.cameraUtils;

    // Swap DOM slots via main.js callback
    setStage(stage);

    // ── Shared teardown when leaving the drawing stage ──────────────────
    if (stage !== 'drawing') {
        cleanupInteraction();
        disableCursorManagement();
        controls.enableZoom   = false;
        controls.enablePan    = false;
        controls.enableRotate = false;
    }

    if (stage !== 'area-survey' && survey.editDrawingButton) {
        survey.editDrawingButton.style.display = 'none';
    }

    // ── Per-stage setup ─────────────────────────────────────────────────
    switch (stage) {

        // ----------------------------------------------------------------
        // SUMMARY
        // ----------------------------------------------------------------
        case 'summary': {
            if (cameraUtils) cameraUtils.resetView();
            setVisibleRegions(null, null);

            const isSessionComplete = AppState.generalQuestionnaireResponse !== null;

            if (isSessionComplete && AppState.drawingInstances.length > 0) {
                // Completed session — show combined texture, hide controls
                applyCombinedTexture();
                summary.summaryFooter.style.display       = 'none';
                summary.changeModelButton.style.display    = 'none';
                summary.addNewInstanceButton.style.display = 'none';

            } else if (AppState.drawingInstances.length > 0) {
                // Areas logged but not yet submitted
                applyCombinedTexture();
                summary.summaryFooter.style.display       = 'flex';
                summary.changeModelButton.style.display    = 'inline-flex';
                summary.addNewInstanceButton.style.display = 'inline-flex';

            } else {
                // No drawings yet — show base texture
                const canvasPanel = document.getElementById('canvas-panel');
                if (canvasPanel && canvasPanel.contains(survey.editDrawingButton)) {
                    canvasPanel.removeChild(survey.editDrawingButton);
                }
                if (AppState.skinMesh && AppState.baseTextureTexture) {
                    AppState.skinMesh.material.map         = AppState.baseTextureTexture;
                    AppState.skinMesh.material.needsUpdate  = true;
                }
                summary.summaryFooter.style.display       = 'flex';
                summary.changeModelButton.style.display    = 'inline-flex';
                summary.addNewInstanceButton.style.display = 'inline-flex';
            }

            summary.updateSummaryStatus();
            renderer.render(scene, camera);
            break;
        }

        // ----------------------------------------------------------------
        // DRAWING
        // ----------------------------------------------------------------
        case 'drawing': {
            enableInteraction(renderer, camera, controls);
            setupCursorManagement();
            syncEraserState();
            controls.enableZoom = true;

            if (AppState.skinMesh && AppState.drawingInstances.length > 0) {
                const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
                const ctx = currentInstance.context;

                if (!currentInstance.initialized && !AppState.isEditingFromSurvey) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, currentInstance.canvas.width, currentInstance.canvas.height);
                    if (AppState.baseTextureCanvas) ctx.drawImage(AppState.baseTextureCanvas, 0, 0);
                    currentInstance.initialized = true;
                }

                AppState.skinMesh.material.map        = currentInstance.texture;
                AppState.skinMesh.material.needsUpdate = true;
                currentInstance.texture.needsUpdate     = true;

                renderer.render(scene, camera);
            }

            updateDrawingNavigationButtons();
            drawing.updateStatusBar();

            break;
        }

        // ----------------------------------------------------------------
        // AREA SURVEY
        // ----------------------------------------------------------------
        case 'area-survey': {
            const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
            cameraUtils.focusOnDrawing(currentInstance.drawnRegionNames);
            coverageCalculator.logCoverage(currentInstance);

            const canvasPanel = document.getElementById('canvas-panel');
            if (canvasPanel && !canvasPanel.contains(survey.editDrawingButton)) {
                canvasPanel.appendChild(survey.editDrawingButton);
            }

            survey.editDrawingButton.style.display = 'inline-flex';
            survey.updateTitle();
            renderAreaSurvey(survey.surveyInnerContainer);
            break;
        }

        // ----------------------------------------------------------------
        // GENERAL SURVEY
        // ----------------------------------------------------------------
        case 'general-survey': {
            if (cameraUtils) cameraUtils.resetView();
            applyCombinedTexture();
            survey.updateTitle('general');
            renderGeneralSurvey(survey.surveyInnerContainer);
            break;
        }
    }

    renderer.render(scene, camera);
}

// ============================================================================
// INTERNAL — TEXTURE HELPERS
// ============================================================================

/**
 * Composite all drawing instances onto the model as a single texture.
 * Used by summary and general-survey stages.
 */
function applyCombinedTexture() {
    const combinedCanvas = createCombinedTexture();
    if (!combinedCanvas) {
        console.warn('applyCombinedTexture: compositing failed, falling back to base texture');
        if (AppState.skinMesh && AppState.baseTextureTexture) {
            AppState.skinMesh.material.map        = AppState.baseTextureTexture;
            AppState.skinMesh.material.needsUpdate = true;
        }
        return;
    }

    const tempTexture    = new THREE.CanvasTexture(combinedCanvas);
    tempTexture.needsUpdate = true;

    if (AppState.skinMesh) {
        AppState.skinMesh.material.map        = tempTexture;
        AppState.skinMesh.material.needsUpdate = true;
    }
}