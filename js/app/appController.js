// appController.js — Thin orchestration layer
//
// Wires user events (button clicks, modal confirmations) to:
//   - stageRouter.goTo()           for stage transitions
//   - drawingInstanceManager.*     for instance CRUD & empty-drawing guards
//   - surveyManager.*              for questionnaire lifecycle
//
// Model loading and the animation loop also live here as they are
// one-time setup concerns that don't belong in either extracted module.

import { loadModel, cleanupAllModels } from '../services/modelLoader.js';
import {
    isDrawingBlank,
    updateCurrentDrawing,
    addNewDrawingInstance,
    buildGlobalUVMap,
    initializeRegionMappings
} from '../services/drawingEngine.js';
import texturePool from '../utils/textureManager.js';
import { cleanupInteraction, disableCursorManagement } from '../utils/interaction.js';
import {
    getModalElements,
    showMoveToSurveyModal,
    hideDrawContinueModal,
    showDeleteAreaModal,
    hideDeleteEmptyModal
} from '../components/modal.js';
import {
    initSurveyManager,
    validateAndScrollToErrors,
    saveCurrentSurveyData,
    isGeneralSurvey,
    getCurrentSurveyData,
    clearSurveyInstance
} from '../services/surveyManager.js';
import { initSubmissionService, prepareSubmissionData } from '../services/submissionService.js';
import AppState from './state.js';
import eventManager from './eventManager.js';
import CameraUtils from '../utils/cameraUtils.js';
import coverageCalculator from '../utils/coverageUtils.js';

// Extracted modules
import { initStageRouter, goTo } from './stageRouter.js';
import {
    initInstanceManager,
    deleteDrawingInstance,
    refreshTextureAfterDelete,
    generateDrawingPreview,
    handleEmptyDrawing,
    executePendingAction,
    clearPendingAction
} from './drawingInstanceManager.js';

