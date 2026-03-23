// appController.js - Updated for new workflow
// Workflow: Summary → Draw ONE area → Area Survey → Summary (repeat or proceed) → General Survey → Summary (done)

import { loadModel, cleanupAllModels } from '../services/modelLoader.js';
import { setVisibleRegions } from '../utils/regionVisibility.js';
import { isDrawingBlank, updateCurrentDrawing, addNewDrawingInstance, buildGlobalUVMap, initializeRegionMappings, updateInstanceColors } from '../services/drawingEngine.js';
import texturePool from '../utils/textureManager.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, disableCursorManagement, syncEraserState } from '../utils/interaction.js';
import { getModalElements, showMoveToSurveyModal, hideDrawContinueModal, showDeleteEmptyModal, hideDeleteEmptyModal } from '../components/modal.js';
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

  // Wire up survey manager with its dependencies
  initSurveyManager({ surveyView: survey, renderer, scene, camera });

  const handleModelSelection = async(model) => {
    summary.addNewInstanceButton.disabled = true;
    selection.addNewInstanceButton.disabled = true;

    await loadModel(model.file, model.name, scene, controls);

    if (AppState.skinMesh && !cameraUtils) {
      cameraUtils = new CameraUtils(camera, controls, AppState.skinMesh);
      AppState.cameraUtils = cameraUtils;
    }
    
    await initializeRegionMappings();

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
  
  function createCombinedTexture() {
    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = texturePool.width;
    combinedCanvas.height = texturePool.height;
    const ctx = combinedCanvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    AppState.drawingInstances.forEach(instance => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = instance.canvas.width;
      tempCanvas.height = instance.canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCtx.drawImage(instance.canvas, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const pixels = imageData.data;
      
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] === 255 && pixels[i+1] === 255 && pixels[i+2] === 255) {
          pixels[i+3] = 0;
        }
      }

      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
    });

    return combinedCanvas;
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

  // Delete callback - allows user to remove a logged area
  summary.setDeleteCallback((index) => {
    const areaNum = index + 1;
    if (confirm(`Are you sure you want to delete Area #${areaNum}? This will remove both the drawing and questionnaire responses.`)) {
      deleteDrawingInstance(index);
      summary.updateSummaryStatus();
      
      // Update the texture display
      if (AppState.drawingInstances.length > 0) {
        const combinedCanvas = createCombinedTexture();
        const tempTexture = new THREE.CanvasTexture(combinedCanvas);
        tempTexture.needsUpdate = true;

        if (AppState.skinMesh) {
          AppState.skinMesh.material.map = tempTexture;
          AppState.skinMesh.material.needsUpdate = true;
        }
      } else {
        // No more drawings - show base texture
        if (AppState.skinMesh && AppState.baseTextureTexture) {
          AppState.skinMesh.material.map = AppState.baseTextureTexture;
          AppState.skinMesh.material.needsUpdate = true;
        }
      }
      
      renderer.render(scene, camera);
    }
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

      // TODO: Replace this line
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

  // ============================================================================
  // SUBMISSION HELPERS
  // ============================================================================

  // Helper function to capture multi view snapshots
  async function captureMultiViewSnapshots(combinedCanvas) {
    const tempTexture = new THREE.CanvasTexture(combinedCanvas);
    tempTexture.needsUpdate = true;

    const originalMap = AppState.skinMesh.material.map;
    AppState.skinMesh.material.map = tempTexture;
    AppState.skinMesh.material.needsUpdate = true;

    const originalSize = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio = renderer.getPixelRatio();
    const originalCameraPosition = camera.position.clone();
    const originalCameraTarget = controls.target.clone();

    const previewWidth = 400;
    const previewHeight = 400;
    renderer.setSize(previewWidth, previewHeight, false);
    renderer.setPixelRatio(1);

    // Calculate framing distance from model bounds
    const bbox = new THREE.Box3().setFromObject(AppState.skinMesh);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.3;

    const viewAngles = [
      ['front',  new THREE.Vector3(0, 0, dist)],
      ['back',   new THREE.Vector3(0, 0, -dist)],
      ['right',  new THREE.Vector3(dist, 0, 0)],
      ['left',   new THREE.Vector3(-dist, 0, 0)],
    ];

    const snapshots = {};

    for (const [label, offset] of viewAngles) {
      camera.position.copy(center).add(offset);
      camera.position.y = center.y;
      controls.target.copy(center);
      controls.update();
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      snapshots[label] = renderer.domElement.toDataURL('image/png');
    }

    // Restore everything
    camera.position.copy(originalCameraPosition);
    if (originalCameraTarget) controls.target.copy(originalCameraTarget);
    controls.update();
    renderer.setSize(originalSize.x, originalSize.y, false);
    renderer.setPixelRatio(originalPixelRatio);

    AppState.skinMesh.material.map = originalMap;
    AppState.skinMesh.material.needsUpdate = true;
    renderer.render(scene, camera);

    tempTexture.dispose();

    return snapshots;
  }

  // Helper function to prepare all submission data
  async function prepareSubmissionData() {
    const combinedCanvas = createCombinedTexture();
    const snapshot = await captureMultiViewSnapshots(combinedCanvas);

    const areas = AppState.drawingInstances.map((instance, index) => {
      const coverage = coverageCalculator.calculateCoverage(instance);
      
      return {
          areaNumber: index + 1,
          areaId: instance.id,
          drawingImageData: instance.uvDrawingData,
          questionnaireResponses: instance.questionnaireData,
          drawnRegions: Array.from(instance.drawnRegionNames || []),
          coverage: coverage ? {
              overallPercentage: coverage.overall.percentage,
              coloredArea: coverage.overall.coloredArea,
              regionBreakdown: coverage.regions,
              bodyPartBreakdown: coverage.bodyParts
          } : null
      };
    });

    const getDeviceType = () => {
      const ua = navigator.userAgent;
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return "Tablet";
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return "Mobile";
        }
        return "Desktop"; 
    }

    const getOS = () => {
        const ua = navigator.userAgent;
        if (/windows phone/i.test(ua)) return "Windows Phone";
        if (/android/i.test(ua)) return "Android";
        if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "iOS";
        if (/Mac/.test(ua)) return "macOS";
        if (/Win/.test(ua)) return "Windows";
        if (/Linux/.test(ua)) return "Linux";
        return "Unknown";
    };

    const getBrowser = () => {
        const ua = navigator.userAgent;
        if (/Edg/.test(ua)) return "Edge";
        if (/Chrome/.test(ua) && !/Edg/.test(ua)) return "Chrome";
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "Safari";
        if (/Firefox/.test(ua)) return "Firefox";
        if (/MSIE|Trident/.test(ua)) return "Internet Explorer";
        return "Unknown";
    };

    return {
      startTime: window.sessionStartTime || new Date().toISOString(),
      completionTime: new Date().toISOString(),
      durationSeconds: window.sessionStartTime ? 
        Math.round((Date.now() - new Date(window.sessionStartTime).getTime()) / 1000) : null,
      modelType: AppState.currentModelName,
      combinedDrawing: snapshot,
      totalAreas: areas.length,
      areas: areas,
      generalQuestionnaire: AppState.generalQuestionnaireResponse,
      deviceInfo: {
        deviceType: getDeviceType(),
        operatingSystem: getOS(),
        browser: getBrowser(),
        userAgent: navigator.userAgent
      }
    }
  }

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