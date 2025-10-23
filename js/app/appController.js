// appController.js
import { loadModel, cleanupAllModels } from '../services/modelLoader.js';
import { isDrawingBlank, updateCurrentDrawing, addNewDrawingInstance, buildGlobalUVMap, initializeRegionMappings, updateInstanceColors } from '../services/drawingEngine.js';
import texturePool from '../utils/textureManager.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, disableCursorManagement } from '../utils/interaction.js';
import { applyCustomTheme, customTheme } from '../utils/surveyTheme.js';
import { areaSurveyJson } from '../utils/areaSurvey.js';
import { generalSurveyJson } from '../utils/generalSurvey.js';
import { getModalElements, showMoveToSurveyModal, hideDrawContinueModal, showDeleteEmptyModal, hideDeleteEmptyModal } from '../components/modal.js';
import SurveyKO from "https://cdn.skypack.dev/survey-knockout";
import AppState from './state.js';
import eventManager from './eventManager.js';
import CameraUtils from '../utils/cameraUtils.js';

export function initApp({ scene, camera, renderer, controls, views, registerModelSelectionHandler, setStage }) {
  const { summary, selection, drawing, survey } = views;
  const { continueButton: modalContinueButton, returnButton: modalReturnButton } = getModalElements("continue");
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

    summary.addNewInstanceButton.disabled = false;
    selection.addNewInstanceButton.disabled = false;
    renderer.render(scene, camera);
  };

  registerModelSelectionHandler(handleModelSelection);
  const initialModel = { name: 'Type 2', file: './assets/male_young_avgheight.glb' };
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

  function hasAnyValidDrawings() {
    if (AppState.drawingInstances.length === 0) return false;
    
    const originalIndex = AppState.currentDrawingIndex;
    
    const hasValid = AppState.drawingInstances.some((instance, idx) => {
      AppState.currentDrawingIndex = idx;
      const blank = isDrawingBlank();
      return !blank;
    });
    
    AppState.currentDrawingIndex = originalIndex;
    return hasValid;
  }

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

  function navigateToDrawing(index) {
    if (index < 0 || index >= AppState.drawingInstances.length) return;

    updateCurrentDrawing();
    AppState.currentDrawingIndex = index;
    updateDrawingNavigationButtons();
    drawing.updateStatusBar();

    const currentInstance = AppState.drawingInstances[index];
    if (AppState.skinMesh && currentInstance) {
      AppState.skinMesh.material.map = currentInstance.texture;
      AppState.skinMesh.material.needsUpdate = true;
      currentInstance.texture.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  function handleEmptyDrawing(actionType, actionData = {}) {
    if (!isDrawingBlank()) return false;
    
    pendingAction = { type: actionType, ...actionData };

    const isLastInstance = AppState.drawingInstances.length === 1;
    
    const messages = {
      navigatePrev: 'This drawing area is empty. If you proceed, this area will be deleted and you will navigate to the previous area.',
      navigateNext: 'This drawing area is empty. If you proceed, this area will be deleted and you will navigate to the next area.',
      addNew: 'This drawing area is empty. Please draw before adding new area.',
      returnToSurvey: isLastInstance? 'This drawing area is empty. If you proceed, this area will be deleted and you will return to the summary view.':'This drawing area is empty. If you proceed, this area will be deleted and you will return to the survey.',
      moveToSurvey: 'This drawing area is empty. If you proceed, this area will be deleted.'
    };
    
    showDeleteEmptyModal(messages[actionType] || 'This drawing area is empty and will be deleted if you proceed.');
    return true;
  }

  function executePendingAction() {
    if (!pendingAction) return;

    const currentIndex = AppState.currentDrawingIndex;
    deleteDrawingInstance(currentIndex);
    
    const action = pendingAction.type;
    pendingAction = null;

    switch (action) {
      case 'navigatePrev':
        handleNavigationAfterDelete('prev');
        break;
        
      case 'navigateNext':
        handleNavigationAfterDelete('next');
        break;
        
      case 'addNew':
        handleAddNewAfterDelete();
        break;
        
      case 'returnToSurvey':
        handleReturnToSurveyAfterDelete();
        break;
        
      case 'moveToSurvey':
        handleMoveToSurveyAfterDelete();
        break;
    }
    
    renderer.render(scene, camera);
  }

  function handleNavigationAfterDelete(direction) {
    if (AppState.drawingInstances.length === 0) {
      AppState.isEditingFromSurvey = false;
      goTo('summary');
      return;
    }

    if (direction === 'prev') {
      if (AppState.currentDrawingIndex > 0) {
        navigateToDrawing(AppState.currentDrawingIndex - 1);
      } else {
        // At index 0 after deletion - update navigation buttons and texture
        updateDrawingNavigationButtons();
        drawing.updateStatusBar();
        updateCurrentTexture();
      }
    } else {
      // After deletion, currentDrawingIndex already points to next item
      updateDrawingNavigationButtons();
      drawing.updateStatusBar();
      updateCurrentTexture();
    }
  }

  function handleAddNewAfterDelete() {
    if (AppState.drawingInstances.length === 0) {
      goTo('summary');
      return;
    }
    addNewDrawingInstance();
    navigateToDrawing(AppState.drawingInstances.length - 1);
  }

  function handleReturnToSurveyAfterDelete() {
    AppState.isEditingFromSurvey = false;
    
    if (AppState.drawingInstances.length === 0) {
      goTo('summary');
      return;
    }

    if (AppState.currentSurveyIndex >= AppState.drawingInstances.length) {
      AppState.currentSurveyIndex = AppState.drawingInstances.length - 1;
    }

    AppState.currentDrawingIndex = AppState.currentSurveyIndex;
    cleanupInteraction();
    disableCursorManagement();
    goTo('area-survey');
  }

  function handleMoveToSurveyAfterDelete() {
    if (AppState.drawingInstances.length === 0) {
      showMoveToSurveyModal("Please draw at least one area before continuing.", false);
      return;
    }

    if (!hasAnyValidDrawings()) {
      showMoveToSurveyModal("Please draw at least one area before continuing.", false);
      return;
    }

    showPreviewAndConfirmModal();
  }

  function updateCurrentTexture() {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if (AppState.skinMesh && currentInstance) {
      AppState.skinMesh.material.map = currentInstance.texture;
      AppState.skinMesh.material.needsUpdate = true;
      currentInstance.texture.needsUpdate = true;
    }
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

    // Return the combined texture
    return combinedCanvas
  }

  function showPreviewAndConfirmModal() {
    setTimeout(() => {
      const combinedCanvas = createCombinedTexture();
      const tempTexture = new THREE.CanvasTexture(combinedCanvas);
      tempTexture.needsUpdate = true;

      if (AppState.skinMesh) {
        AppState.skinMesh.material.map = tempTexture;
        AppState.skinMesh.material.needsUpdate = true;
      }

      if (cameraUtils) cameraUtils.resetView();

      const previewWidth = 400;
      const previewHeight = 350;
      const originalSize = renderer.getSize(new THREE.Vector2());
      const originalPixelRatio = renderer.getPixelRatio();

      renderer.setSize(previewWidth, previewHeight, false);
      renderer.setPixelRatio(1);
      renderer.render(scene, camera);
      const dataURL = renderer.domElement.toDataURL('image/png');

      renderer.setSize(originalSize.x, originalSize.y, false);
      renderer.setPixelRatio(originalPixelRatio);

      if (AppState.skinMesh) {
        const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
        AppState.skinMesh.material.map = currentInstance.texture;
        AppState.skinMesh.material.needsUpdate = true;
      }

      renderer.render(scene, camera);

      const originalIndex = AppState.currentDrawingIndex;
      const totalAreas = AppState.drawingInstances.filter((instance, idx) => {
        AppState.currentDrawingIndex = idx;
        const blank = isDrawingBlank();
        return !blank;
      }).length;
      AppState.currentDrawingIndex = originalIndex;

      showMoveToSurveyModal(`You have drawn ${totalAreas} area${totalAreas > 1? 's':''}.\nDoes this represent your intended pain/symptom area${totalAreas > 1? 's':''}?`, true, dataURL);
    }, 100);
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

        // After submitting all surveys (endpoint)
        if (AppState.drawingInstances.length > 0) {

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
        } else {

          const canvasPanel = document.getElementById('canvas-panel');
          if (canvasPanel && canvasPanel.contains(survey.editDrawingButton)) {
            canvasPanel.removeChild(survey.editDrawingButton);
          }

          if (AppState.skinMesh && AppState.baseTextureTexture) {
            AppState.skinMesh.material.map = AppState.baseTextureTexture;
            AppState.skinMesh.material.needsUpdate = true;
          }
        }

        summary.updateSummaryStatus();
        renderer.render(scene, camera);
        break;
      }
      case 'drawing': {
        const canvasPanel = document.getElementById('canvas-panel');
        if (canvasPanel && canvasPanel.contains(survey.editDrawingButton)) {
          canvasPanel.removeChild(survey.editDrawingButton);
        }
        enableInteraction(renderer, camera, controls);
        setupCursorManagement();
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
        if (cameraUtils) cameraUtils.resetView();

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

        // Update survey title
        survey.updateTitle('general');

        // Render general survey
        renderGeneralSurvey(survey.surveyInnerContainer);
      }
    }

    renderer.render(scene, camera);
  }

  summary.changeModelButton.addEventListener('click', () => goTo('selection'))
  summary.addNewInstanceButton.addEventListener('click', () => {
    AppState.isEditingFromSurvey = false;
    addNewDrawingInstance();
    goTo('drawing');
  });

  selection.returnSummaryButton.addEventListener('click', () => goTo('summary'))
  selection.addNewInstanceButton.addEventListener('click', () => {
    AppState.isEditingFromSurvey = false;
    addNewDrawingInstance();
    goTo('drawing');
  })

  // ============================================================================
  // DRAWING NAVIGATION
  // ============================================================================

  function updateDrawingNavigationButtons() {
    const current = AppState.currentDrawingIndex;
    const total = AppState.drawingInstances.length;

    if (AppState.isEditingFromSurvey) {
      drawing.prevAreaButton.style.display = 'none';
      drawing.nextAreaButton.style.display = 'none';
      drawing.drawingNavContainer.style.display = 'none';
      drawing.drawingFooter.style.justifyContent = 'center';
      drawing.continueButton.textContent = 'Done Editing';
      drawing.continueButton.classList.add("button-drawing-center");
    } else {
      drawing.prevAreaButton.style.display = 'inline-block';
      drawing.nextAreaButton.style.display = 'inline-block';
      drawing.drawingNavContainer.style.display = 'flex';
      drawing.drawingFooter.style.display = 'flex';
      drawing.drawingFooter.style.justifyContent = 'flex-end';
      drawing.prevAreaButton.disabled = current === 0;
      
      if (current < total - 1) {
        drawing.nextAreaButton.textContent = 'Next Area →';
      } else {
        drawing.nextAreaButton.textContent = '+ Add Next Area';
      }
      
      drawing.continueButton.textContent = "I've Added All Areas";
      drawing.continueButton.classList.remove('button-primary');
      drawing.continueButton.classList.remove('button-drawing-center');
      drawing.continueButton.classList.add('button-success');
    }
  }

  // Previous button logic
  drawing.prevAreaButton.addEventListener('click', () => {
    const current = AppState.currentDrawingIndex;
    const total = AppState.drawingInstances.length;
    const isEmpty = isDrawingBlank();
    
    // If on last drawing and it's empty, just navigate without modal
    if (current === total - 1 && isEmpty) {
      deleteDrawingInstance(current);
      if (AppState.drawingInstances.length === 0) {
        goTo('summary');
        return;
      }
      navigateToDrawing(AppState.currentDrawingIndex);
      return;
    }
    
    // For non-last drawings, show modal if empty
    if (isEmpty && current !== total - 1) {
      if (handleEmptyDrawing('navigatePrev')) return;
    }
    
    // Normal navigation
    updateCurrentDrawing();
    navigateToDrawing(current - 1);
  });

  // Next button logic
  drawing.nextAreaButton.addEventListener('click', () => {
    const current = AppState.currentDrawingIndex;
    const total = AppState.drawingInstances.length;

    if (current === total - 1) {
      // On last drawing - adding new area
      if (handleEmptyDrawing('addNew')) return;
      updateCurrentDrawing();
      addNewDrawingInstance();
      navigateToDrawing(AppState.drawingInstances.length - 1);
    } else {
      // Navigating to existing next drawing
      if (handleEmptyDrawing('navigateNext')) return;
      updateCurrentDrawing();
      navigateToDrawing(current + 1);
    }
  });
  
  // Continue button logic
  drawing.continueButton.addEventListener('click', () => {
    if (AppState.isEditingFromSurvey) {
      if (handleEmptyDrawing('returnToSurvey')) return;
      updateCurrentDrawing();
      AppState.isEditingFromSurvey = false;
      AppState.currentDrawingIndex = AppState.currentSurveyIndex;
      cleanupInteraction();
      disableCursorManagement();
      goTo('area-survey');
      return;
    }

    const current = AppState.currentDrawingIndex;
    const total = AppState.drawingInstances.length;
    const currentIsEmpty = isDrawingBlank();
    
    // On last drawing that's empty but others exist
    if (current === total - 1 && currentIsEmpty && total > 1) {
      // Check if there are other valid drawings
      const originalIndex = AppState.currentDrawingIndex;
      const hasOtherValidDrawings = AppState.drawingInstances.some((instance, idx) => {
        if (idx === current) return false; // Skip current empty one
        AppState.currentDrawingIndex = idx;
        const blank = isDrawingBlank();
        return !blank;
      });
      AppState.currentDrawingIndex = originalIndex;
      
      if (hasOtherValidDrawings) {
        // Delete the empty last one and show preview
        deleteDrawingInstance(current);
        updateCurrentDrawing();
        showPreviewAndConfirmModal();
        return;
      }
    }
    
    // First drawing is empty
    if (current === 0 && currentIsEmpty && total === 1) {
      showMoveToSurveyModal("Please draw at least one area before continuing.", false);
      return;
    }
    
    // For non-last empty drawings, show deletion modal
    if (currentIsEmpty && current !== total - 1) {
      if (handleEmptyDrawing('moveToSurvey')) return;
    }

    // Normal flow - check if any valid drawings exist
    if (!hasAnyValidDrawings()) {
      showMoveToSurveyModal("Please draw at least one area before continuing.", false);
      return;
    }

    updateCurrentDrawing();
    showPreviewAndConfirmModal();
  });

  modalContinueButton.addEventListener('click', () => {
    AppState.currentSurveyIndex = 0;
    hideDrawContinueModal();
    cleanupInteraction();
    disableCursorManagement();
    goTo('area-survey');
  });
  modalReturnButton.addEventListener('click', () => {
    hideDrawContinueModal();
    updateCurrentDrawing();
    drawing.updateStatusBar();
  });

  deleteEmptyReturnButton.addEventListener('click', () => {
    hideDeleteEmptyModal();
    pendingAction = null;
  });

  deleteEmptyContinueButton.addEventListener('click', () => {
    hideDeleteEmptyModal();
    executePendingAction();
  });

  // ============================================================================
  // SURVEY MANAGEMENT
  // ============================================================================

  // TODO: Re-enable below function once it is ready
  function focusCameraOnDrawing(drawingInstance) {
    if (!cameraUtils || !drawingInstance) {
      controls.target.set(0, 1.0, 0);
      controls.object.position.set(0, 1.0, 1.75);
      controls.update();
      return
    }

    if (drawingInstance.drawnRegionNames && drawingInstance.drawnRegionNames.size > 0) {
      cameraUtils.focusOnDrawing(drawingInstance.drawnRegionNames);
    } else {
      controls.target.set(0,1,0);
      controls.object.position.set(0,1,1.75);
      controls.update();
    }
  }

  function countMainAreas() {
    return AppState.drawingInstances.filter(instance => instance.questionnaireData?.mainArea === "Yes").length;
  }
  
  function renderSurvey(container) {
    applyCustomTheme(customTheme);

    if (!surveyInstance) {
      surveyInstance = new SurveyKO.Model(areaSurveyJson);
      survey.css = { ...survey.css, root: "sv-root-modern sv-root-plain" };
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

    // Update main area question based on current count
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
    const total = AppState.drawingInstances.length;

    survey.prevAreaButton.disabled = AppState.currentSurveyIndex === 0;

    if (AppState.currentSurveyIndex < total-1) {
      survey.nextAreaButton.textContent = "Next Area Questionnaire →";
    } else {
      survey.nextAreaButton.textContent = 'Move to General Questionnaire';
      survey.nextAreaButton.style.background = '#005486';
    }
  }

  function updateSurveyProgress() {
    if (!surveyInstance) return;
    
    const allQuestions = surveyInstance.getAllQuestions();
    const visibleQuestions = allQuestions.filter(q => q.isVisible);
    const totalQuestions = visibleQuestions.length;
    
    let completedQuestions = 0;
    visibleQuestions.forEach(question => {
      const value = question.value;
      
      // Check if question is answered
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
    
    // Count main areas excluding the current one if it was previously marked as "Yes"
    let mainAreaCount = countMainAreas();
    if (currentMainAreaValue === "Yes") {
      mainAreaCount--; // Don't count current area if we're editing it
    }

    const remainingSlots = 3 - mainAreaCount;
  
    // Store the count in survey data for use in choicesEnableIf
    surveyInstance.setVariable("remainingMainAreaSlots", remainingSlots);
    surveyInstance.setVariable("isCurrentlyMainArea", currentMainAreaValue === "Yes");
    
    if (remainingSlots <= 0) {
      // No slots remaining
      mainAreaQuestion.title = "Is this your main area of pain or symptom? (Maximum 3 main areas reached)";
      mainAreaQuestion.value = "No";
    } else if (remainingSlots === 3) {
      // All slots available
      mainAreaQuestion.title = "Is this your main area of pain or symptom? (You can indicate up to 3 main areas)";
    } else {
      // Some slots remaining
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

  function renderGeneralSurvey(container) {
  applyCustomTheme(customTheme);
  
  if (!surveyInstance) {
    surveyInstance = new SurveyKO.Model(generalSurveyJson);
    surveyInstance.showTitle = false;
    surveyInstance.validationEnabled = false;

    surveyInstance.onValidateQuestion.add(function(survey, options) {
      // Skip custom validation for matrix questions
      if (options.question.getType() === 'matrix') {
        const medicationQuestion = survey.getQuestionByName('medicationTable');
        const allRows = medicationQuestion.rows.map(r => r.value);
        
        // Check which rows are missing
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

    // Adding subtext for examples in medicationTable
    surveyInstance.onAfterRenderQuestion.add(function(survey, options) {
      if (options.question.name === 'medicationTable' && options.question.getType() === 'matrix') {
        const descriptions = {
          'over-the-counter': 'Examples: Advil (ibuprofen), Aleve (naproxen), Aspirin (ASA), Motrin (ibuprofen), Tylenol (acetaminophen)',
          'non-steroidal-anti-inflammatory': 'Examples: Arthrotec, Celecoxib, Celebrex, Voltaren',
          'muscle-relaxant': 'Examples: Flexeril, Robaxacet, Robaxin',
          'narcotic-pain-medication': 'Examples: Demerol, MS Contin, Morphine, Oxycontin, Percocet, Talwin, Tylenol 3',
          'anti-depressant': 'Examples: Celexa, Cipralex, Cymbalta, Elavil, Paxil, Prozac, Wellbutrin, Zoloft',
          'neuroleptics': 'Examples: Lyrica, Neurontin, Gabapentin, Rivotril, Tegretol',
          'cannabis': 'Examples: Smoked, Inhaled, Edible, Oil, Cream'
        };

        setTimeout(() => {
          const tbody = options.htmlElement.querySelector('tbody');
          if (!tbody) {
            console.log('tbody not found');
            return;
          }
          
          const rows = tbody.querySelectorAll('tr.sd-table__row');
          
          // Match rows with question.visibleRows by index
          options.question.visibleRows.forEach((questionRow, index) => {
            const fullName = questionRow.fullName;            
            const rowValue = fullName ? fullName.split('_').pop() : null;
            const domRow = rows[index];
                        
            if (rowValue && descriptions[rowValue] && domRow) {
              // Find the td with class that contains "row-text"
              const textCell = domRow.querySelector('td.sd-table__cell--row-text');
              
              if (textCell && !textCell.querySelector('.medication-description')) {                
                // Create description element
                const desc = document.createElement('div');
                desc.className = 'medication-description';
                desc.style.cssText = 'font-size: 1rem; color: #6b7280; font-weight: normal; margin-top: 0.25rem; font-style: italic; line-height: 1.4; display: block;';
                desc.textContent = descriptions[rowValue];
                
                // Append description to the text cell
                textCell.appendChild(desc);
              } 
            }
          });
        }, 100);
      }
    });
  }

  survey.prevAreaButton.style.display = 'none';
  survey.nextAreaButton.textContent = 'Complete';
  survey.editDrawingButton.style.display = 'none';

  container.innerHTML = '';
  surveyInstance.render(container);
  updateSurveyProgress();
  renderer.render(scene, camera);
}

  function navigateToSurvey(index) {
    if (index < 0 || index >= AppState.drawingInstances.length) return;

    if (surveyInstance) {
      const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
      const canvas = currentInstance.canvas;
      currentInstance.questionnaireData = { ...surveyInstance.data };
      currentInstance.uvDrawingData = canvas.toDataURL('image/png');
    }

    AppState.currentSurveyIndex = index;
    
    survey.updateTitle();
    renderSurvey(survey.surveyInnerContainer);
    updateMainAreaQuestion();
  }

  survey.editDrawingButton.addEventListener('click', () => {
    saveCurrentSurveyData();

    AppState.isEditingFromSurvey = true;
    AppState.currentDrawingIndex = AppState.currentSurveyIndex;

    goTo('drawing');
  })

  survey.prevAreaButton.addEventListener('click', () => {
    if (AppState.currentSurveyIndex >= 1 ) {
      navigateToSurvey(AppState.currentSurveyIndex - 1);
    }
  });

  survey.nextAreaButton.addEventListener('click', async () => {
      const total = AppState.drawingInstances.length;

      if (surveyInstance) {      
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


      // Check if the submitted survey is general survey
      if ("medicationTable" in surveyInstance.data) {
        AppState.generalQuestionnaireResponse = { ...surveyInstance.data };

        // Prepare complete sumbission data
        const submissionData = await prepareSubmissionData();

        // Show loading indicator
        survey.nextAreaButton.disabled = true;
        survey.nextAreaButton.textContent = 'Submitting...';

        // Save to Firebase
        const docId = await window.firebaseService.saveSubmission(submissionData);

        // Re-enable button
        survey.nextAreaButton.disabled = false;
        survey.nextAreaButton.textContent = 'Complete';
        
        if (docId) {
          console.log('All data submitted successfully!');
        } else {
          console.error('Failed to submit data');
          alert('There was an error submitting your data. Please try again.');
          return;
        }
        surveyInstance = null;
      }
    }

    if (AppState.currentSurveyIndex < total-1) {
      navigateToSurvey(AppState.currentSurveyIndex + 1); // Move on to next area questionnaire
    } else if (AppState.generalQuestionnaireResponse) {
      goTo('summary'); // General questionnare submitted; moving to survey view
    } else {
      moveToGeneralSurvey(); // Area questionnares completed; move to general questionnaire
    }
  });

  // Helper function to prepare all submisison data
  async function prepareSubmissionData() {
    const combinedCanvas = createCombinedTexture();
    const tempTexture = new THREE.CanvasTexture(combinedCanvas);
    tempTexture.needsUpdate = true;

    if (AppState.skinMesh) {
      AppState.skinMesh.material.map = tempTexture;
      AppState.skinMesh.material.needsUpdate = true;
    }

    const previewWidth = 400;
    const previewHeight = 350;
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

    const areas = AppState.drawingInstances.map((instance, index) => ({
      areaNumber: index+1,
      areaId: instance.id,
      drawingImageData: instance.uvDrawingData,
      questionnaireResponses: instance.questionnaireData,
      drawnRegions: Array.from(instance.drawnRegionNames || [])
    }));

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

  function moveToGeneralSurvey() {
    if(!saveCurrentSurveyData()) {
      surveyInstance.validate();
      return;
    }

    // Clear the area-specific survey instance
    surveyInstance = null;
    
    // Go to general survey stage
    goTo('general-survey');
  }

  // Initializing the view
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