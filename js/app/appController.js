// appController.js
import { loadModel, cleanupAllModels } from '../services/modelLoader.js';
import { isDrawingBlank, updateCurrentDrawing, addNewDrawingInstance, buildGlobalUVMap, initializeRegionMappings } from '../services/drawingEngine.js';
import texturePool from '../utils/textureManager.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, disableCursorManagement } from '../utils/interaction.js';
import { applyCustomTheme, customTheme } from '../utils/questionnaires_theme.js';
import { surveyJson } from '../utils/questionnaires.js';
import { getModalElements, showMoveToSurveyModal, hideDrawContinueModal } from '../components/modal.js';
import SurveyKO from "https://cdn.skypack.dev/survey-knockout";
import AppState from './state.js';
import eventManager from './eventManager.js';
import CameraUtils from '../utils/cameraUtils.js';

export function initApp({ scene, camera, renderer, controls, views, registerModelSelectionHandler, setStage }) {
  const { summary, selection, drawing, survey } = views;
  const { modalContinueButton, modalReturnButton } = getModalElements("continue");
  let cameraUtils = null;

  const handleModelSelection = async(model) => {
    summary.addNewInstanceButton.disabled = true;
    selection.addNewInstanceButton.disabled = true;

    await loadModel(model.file, model.name, scene, controls);

    // Initialize CameraUtils after model loads
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

  let regionDropdownListener = null;

  let surveyInstance = null;

  // Stage routing
  function goTo(stage) {
    setStage(stage);

     // Clean up dropdown listener when leaving drawing view
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

    switch (stage) {
      case 'summary': {
        // Reset view
        controls.target.set(0, 1.0, 0);
        controls.object.position.set(0, 1.0, 1.75);
        controls.update();

        if (AppState.skinMesh && AppState.baseTextureTexture) {
          AppState.skinMesh.material.map = AppState.baseTextureTexture;
          AppState.skinMesh.material.needsUpdate = true;
        }

        if (AppState.drawingInstances.length > 0) {
          summary.changeModelButton.style.display = 'none';
        }

        summary.updateStatus();
        renderer.render(scene, camera);
        break;
      }
      case 'drawing': {
        enableInteraction(renderer, camera, controls);
        setupCursorManagement();
        controls.enableZoom = true;

        if (AppState.skinMesh && AppState.drawingInstances.length > 0) {
          const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
          const ctx = currentInstance.context;

          if (!currentInstance.initialized && !AppState.isEditingFromSurvey) {
            // Initialize drawing texture from base texture
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

      case 'survey': {
        const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
    
        focusCameraOnDrawing(currentInstance);
        renderSurvey(survey.surveyInnerContainer);
        break;
      }
    }

    renderer.render(scene, camera);
  }

  // Wire UI events
  summary.changeModelButton.addEventListener('click', () => goTo('selection'))
  summary.addNewInstanceButton.addEventListener('click', () => {
    addNewDrawingInstance();
    goTo('drawing');
  });

  selection.returnSummaryButton.addEventListener('click', () => goTo('summary'))
  selection.addNewInstanceButton.addEventListener('click', () => {
    addNewDrawingInstance();
    goTo('drawing');
  })

  function navigateToDrawing(index) {
    if(index < 0 || index >= AppState.drawingInstances.length) return;

    // Save current drawing before switching
    AppState.currentDrawingIndex = index;
    updateCurrentDrawing();
    updateDrawingNavigationButtons();
    drawing.updateStatusBar();

    // Update the texture on the model
    const currentInstance = AppState.drawingInstances[index];
    if (AppState.skinMesh && currentInstance) {
      AppState.skinMesh.material.map = currentInstance.texture;
      AppState.skinMesh.material.needsUpdate = true;
      currentInstance.texture.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  // Updated drawing view button logic
  function updateDrawingNavigationButtons() {
    const current = AppState.currentDrawingIndex;
    const total = AppState.drawingInstances.length;

    // Check if the drawing view from coming from survey view
    if (AppState.isEditingFromSurvey) {
      drawing.prevAreaButton.style.display = 'none';
      drawing.nextAreaButton.style.display = 'none';

      drawing.continueButton.textContent = 'Return to Survey';
    } else {
      drawing.prevAreaButton.style.display = 'inline-block';
      drawing.nextAreaButton.style.display = 'inline-block';

      drawing.prevAreaButton.style.display = 'inline-block';
      drawing.nextAreaButton.style.display = 'inline-block';
      
      // Disable previous button for first drawing
      drawing.prevAreaButton.disabled = current === 0;
      
      // Update next button based on position
      if (current < total - 1) {
        drawing.nextAreaButton.textContent = 'Next Area →';
      } else {
        drawing.nextAreaButton.textContent = '+ Add Next Area';
      }
      
      // Reset continue button
      drawing.continueButton.textContent = "I've Added All Areas";
      drawing.continueButton.classList.remove('button-primary');
      drawing.continueButton.classList.add('button-success');
    }
  }

  drawing.prevAreaButton.addEventListener('click', () => {
    // Show previous drawing
    navigateToDrawing(AppState.currentDrawingIndex - 1);
  })
  drawing.nextAreaButton.addEventListener('click', () => {
    const current = AppState.currentDrawingIndex;
    const total = AppState.drawingInstances.length;

    if (current === total - 1) {
      // On last drawing - check if it's blank before adding new
      if (isDrawingBlank()) {
        showMoveToSurveyModal("Please draw on the current area before adding a new one.", false);
        return;
      }
      // Add new drawing instance
      addNewDrawingInstance();
      navigateToDrawing(AppState.drawingInstances.length - 1);
    } else {
      // Navigate to existing next drawing
      navigateToDrawing(current + 1);
    }
  })
  
  drawing.continueButton.addEventListener('click', () => {
    // Check if any drawings exist
    // let originalIndex = AppState.currentDrawingIndex;
    if (AppState.isEditingFromSurvey) {
      updateCurrentDrawing();
      AppState.isEditingFromSurvey = false;
      AppState.currentDrawingIndex = AppState.currentSurveyIndex;
      cleanupInteraction();
      disableCursorManagement();
      goTo('survey');
      return;
    }
    const hasDrawings = AppState.drawingInstances.some((instance, idx) => {
      AppState.currentDrawingIndex = idx;
      return !isDrawingBlank();
    });

    // AppState.currentDrawingIndex = originalIndex;

    if (!hasDrawings) {
      showMoveToSurveyModal("Please draw at least one area before continuing.", false);
      return;
    }

    updateCurrentDrawing();

    // Generate preview showing all drawing combined
    setTimeout(() => {
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = texturePool.width;
      combinedCanvas.height = texturePool.height;
      const ctx = combinedCanvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

      AppState.drawingInstances.forEach(instance => {
        // Create a temporary canvas to extract just the drawing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = instance.canvas.width;
        tempCanvas.height = instance.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Copy the instance canvas
        tempCtx.drawImage(instance.canvas, 0, 0);
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        // Make white pixels transparent
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] === 255 && pixels[i+1] === 255 && pixels[i+2] === 255) {
            pixels[i+3] = 0; // Make white pixels transparent
          }
        }
    
        // Put modified image back
        tempCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      });

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
      const dataURL = renderer.domElement.toDataURL('image/png');

      // Restore original texture and size
      renderer.setSize(originalSize.x, originalSize.y, false);
      renderer.setPixelRatio(originalPixelRatio);

      if (AppState.skinMesh) {
        const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
        AppState.skinMesh.material.map = currentInstance.texture;
        AppState.skinMesh.material.needsUpdate = true;
      }

      renderer.render(scene, camera);

      const totalAreas = AppState.drawingInstances.length;
      showMoveToSurveyModal(`You have drawn ${totalAreas} area${totalAreas > 1? 's':''}.\nDoes this represent your intended pain/symptom area${totalAreas > 1? 's':''}?`, true, dataURL);
    }, 100);
  });

  modalContinueButton.addEventListener('click', () => {
    AppState.currentSurveyIndex = 0;
    hideDrawContinueModal();
    cleanupInteraction();
    disableCursorManagement();
    goTo('survey');
  });
  modalReturnButton.addEventListener('click', () => hideDrawContinueModal());

  function focusCameraOnDrawing(drawingInstance) {
    if (!cameraUtils || !drawingInstance) {
      // Fallback to default view
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
  
  function renderSurvey(container) {
    applyCustomTheme(customTheme);

    // Create or reuse survey instance
    if (!surveyInstance) {
      surveyInstance = new SurveyKO.Model(surveyJson);
      survey.css = { ...survey.css, root: "sv-root-modern sv-root-plain" };
    }

    const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
    if (currentInstance.questionnaireData) {
      surveyInstance.data = currentInstance.questionnaireData;
    } else {
      surveyInstance.clear();
    }

    // Update canvas to show current drawing
    if (AppState.skinMesh && currentInstance) {
      AppState.skinMesh.material.map = currentInstance.texture;
      AppState.skinMesh.material.needsUpdate = true;
      currentInstance.texture.needsUpdate = true;
    }

    survey.updateTitle();
    updateSurveyNavigationButtons();

    // Render survey
    container.innerHTML = '';
    surveyInstance.render(container);

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

    renderer.render(scene, camera);
  }

  function updateSurveyNavigationButtons() {
    const total = AppState.drawingInstances.length;

    survey.prevAreaButton.disabled = AppState.currentSurveyIndex === 0;

    // Update next button text and visiblity
    if (AppState.currentSurveyIndex < total-1) {
      survey.nextAreaButton.textContent = "Next Area Questionnaire →";
    } else {
      survey.nextAreaButton.textContent = 'Move to Main Questionnaires';
    }
  }

  function saveCurrentSurveyData() {
    if(!surveyInstance) return false;

    // Validate current survey
    if (!surveyInstance.isCurrentPageHasErrors) {
      const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
      const canvas = currentInstance.canvas;

      currentInstance.questionnaireData = { ...surveyInstance.data };
      currentInstance.uvDrawingData = canvas.toDataURL('image/png');
      return true;
    }
    return false;
  }

  function navigateToSurvey(index) {
    if (index < 0 || index >= AppState.drawingInstances.length) return;
    saveCurrentSurveyData();

    AppState.currentSurveyIndex = index;
    
    const currentInstance = AppState.drawingInstances[index];
    focusCameraOnDrawing(currentInstance);
    survey.updateTitle();
    renderSurvey(survey.surveyInnerContainer);
  }

  function completeAllSurveys() {
    if(!saveCurrentSurveyData()) {
      surveyInstance.validate();
      return;
    }

    survey.surveyInnerContainer.textContent = "Survey Complete";

    survey.editDrawingButton.style.display = 'none';
    survey.prevAreaButton.style.display = 'none';
    survey.nextAreaButton.style.display = 'none';

    surveyInstance = null;
    AppState.currentSurveyIndex = 0;
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

  survey.nextAreaButton.addEventListener('click', () => {
    const total = AppState.drawingInstances.length;

    if (surveyInstance.isCurrentPageHasErrors) {
      surveyInstance.validate();
      return;
    }

    if (AppState.currentSurveyIndex < total-1) {
      navigateToSurvey(AppState.currentSurveyIndex + 1);

    } else {
      completeAllSurveys();
    }
  });

  // Set initial view
  goTo('summary');

  // Cleanup
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
