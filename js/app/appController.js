// appController.js - Updated for new workflow
// Workflow: Summary → Draw ONE area → Area Survey → Summary (repeat or proceed) → General Survey → Summary (done)

import { loadModel, cleanupAllModels } from '../services/modelLoader.js';
import { setVisibleRegions } from '../utils/regionVisibility.js';
import { isDrawingBlank, updateCurrentDrawing, addNewDrawingInstance, buildGlobalUVMap, initializeRegionMappings, updateInstanceColors } from '../services/drawingEngine.js';
import texturePool from '../utils/textureManager.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, disableCursorManagement, syncEraserState } from '../utils/interaction.js';
import { applyCustomTheme, customTheme } from '../utils/surveyTheme.js';
import { areaSurveyJson } from '../utils/areaSurvey.js';
import { generalSurveyJson } from '../utils/generalSurvey.js';
import { getModalElements, showMoveToSurveyModal, hideDrawContinueModal, showDeleteEmptyModal, hideDeleteEmptyModal } from '../components/modal.js';
import SurveyKO from "https://cdn.skypack.dev/survey-knockout";
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
  let surveyInstance = null;
  let pendingAction = null;

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
        renderSurvey(survey.surveyInnerContainer);
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
  // DRAWING NAVIGATION - UPDATED FOR NEW WORKFLOW
  // ============================================================================

  function updateDrawingNavigationButtons() {
    const current = AppState.currentDrawingIndex + 1;

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
      // Has drawing - show modal with all 3 buttons
      showMoveToSurveyModal(
        'Does this represent your intended pain/symptom area?',
        true,           // canProceed = true (show "Yes, Proceed" button)
        previewDataURL, // Show the drawing preview
        true            // showReturnToSummary = true
      );
    } else {
      // No drawing - show modal without "Yes, Proceed" button
      showMoveToSurveyModal(
        'There is no drawing to proceed with.',
        false,          // canProceed = false (hide "Yes, Proceed" button)
        previewDataURL, // Still show the (blank) preview
        true            // showReturnToSummary = true
      );
    }
  });

  // ============================================================================
  // CONFIRMATION MODAL HANDLERS (3 buttons)
  // ============================================================================

  // "Return to Summary" - delete current drawing and go to summary
  modalReturnToSummaryButton.addEventListener('click', () => {
    hideDrawContinueModal();
    deleteDrawingInstance(AppState.currentDrawingIndex);
    cleanupInteraction();
    disableCursorManagement();
    goTo('summary');
  });

  // "Return to My Drawing" - just close the modal
  modalReturnButton.addEventListener('click', () => {
    hideDrawContinueModal();
    // User continues drawing
  });

  // "Yes, Proceed" - save drawing and go to area survey
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
  // SURVEY MANAGEMENT - UPDATED FOR NEW WORKFLOW
  // ============================================================================

  function countMainAreas() {
    return AppState.drawingInstances.filter(instance => instance.questionnaireData?.mainArea === "Yes").length;
  }
  
  function renderSurvey(container) {
    applyCustomTheme(customTheme);

    container.classList.remove('survey-animated');
    container.style.opacity = '0';
    container.style.transform = 'translateX(50px)';

    if (!surveyInstance) {
      surveyInstance = new SurveyKO.Model(areaSurveyJson);
      surveyInstance.showTitle = false;
      surveyInstance.validationEnabled = false;

      surveyInstance.onValidateQuestion.add(function(survey, options) {
        if (options.value !== undefined && options.value !== null && options.value !== '') {
          options.error = null;
        }
      });

      surveyInstance.onValueChanged.add(function(survey, options) {
        updateSurveyProgress();
        if (options.name === 'mainArea') {
          updateMainAreaQuestion();
        }
      });

      surveyInstance.onAfterRenderSurvey.add(function(survey, options) {
        setTimeout(() => {
            container.classList.add('survey-animated');
        }, 50);
      });

      // Modifying style for rating scale
      surveyInstance.onAfterRenderQuestion.add(function (survey, options) {
        if (options.question.name !== "intensityScale") return;
        const questionEl = options.htmlElement;
        const ratingContent = questionEl.querySelector(".sd-question__content");
        if (!ratingContent) return;
        const ratingRow = ratingContent.querySelector(".sd-rating");
        if (!ratingRow) return;
        
        const layoutRow = document.createElement("div");
        layoutRow.classList.add('rating-layout-row');
        const minLabel = document.createElement("div");
        minLabel.innerHTML = "No pain<br>or symptom";
        minLabel.classList.add('rating-layout-label');
        const maxLabel = document.createElement("div");
        maxLabel.innerHTML = "Worst pain<br>or symptom<br>imaginable";
        maxLabel.classList.add('rating-layout-label');
        ratingContent.removeChild(ratingRow);
        layoutRow.appendChild(minLabel);
        layoutRow.appendChild(ratingRow);
        layoutRow.appendChild(maxLabel);
        ratingContent.appendChild(layoutRow);
      });
    }

    const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
    const currentAreaNum = AppState.currentSurveyIndex + 1;
    surveyInstance.title = `Area #${currentAreaNum} Questionnaire`;
    
    if (currentInstance.questionnaireData) {
      surveyInstance.data = currentInstance.questionnaireData;
      surveyInstance.clearIncorrectValues();
      
      surveyInstance.getAllQuestions().forEach(question => {
        if (question.value !== undefined && question.value !== null && question.value !== '') {
          question.clearErrors();
        }
      });
      surveyInstance.validationEnabled = false;
    } else {
      surveyInstance.clear();
      surveyInstance.validationEnabled = false;
    }

    updateMainAreaQuestion();

    if (AppState.skinMesh && currentInstance) {
      AppState.skinMesh.material.map = currentInstance.texture;
      AppState.skinMesh.material.needsUpdate = true;
      currentInstance.texture.needsUpdate = true;
    }

    survey.updateTitle();
    updateSurveyNavigationButtons();
    updateSurveyProgress();

    container.innerHTML = '';
    surveyInstance.render(container);

    renderer.render(scene, camera);
  }

  function updateSurveyNavigationButtons() {
    // In new workflow, we only show "Done" button to return to summary
    survey.completeButton.textContent = 'Done';
    survey.completeButton.style.background = '';
    survey.completeButton.classList.add('button-success');
  }

  function updateSurveyProgress() {
    if (!surveyInstance) return;
    
    const allQuestions = surveyInstance.getAllQuestions();
    const visibleQuestions = allQuestions.filter(q => q.isVisible);
    const totalQuestions = visibleQuestions.length;
    
    let completedQuestions = 0;
    visibleQuestions.forEach(question => {
      const value = question.value;
      
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            completedQuestions++;
          }
        } else {
          completedQuestions++;
        }
      }
    });
    
    survey.updateProgress(completedQuestions, totalQuestions);
  }

  function updateMainAreaQuestion() {
    if (!surveyInstance) return;

    const mainAreaQuestion = surveyInstance.getQuestionByName('mainArea');
    if (!mainAreaQuestion) return;
    
    const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
    const currentMainAreaValue = currentInstance.questionnaireData?.mainArea;
    
    let mainAreaCount = countMainAreas();
    if (currentMainAreaValue === "Yes") {
      mainAreaCount--;
    }

    const remainingSlots = 3 - mainAreaCount;
  
    surveyInstance.setVariable("remainingMainAreaSlots", remainingSlots);
    surveyInstance.setVariable("isCurrentlyMainArea", currentMainAreaValue === "Yes");
    
    if (remainingSlots <= 0) {
      mainAreaQuestion.title = "Is this your main area of pain or symptom? (Maximum 3 main areas reached)";
      mainAreaQuestion.value = "No";
    } else if (remainingSlots === 3) {
      mainAreaQuestion.title = "Is this your main area of pain or symptom? (You can indicate up to 3 main areas)";
    } else {
      mainAreaQuestion.title = `Is this your main area of pain or symptom? (${remainingSlots} main area${remainingSlots === 1 ? '' : 's'} remaining)`;
    }
  }

  function saveCurrentSurveyData() {
    if(!surveyInstance) return false;

    surveyInstance.validationEnabled = true;
    const hasErrors = surveyInstance.hasErrors();
    
    if (!hasErrors) {
      const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
      const canvas = currentInstance.canvas;

      currentInstance.questionnaireData = { ...surveyInstance.data };
      currentInstance.uvDrawingData = canvas.toDataURL('image/png');
      
      surveyInstance.validationEnabled = false;
      return true;
    }
    
    surveyInstance.validate();
    return false;
  }

  // Edit drawing button handler
  survey.editDrawingButton.addEventListener('click', () => {
    saveCurrentSurveyData();

    AppState.isEditingFromSurvey = true;
    AppState.currentDrawingIndex = AppState.currentSurveyIndex;

    goTo('drawing');
  });

  // Returns to summary after completing area questionnaire
  survey.completeButton.addEventListener('click', async () => {
    if (!surveyInstance) return;
    
    surveyInstance.validationEnabled = true;
    surveyInstance.validate();
          
    const hasErrors = surveyInstance.hasErrors();      
    if (hasErrors) {
      // Scroll to first question with error
      setTimeout(() => {
        const questions = surveyInstance.getAllQuestions();
        const firstQuestionWithError = questions.find(q => q.errors && q.errors.length > 0);
                  
        if (firstQuestionWithError) {
          const questionElement = document.getElementById(firstQuestionWithError.id);            
          if (questionElement) {
            questionElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            
            const firstInput = questionElement.querySelector('input:not(.sd-visuallyhidden), textarea, select');
            if (firstInput) {
              setTimeout(() => firstInput.focus(), 400);
            }
          }
        }
      }, 100);
      
      return;
    }

    // Check if this is the general survey being submitted
    if ("medicationTable" in surveyInstance.data) {
      AppState.generalQuestionnaireResponse = { ...surveyInstance.data };

      // Prepare complete submission data
      const submissionData = await prepareSubmissionData();
      console.log('Submitting all data to Firebase...', submissionData);

      // Show loading indicator
      survey.completeButton.disabled = true;
      survey.completeButton.textContent = 'Submitting...';

      // Save to Firebase
      const docId = await window.firebaseService.saveSubmission(submissionData);

      // Re-enable button
      survey.completeButton.disabled = false;
      survey.completeButton.textContent = 'Complete';
      
      if (docId) {
        console.log('All data submitted successfully!');
        surveyInstance = null;
        goTo('summary');
      } else {
        console.error('Failed to submit data');
        alert('There was an error submitting your data. Please try again.');
      }
      return;
    }

    // Area survey completed - save and return to summary
    if (saveCurrentSurveyData()) {
      surveyInstance = null; // Clear survey instance
      goTo('summary');
    }
  });

  function renderGeneralSurvey(container) {
    applyCustomTheme(customTheme);
    container.classList.remove('survey-animated');
    container.style.opacity = '0';
    container.style.transform = 'translateX(50px)';
    
    if (!surveyInstance) {
      surveyInstance = new SurveyKO.Model(generalSurveyJson);
      surveyInstance.showTitle = false;
      surveyInstance.validationEnabled = false;

      surveyInstance.onValidateQuestion.add(function(survey, options) {
        if (options.question.getType() === 'matrix') {
          const medicationQuestion = survey.getQuestionByName('medicationTable');
          const allRows = medicationQuestion.rows.map(r => r.value);
          
          let missingRows = [];
          for (let row of allRows) {
            if (!options.value || !options.value[row]) {
              missingRows.push(row);
            }
          }
                  
          if (missingRows.length > 0) {
            options.error = `Please answer all rows in the medication table. Missing: ${missingRows.join(', ')}`;
            return;
          }
        }
        if (options.value !== undefined && options.value !== null && options.value !== '') {
          options.error = null;
        }
      });

      surveyInstance.onValueChanged.add(function(survey, options) {
        updateSurveyProgress();
      });

      surveyInstance.onAfterRenderSurvey.add(function(survey, options) {
        setTimeout(() => {
            container.classList.add('survey-animated');
        }, 50);
      });

      // Adding subtext for examples in medicationTable
      surveyInstance.onAfterRenderQuestion.add(function(survey, options) {
        if (options.question.name === 'medicationTable' && options.question.getType() === 'matrix') {
          const descriptions = {
            'over-the-counter': 'e.g.,: Advil (ibuprofen), Aleve (naproxen), Aspirin (ASA), Motrin (ibuprofen), Tylenol (acetaminophen)',
            'non-steroidal-anti-inflammatory': 'e.g.,: Arthrotec, Celecoxib, Celebrex, Voltaren',
            'muscle-relaxant': 'e.g.,: Flexeril, Robaxacet, Robaxin',
            'narcotic-pain-medication': 'e.g.,: Demerol, MS Contin, Morphine, Oxycontin, Percocet, Talwin, Tylenol 3',
            'anti-depressant': 'e.g.,: Celexa, Cipralex, Cymbalta, Elavil, Paxil, Prozac, Wellbutrin, Zoloft',
            'neuroleptics': 'e.g.,: Lyrica, Neurontin, Gabapentin, Rivotril, Tegretol',
            'cannabis': 'e.g.,: Smoked, Inhaled, Edible, Oil, Cream'
          };

          setTimeout(() => {
            const tbody = options.htmlElement.querySelector('tbody');
            if (!tbody) return;
            
            const rows = tbody.querySelectorAll('tr.sd-table__row');
            
            options.question.visibleRows.forEach((questionRow, index) => {
              const fullName = questionRow.fullName;            
              const rowValue = fullName ? fullName.split('_').pop() : null;
              const domRow = rows[index];
                          
              if (rowValue && descriptions[rowValue] && domRow) {
                const textCell = domRow.querySelector('td.sd-table__cell--row-text');
                
                if (textCell && !textCell.querySelector('.medication-description')) {                
                  const desc = document.createElement('div');
                  desc.className = 'medication-description';
                  desc.textContent = descriptions[rowValue];
                  textCell.appendChild(desc);
                } 
              }
            });
          }, 100);
        }
      });
    }

    survey.editDrawingButton.style.display = 'none';

    container.innerHTML = '';
    surveyInstance.render(container);
    updateSurveyProgress();
    renderer.render(scene, camera);
  }

  // Helper function to prepare all submission data
  async function prepareSubmissionData() {
    const combinedCanvas = createCombinedTexture();
    const tempTexture = new THREE.CanvasTexture(combinedCanvas);
    tempTexture.needsUpdate = true;

    if (AppState.skinMesh) {
      AppState.skinMesh.material.map = tempTexture;
      AppState.skinMesh.material.needsUpdate = true;
    }

    const previewWidth = 400;
    const previewHeight = 400;
    const originalSize = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio = renderer.getPixelRatio();

    renderer.setSize(previewWidth, previewHeight, false);
    renderer.setPixelRatio(1);
    renderer.render(scene, camera);
    const snapshot = renderer.domElement.toDataURL('image/png');

    renderer.setSize(originalSize.x, originalSize.y, false);
    renderer.setPixelRatio(originalPixelRatio);

    if (AppState.skinMesh) {
      const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
      AppState.skinMesh.material.map = currentInstance.texture;
      AppState.skinMesh.material.needsUpdate = true;
    }

    renderer.render(scene, camera);

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