export function initApp({ scene, camera, renderer, controls, views, registerModelSelectionHandler, setStage }) {
    const { summary, selection, drawing, survey } = views;

    // Grab modal button references
    const {
        continueButton:       modalContinueButton,
        returnButton:         modalReturnButton,
        returnToSummaryButton: modalReturnToSummaryButton
    } = getModalElements('continue');
    const { deleteEmptyReturnButton, deleteEmptyContinueButton } = getModalElements('deleteEmpty');

    let cameraUtils = null;

    // ====================================================================
    // SERVICE INITIALISATION
    // ====================================================================

    initSurveyManager({ surveyView: survey, renderer, scene, camera });
    initSubmissionService({ renderer, scene, camera, controls });
    initStageRouter({ renderer, scene, camera, controls, views, setStage });
    initInstanceManager({ renderer, scene, camera, goTo });

    // ====================================================================
    // MODEL LOADING
    // ====================================================================

    const handleModelSelection = async (model) => {
        summary.addNewInstanceButton.disabled   = true;
        selection.addNewInstanceButton.disabled  = true;

        await loadModel(model.file, model.name, scene, controls);

        if (AppState.skinMesh && !cameraUtils) {
            cameraUtils = new CameraUtils(camera, controls, AppState.skinMesh);
            AppState.cameraUtils = cameraUtils;
        }

        await initializeRegionMappings();
        cameraUtils.initRegionMap(Object.values(AppState.idToRegionMap));

        const { globalUVMap, globalPixelRegionMap, faceRegionMap } = buildGlobalUVMap(
            AppState.skinMesh.geometry,
            texturePool.width,
            texturePool.height
        );
        AppState.globalUVMap          = globalUVMap;
        AppState.globalPixelRegionMap = globalPixelRegionMap;
        AppState.faceRegionMap        = faceRegionMap;

        coverageCalculator.initialize(AppState.skinMesh);

        summary.addNewInstanceButton.disabled   = false;
        selection.addNewInstanceButton.disabled  = false;
        renderer.render(scene, camera);
    };

    registerModelSelectionHandler(handleModelSelection);
    handleModelSelection({ name: 'Type 1', file: './assets/female.glb' });

    // Animation loop
    (function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    })();

    // ====================================================================
    // HELPERS
    // ====================================================================

    /** After drawing, save the current texture and move to the area survey. */
    function proceedToAreaSurvey() {
        updateCurrentDrawing();
        AppState.currentSurveyIndex = AppState.currentDrawingIndex;
        cleanupInteraction();
        disableCursorManagement();
        goTo('area-survey');
    }

    // ====================================================================
    // SUMMARY VIEW EVENTS
    // ====================================================================

    summary.changeModelButton.addEventListener('click', () => goTo('selection'));

    summary.addNewInstanceButton.addEventListener('click', () => {
        AppState.isEditingFromSurvey = false;
        addNewDrawingInstance();
        goTo('drawing');
    });

    summary.summaryDoneButton.addEventListener('click', () => {
        if (AppState.drawingInstances.length === 0) {
            alert('Please add at least one pain or symptom area before proceeding.');
            return;
        }

        const incompleteAreas = AppState.drawingInstances.filter(
            inst => !inst.questionnaireData || Object.keys(inst.questionnaireData).length === 0
        );
        if (incompleteAreas.length > 0) {
            alert(
                `Please complete the questionnaire for all areas before proceeding. ` +
                `${incompleteAreas.length} area(s) remaining.`
            );
            return;
        }

        goTo('general-survey');
    });

    summary.setEditCallback((index) => {
        AppState.currentDrawingIndex = index;
        AppState.currentSurveyIndex  = index;
        goTo('area-survey');
    });

    summary.setDeleteCallback((index) => {
        const areaNum = index + 1;
        showDeleteAreaModal(
            `Are you sure you want to delete Area #${areaNum}?\n` +
            `This will remove both the drawing and questionnaire responses.`,
            () => {
                deleteDrawingInstance(index);
                summary.updateSummaryStatus();
                refreshTextureAfterDelete();
            }
        );
    });

    // ====================================================================
    // SELECTION VIEW EVENTS
    // ====================================================================

    selection.returnSummaryButton.addEventListener('click', () => goTo('summary'));

    selection.addNewInstanceButton.addEventListener('click', () => {
        AppState.isEditingFromSurvey = false;
        addNewDrawingInstance();
        goTo('drawing');
    });

    // ====================================================================
    // DRAWING VIEW EVENTS
    // ====================================================================

    drawing.continueButton.addEventListener('click', async () => {
        // Editing an existing area — return to its survey
        if (AppState.isEditingFromSurvey) {
            if (isDrawingBlank()) {
                if (handleEmptyDrawing('returnFromEdit')) return;
            }
            updateCurrentDrawing();
            AppState.isEditingFromSurvey  = false;
            AppState.currentDrawingIndex  = AppState.currentSurveyIndex;
            cleanupInteraction();
            disableCursorManagement();
            goTo('area-survey');
            return;
        }

        // New drawing — show confirmation modal with preview
        const hasDrawing     = !isDrawingBlank();
        const previewDataURL = await generateDrawingPreview();

        showMoveToSurveyModal(
            hasDrawing
                ? 'Does this represent your intended pain/symptom area?'
                : 'There is no drawing to proceed with.',
            hasDrawing,
            previewDataURL,
            true
        );
    });

    // ====================================================================
    // CONFIRMATION MODAL EVENTS (Done Drawing modal — 3 buttons)
    // ====================================================================

    modalReturnToSummaryButton.addEventListener('click', () => {
        hideDrawContinueModal();
        deleteDrawingInstance(AppState.currentDrawingIndex);
        cleanupInteraction();
        disableCursorManagement();
        goTo('summary');
    });

    modalReturnButton.addEventListener('click', () => {
        hideDrawContinueModal();
    });

    modalContinueButton.addEventListener('click', () => {
        hideDrawContinueModal();
        proceedToAreaSurvey();
    });

    // ====================================================================
    // DELETE-EMPTY MODAL EVENTS
    // ====================================================================

    deleteEmptyReturnButton.addEventListener('click', () => {
        hideDeleteEmptyModal();
        clearPendingAction();
    });

    deleteEmptyContinueButton.addEventListener('click', () => {
        hideDeleteEmptyModal();
        executePendingAction();
    });

    // ====================================================================
    // SURVEY VIEW EVENTS
    // ====================================================================

    survey.editDrawingButton.addEventListener('click', () => {
        saveCurrentSurveyData();
        AppState.isEditingFromSurvey  = true;
        AppState.currentDrawingIndex  = AppState.currentSurveyIndex;
        goTo('drawing');
    });

    survey.completeButton.addEventListener('click', async () => {
        if (!validateAndScrollToErrors()) return;

        // ── General questionnaire submission ──
        if (isGeneralSurvey()) {
            AppState.generalQuestionnaireResponse = getCurrentSurveyData();

            const submissionData = await prepareSubmissionData();
            console.log('Submitting all data...', submissionData);

            survey.completeButton.disabled  = true;
            survey.completeButton.textContent = 'Submitting...';

            // TODO: Replace with real API call
            const docId = true;

            survey.completeButton.disabled  = false;
            survey.completeButton.textContent = 'Complete';

            if (docId) {
                console.log('All data submitted successfully!');
                clearSurveyInstance();
                goTo('summary');
            } else {
                console.error('Failed to submit data');
                alert('There was an error submitting your data. Please try again.');
            }
            return;
        }

        // ── Area questionnaire — save and return to summary ──
        if (saveCurrentSurveyData()) {
            clearSurveyInstance();
            goTo('summary');
        }
    });

    // ====================================================================
    // STARTUP & CLEANUP
    // ====================================================================

    goTo('summary');

    window.cleanupApplication = () => {
        if (cameraUtils) cameraUtils.dispose();
        cleanupInteraction();
        cleanupAllModels();
        if (renderer) renderer.dispose();
        texturePool.disposeAll();
        eventManager.removeAll();
    };

    window.addEventListener('beforeunload', window.cleanupApplication);
}