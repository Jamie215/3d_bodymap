// appController.js - Updated for new workflow
// Workflow: Summary → Draw ONE area → Area Survey → Summary (repeat or proceed) → General Survey → Summary (done)

import { loadModel, cleanupAllModels } from '../services/modelLoader.js';
import { setVisibleRegions } from '../utils/regionVisibility.js';
import { isDrawingBlank, updateCurrentDrawing, addNewDrawingInstance, buildGlobalUVMap, initializeRegionMappings, updateInstanceColors } from '../services/drawingEngine.js';
import texturePool from '../utils/textureManager.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, disableCursorManagement, syncEraserState } from '../utils/interaction.js';
import { getModalElements, showMoveToSurveyModal, hideDrawContinueModal, showDeleteEmptyModal, hideDeleteEmptyModal, showDeleteAreaModal } from '../components/modal.js';
import {
  initSurveyManager,
  renderAreaSurvey,
  renderGeneralSurvey,
  validateAndScrollToErrors,
  saveCurrentSurveyData,
  isGeneralSurvey,
  getCurrentSurveyData,
  clearSurveyInstance
} from '../services/surveyManager.js';
import {
  initSubmissionService,
  createCombinedTexture,
  prepareSubmissionData
} from '../services/submissionService.js';
import AppState from './state.js';
import eventManager from './eventManager.js';
import CameraUtils from '../utils/cameraUtils.js';
import coverageCalculator from '../utils/coverageUtils.js';

export function initApp({ scene, camera, renderer, controls, views, registerModelSelectionHandler, setStage }) {
  const { summary, selection, drawing, survey } = views;
  
  // Get modal elements - now includes returnToSummaryButton
  const { continueButton: modalContinueButton, returnButton: modalReturnButton, returnToSummaryButton: modalReturnToSummaryButton } = getModalElements("continue");
  const { deleteEmptyReturnButton, deleteEmptyContinueButton } = getModalElements("deleteEmpty");
  
  let cameraUtils = null;
  let regionDropdownListener = null;
  let pendingAction = null;

  // Wire up service modules with their dependencies
  initSurveyManager({ surveyView: survey, renderer, scene, camera });
  initSubmissionService({ renderer, scene, camera, controls });

  const handleModelSelection = async(model) => {
    summary.addNewInstanceButton.disabled = true;
    selection.addNewInstanceButton.disabled = true;

    await loadModel(model.file, model.name, scene, controls);

    if (AppState.skinMesh && !cameraUtils) {
      cameraUtils = new CameraUtils(camera, controls, AppState.skinMesh);
      AppState.cameraUtils = cameraUtils;
    }
    
    await initializeRegionMappings();

    // Build the camera regionMap from loaded vertex group names
    cameraUtils.initRegionMap(Object.values(AppState.idToRegionMap));

    const { globalUVMap, globalPixelRegionMap, faceRegionMap } = buildGlobalUVMap(
        AppState.skinMesh.geometry,
        texturePool.width,
        texturePool.height
    );
    AppState.globalUVMap = globalUVMap;
    AppState.globalPixelRegionMap = globalPixelRegionMap;
    AppState.faceRegionMap = faceRegionMap;

    coverageCalculator.initialize(AppState.skinMesh);

    summary.addNewInstanceButton.disabled = false;
    selection.addNewInstanceButton.disabled = false;
    renderer.render(scene, camera);
  };

  registerModelSelectionHandler(handleModelSelection);
  const initialModel = { name: 'Type 1', file: './assets/female.glb' };
  handleModelSelection(initialModel);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  function deleteDrawingInstance(index) {
    if (index < 0 || index >= AppState.drawingInstances.length) return;

    const deletedInstance = AppState.drawingInstances.splice(index, 1)[0];
    if (deletedInstance.texture) {
      deletedInstance.texture.dispose();
    }
    
    AppState.drawingInstances.forEach((instance, idx) => {
      instance.id = `drawing-${idx + 1}`;
    });

    updateInstanceColors();

    if (AppState.drawingInstances.length === 0) {
      AppState.currentDrawingIndex = 0;
      AppState.currentSurveyIndex = 0;
    } else if (index >= AppState.drawingInstances.length) {
      AppState.currentDrawingIndex = AppState.drawingInstances.length - 1;
      if (AppState.currentSurveyIndex >= AppState.drawingInstances.length) {
        AppState.currentSurveyIndex = AppState.drawingInstances.length - 1;
      }
    } else {
      AppState.currentDrawingIndex = index;
      if (AppState.currentSurveyIndex > index) {
        AppState.currentSurveyIndex--;
      } else if (AppState.currentSurveyIndex === index && AppState.currentSurveyIndex >= AppState.drawingInstances.length) {
        AppState.currentSurveyIndex = AppState.drawingInstances.length - 1;
      }
    }
  }

  /**
   * Helper: update the 3D model texture after an area is deleted.
   * Shows the combined remaining drawings, or falls back to the base texture.
   */
  function refreshTextureAfterDelete() {
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

  // After drawing, go directly to area specific survey
  function proceedToAreaSurvey() {
    updateCurrentDrawing();
    
    // Set survey index to current drawing
    AppState.currentSurveyIndex = AppState.currentDrawingIndex;
    
    cleanupInteraction();
    disableCursorManagement();
    goTo('area-survey');
  }

  function handleEmptyDrawing(actionType, actionData = {}) {
    if (!isDrawingBlank()) return false;
    
    pendingAction = { type: actionType, ...actionData };

    const isLastInstance = AppState.drawingInstances.length === 1;
    
    const messages = {
      returnToSummary: isLastInstance 
        ? "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the home view."
        : "You haven't made a drawing yet. If you proceed, this area will be deleted.",
      proceedToSurvey: "You haven't made a drawing yet. Please draw an area before continuing to the questionnaire.",
      returnFromEdit: isLastInstance
        ? "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the home view."
        : "You haven't made a drawing yet. If you proceed, this area will be deleted and you will return to the survey."
    };
    
    showDeleteEmptyModal(messages[actionType] || "You haven't made a drawing yet. If you proceed, this area will be deleted.");
    return true;
  }

  function executePendingAction() {
    if (!pendingAction) return;

    const currentIndex = AppState.currentDrawingIndex;
    const action = pendingAction.type;
    pendingAction = null;

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
          // Return to survey for previous area if available
          if (AppState.currentSurveyIndex >= AppState.drawingInstances.length) {
            AppState.currentSurveyIndex = AppState.drawingInstances.length - 1;
          }
          AppState.currentDrawingIndex = AppState.currentSurveyIndex;
          AppState.isEditingFromSurvey = false;
          goTo('area-survey');
        }
        break;
        
      case 'proceedToSurvey':
        // Don't delete, just show message - this case shouldn't delete
        break;
    }
    
    renderer.render(scene, camera);
  }

  // Generate preview image of current drawing
  async function generateDrawingPreview() {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];

    if (cameraUtils && currentInstance?.drawnRegionNames?.size > 0) {
      await cameraUtils.focusOnDrawing(currentInstance.drawnRegionNames);
    }

    const previewWidth = 400;
    const previewHeight = 400;
    const originalSize = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio = renderer.getPixelRatio();

    renderer.setSize(previewWidth, previewHeight, false);
    renderer.setPixelRatio(1);
    renderer.render(scene, camera);
    const preview = renderer.domElement.toDataURL('image/png');

    // Return to original renderer size
    renderer.setSize(originalSize.x, originalSize.y, false);
    renderer.setPixelRatio(originalPixelRatio);
    renderer.render(scene, camera);

    return preview;
  }

  // ============================================================================
  // STAGE ROUTING
  // ============================================================================

  function goTo(stage) {
    setStage(stage);

    if (stage !== 'drawing' && regionDropdownListener) {
      const dropdown = document.querySelector('.region-dropdown');
      if (dropdown) {
        dropdown.removeEventListener('change', regionDropdownListener);
        regionDropdownListener = null;
      }
    }

    if (stage !== 'drawing') {
      cleanupInteraction();
      disableCursorManagement();
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
    }

    if (stage !== 'area-survey' && survey.editDrawingButton) {
      survey.editDrawingButton.style.display = 'none';
    }

    switch (stage) {
      case 'summary': {
        if (cameraUtils) cameraUtils.resetView();
        setVisibleRegions(null, null);

        // Check if session is completed (general questionnaire submitted)
        const isSessionComplete = AppState.generalQuestionnaireResponse !== null;
        
        if (isSessionComplete && AppState.drawingInstances.length > 0) {
          // Session completed - show combined texture, hide controls
          const combinedCanvas = createCombinedTexture();
          const tempTexture = new THREE.CanvasTexture(combinedCanvas);
          tempTexture.needsUpdate = true;

          if (AppState.skinMesh) {
            AppState.skinMesh.material.map = tempTexture;
            AppState.skinMesh.material.needsUpdate = true;
          }
          summary.summaryFooter.style.display = 'none';
          summary.changeModelButton.style.display = 'none';
          summary.addNewInstanceButton.style.display = 'none';
        } else if (AppState.drawingInstances.length > 0) {
          // Areas logged but not yet submitted - show combined texture
          const combinedCanvas = createCombinedTexture();
          const tempTexture = new THREE.CanvasTexture(combinedCanvas);
          tempTexture.needsUpdate = true;

          if (AppState.skinMesh) {
            AppState.skinMesh.material.map = tempTexture;
            AppState.skinMesh.material.needsUpdate = true;
          }
          
          // Show controls for adding more or proceeding
          summary.summaryFooter.style.display = 'flex';
          summary.changeModelButton.style.display = 'inline-flex';
          summary.addNewInstanceButton.style.display = 'inline-flex';
        } else {
          // No drawings yet - show base texture
          const canvasPanel = document.getElementById('canvas-panel');
          if (canvasPanel && canvasPanel.contains(survey.editDrawingButton)) {
            canvasPanel.removeChild(survey.editDrawingButton);
          }

          if (AppState.skinMesh && AppState.baseTextureTexture) {
            AppState.skinMesh.material.map = AppState.baseTextureTexture;
            AppState.skinMesh.material.needsUpdate = true;
          }
          
          summary.summaryFooter.style.display = 'flex';
          summary.changeModelButton.style.display = 'inline-flex';
          summary.addNewInstanceButton.style.display = 'inline-flex';
        }

        summary.updateSummaryStatus();
        renderer.render(scene, camera);
        break;
      }
      
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

          AppState.skinMesh.material.map = currentInstance.texture;
          AppState.skinMesh.material.needsUpdate = true;
          currentInstance.texture.needsUpdate = true;

          renderer.render(scene, camera);
        }
        
        updateDrawingNavigationButtons();
        views.drawing.updateStatusBar();

        setTimeout(() => {
          const regionDropdown = document.querySelector('.region-dropdown');
          if (regionDropdown && !regionDropdownListener) {
            regionDropdownListener = (e) => {
              if (cameraUtils) cameraUtils.focusOnRegion(e.target.value);
            };
            regionDropdown.addEventListener('change', regionDropdownListener);
          }
        }, 100);

        break;
      }

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

      case 'general-survey': {
        if (cameraUtils) cameraUtils.resetView();

        const combinedCanvas = createCombinedTexture();
        const tempTexture = new THREE.CanvasTexture(combinedCanvas);
        tempTexture.needsUpdate = true;

        if (AppState.skinMesh) {
          AppState.skinMesh.material.map = tempTexture;
          AppState.skinMesh.material.needsUpdate = true;
        }

        survey.updateTitle('general');
        renderGeneralSurvey(survey.surveyInnerContainer);
        break;
      }
    }

    renderer.render(scene, camera);
  }

  // ============================================================================
  // SUMMARY VIEW HANDLERS
  // ============================================================================
  
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
    
    // Check all areas have completed questionnaires
    const incompleteAreas = AppState.drawingInstances.filter(
      instance => !instance.questionnaireData || Object.keys(instance.questionnaireData).length === 0
    );
    
    if (incompleteAreas.length > 0) {
      alert(`Please complete the questionnaire for all areas before proceeding. ${incompleteAreas.length} area(s) remaining.`);
      return;
    }
    
    goTo('general-survey');
  });

  // Edit callback - allows user to edit an existing area's drawing or questionnaire
  summary.setEditCallback((index) => {
    AppState.currentDrawingIndex = index;
    AppState.currentSurveyIndex = index;
    goTo('area-survey');
  });

  // Delete callback — uses a proper modal instead of window.confirm()
  summary.setDeleteCallback((index) => {
    const areaNum = index + 1;
    showDeleteAreaModal(
      `Are you sure you want to delete Area #${areaNum}?\nThis will remove both the drawing and questionnaire responses.`,
      () => {
        deleteDrawingInstance(index);
        summary.updateSummaryStatus();
        refreshTextureAfterDelete();
      }
    );
  });

  // ============================================================================
  // SELECTION VIEW HANDLERS
  // ============================================================================
  
  selection.returnSummaryButton.addEventListener('click', () => goTo('summary'));
  
  selection.addNewInstanceButton.addEventListener('click', () => {
    AppState.isEditingFromSurvey = false;
    addNewDrawingInstance();
    goTo('drawing');
  });

  // ============================================================================
  // DRAWING NAVIGATION
  // ============================================================================

  function updateDrawingNavigationButtons() {
    if (AppState.isEditingFromSurvey) {
      // Editing from survey - show only "Done Editing" button
      drawing.continueButton.textContent = 'Done Editing';
      drawing.continueButton.classList.add("button-drawing-center");
      drawing.continueButton.classList.remove('button-success');
      drawing.continueButton.classList.add('button-primary');
    } else {
      // Normal drawing mode - show "Done Drawing" button
      drawing.continueButton.textContent = 'Done Drawing';
      drawing.continueButton.classList.remove('button-success');
      drawing.continueButton.classList.add('button-primary');
      drawing.continueButton.classList.add("button-drawing-center");
    }
  }

  // "Done Drawing" button logic - shows confirmation modal with 3 options
  drawing.continueButton.addEventListener('click', async () => {
    if (AppState.isEditingFromSurvey) {
      // Editing from survey - return to survey
      if (isDrawingBlank()) {
        if (handleEmptyDrawing('returnFromEdit')) return;
      }
      updateCurrentDrawing();
      AppState.isEditingFromSurvey = false;
      AppState.currentDrawingIndex = AppState.currentSurveyIndex;
      cleanupInteraction();
      disableCursorManagement();
      goTo('area-survey');
      return;
    }

    // Normal drawing mode - generate preview and show confirmation modal
    const hasDrawing = !isDrawingBlank();
    const previewDataURL = await generateDrawingPreview();

    if (hasDrawing) {
      showMoveToSurveyModal(
        'Does this represent your intended pain/symptom area?',
        true,
        previewDataURL,
        true
      );
    } else {
      showMoveToSurveyModal(
        'There is no drawing to proceed with.',
        false,
        previewDataURL,
        true
      );
    }
  });

  // ============================================================================
  // CONFIRMATION MODAL HANDLERS (3 buttons)
  // ============================================================================

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

  // ============================================================================
  // DELETE EMPTY MODAL HANDLERS
  // ============================================================================

  deleteEmptyReturnButton.addEventListener('click', () => {
    hideDeleteEmptyModal();
    pendingAction = null;
  });

  deleteEmptyContinueButton.addEventListener('click', () => {
    hideDeleteEmptyModal();
    executePendingAction();
  });

  // ============================================================================
  // SURVEY EVENT HANDLERS
  // ============================================================================

  // Edit drawing button — persist partial answers, then switch to drawing
  survey.editDrawingButton.addEventListener('click', () => {
    saveCurrentSurveyData();

    AppState.isEditingFromSurvey = true;
    AppState.currentDrawingIndex = AppState.currentSurveyIndex;

    goTo('drawing');
  });

  // Complete / Done button — validate, then route based on survey type
  survey.completeButton.addEventListener('click', async () => {
    if (!validateAndScrollToErrors()) return;

    // --- General questionnaire submission ---
    if (isGeneralSurvey()) {
      AppState.generalQuestionnaireResponse = getCurrentSurveyData();

      const submissionData = await prepareSubmissionData();
      console.log('Submitting all data to Firebase...', submissionData);

      survey.completeButton.disabled = true;
      survey.completeButton.textContent = 'Submitting...';

      // TODO: Replace this line with real API call
      // const docId = await window.firebaseService.saveSubmission(submissionData);
      const docId = true;

      survey.completeButton.disabled = false;
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

    // --- Area questionnaire — save and return to summary ---
    if (saveCurrentSurveyData()) {
      clearSurveyInstance();
      goTo('summary');
    }
  });

  // Initialize the view
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