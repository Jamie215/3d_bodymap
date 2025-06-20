// appController.js
import { resizeRenderer } from '../utils/scene.js';
import { loadModel, cleanupAllModels } from '../services/modelLoader.js';
import { isDrawingBlank, updateCurrentDrawing, addNewDrawingInstance, buildGlobalUVMap } from '../services/drawingEngine.js';
import texturePool from '../utils/textureManager.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, disableCursorManagement } from '../utils/interaction.js';
import { applyCustomTheme, customTheme } from '../utils/questionnaires_theme.js';
import { surveyJson } from '../utils/questionnaires.js';
import { getModalElements, showDrawContinueModal, hideDrawContinueModal } from '../components/modal.js';
import SurveyKO from "https://cdn.skypack.dev/survey-knockout";
import AppState from '../app/state.js';
import eventManager from './eventManager.js';

export function initApp({ canvasPanel, canvasWrapper, scene, camera, renderer, controls, views, registerModelSelectionHandler }) {
  const { summary, selection, drawing, survey } = views;
  const { modalContinueButton, modalReturnButton } = getModalElements("continue");

  const initialModel = { name: 'Type 1', file: './assets/female_young_avgheight2.glb' };

  registerModelSelectionHandler((model) => {
    loadModel(model.file, model.name, scene, controls, () => {
      const waitUntilSkinMeshReady = setInterval(() => {
        if (AppState.skinMesh) {
          clearInterval(waitUntilSkinMeshReady);
          resizeRenderer(camera, renderer, canvasPanel);
          renderer.render(scene, camera);
          const { globalUVMap, globalPixelBoneMap, faceBoneMap } = buildGlobalUVMap(
              AppState.skinMesh.geometry,
              texturePool.width,
              texturePool.height
          );

          AppState.globalUVMap = globalUVMap;
          AppState.globalPixelBoneMap = globalPixelBoneMap;
          AppState.faceBoneMap = faceBoneMap;
        }
      }, 50);
    });
  });

  loadModel(initialModel.file, initialModel.name, scene, controls, () => {
    const waitUntilSkinMeshReady = setInterval(() => {
      if (AppState.skinMesh) {
        clearInterval(waitUntilSkinMeshReady);
        resizeRenderer(camera, renderer, canvasPanel);
        renderer.render(scene, camera);
        const { globalUVMap, globalPixelBoneMap, faceBoneMap } = buildGlobalUVMap(
            AppState.skinMesh.geometry,
            texturePool.width,
            texturePool.height
        );

        AppState.globalUVMap = globalUVMap;
        AppState.globalPixelBoneMap = globalPixelBoneMap;
        AppState.faceBoneMap = faceBoneMap;
      }
    }, 50);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => resizeRenderer(camera, renderer, canvasPanel));
  resizeRenderer(camera, renderer, canvasPanel);

  summary.changeModelButton.addEventListener('click', () => {
    showView('selection');
  });

  summary.addNewInstanceButton.addEventListener('click', () => {
    addNewDrawingInstance();
    showView('drawing');
  });

  summary.summaryDoneButton.addEventListener('click', () => {
    alert('Logging Pain & Symptom Completed!');
  });

  selection.returnSummaryButton.addEventListener('click', () => {
    showView('summary');
  });

  selection.addNewInstanceButton.addEventListener('click', () => {
    addNewDrawingInstance();
    showView('drawing');
  });

  drawing.continueButton.addEventListener('click', () => {
    if (isDrawingBlank()) {
      showDrawContinueModal("No drawing has been found!", false);
    } else {
      updateCurrentDrawing();
      const regionBoneList = [...AppState.drawingInstances[AppState.currentDrawingIndex].drawnBoneNames];
      if (regionBoneList.length > 0) {
        AppState.drawingInstances[AppState.currentDrawingIndex].boneNames = regionBoneList;
        focusCameraOnBones(regionBoneList);

        setTimeout(() => {
          const previewWidth = 400;
          const previewHeight = 350;
          const originalSize = renderer.getSize(new THREE.Vector2());
          const originalPixelRatio = renderer.getPixelRatio();

          renderer.setSize(previewWidth, previewHeight);
          renderer.setPixelRatio(1);
          renderer.render(scene, camera);
          const dataURL = renderer.domElement.toDataURL('image/png');

          renderer.setSize(originalSize.x, originalSize.y);
          renderer.setPixelRatio(originalPixelRatio);

          showDrawContinueModal("Does this represent your intended pain/symptom area?", true, dataURL);
        }, 100);
      } else {
        console.log("No bones found in the drawing");
        showDrawContinueModal("Does this represent your intended pain/symptom area?", false);
      }
    }
  });

  modalContinueButton.addEventListener('click', () => {
    hideDrawContinueModal();
    cleanupInteraction();
    disableCursorManagement();
    showView('survey');
    renderSurvey(survey.surveyInnerContainer);
  });

  modalReturnButton.addEventListener('click', () => hideDrawContinueModal());

  survey.returnDrawingButton.addEventListener('click', () => showView('drawing'));

  function showView(viewName) {
    summary.root.style.display = 'none';
    selection.root.style.display = 'none';
    drawing.root.style.display = 'none';
    survey.root.style.display = 'none';

    if (canvasWrapper.parentElement) {
      canvasWrapper.parentElement.removeChild(canvasWrapper);
    }

    switch (viewName) {
      case 'summary':
        // Reset viewing position
        controls.target.set(0, 1.0, 0);
        controls.object.position.set(0, 1.0, 1.5);
        controls.update();

        document.body.classList.add('non-drawing-mode');
        summary.root.style.display = 'flex';
        canvasWrapper.style.width = '70vw';
        summary.root.insertBefore(canvasWrapper, summary.summaryStatusPanel);

        // Only show the change model button if there are no drawing instances
        if (AppState.drawingInstances.length === 0) {
          canvasPanel.style.height = '100vh';
          canvasWrapper.appendChild(summary.changeModelButton);
        }

        if (AppState.skinMesh && AppState.baseTextureTexture) {
          AppState.skinMesh.material.map = AppState.baseTextureTexture;
          AppState.skinMesh.material.needsUpdate = true;
        }
        renderer.render(scene, camera);

        summary.updateStatus();
        disableCursorManagement();
        controls.enableZoom = false;
        break;
      case 'selection':
        document.body.classList.add('non-drawing-mode');
        // Remove the change model button if it's already been added
        if (summary.changeModelButton.parentElement){
          summary.changeModelButton.parentElement.removeChild(summary.changeModelButton);
        }

        selection.root.style.display = 'flex';
        canvasWrapper.style.width = '50vw';
        selection.root.insertBefore(canvasWrapper, selection.modelSelectionPanel);
        controls.enableZoom = false;
        break;
      case 'drawing':
        document.body.classList.remove('non-drawing-mode');
        // Remove the change model button if it's already been added
        if (summary.changeModelButton.parentElement){
          summary.changeModelButton.parentElement.removeChild(summary.changeModelButton);
        }

        drawing.drawingCanvasPanel.appendChild(canvasWrapper);

        drawing.root.style.display = 'flex';
        canvasWrapper.style.width = '50vw';
        enableInteraction(renderer, camera, controls);
        setupCursorManagement();
        controls.enableZoom = true;

        if (AppState.skinMesh && AppState.drawingInstances.length > 0) {
          const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
          const ctx = currentInstance.context;

          if (!currentInstance.initialized) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, currentInstance.canvas.width, currentInstance.canvas.height);

            if (AppState.baseTextureCanvas) {
              ctx.drawImage(AppState.baseTextureCanvas, 0, 0);
            }
          }

          // Apply this texture to the mesh
          AppState.skinMesh.material.map = currentInstance.texture;
          AppState.skinMesh.material.needsUpdate = true;
          currentInstance.initialized = true;
          currentInstance.texture.needsUpdate = true;
        }
        break;
      case 'survey':
        const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
        currentInstance.initialized = true;
        document.body.classList.add('non-drawing-mode');
        survey.root.style.display = 'flex';
        canvasWrapper.style.width = '35vw';

        survey.root.insertBefore(canvasWrapper, survey.surveyPanel);
        disableCursorManagement();
        controls.enableZoom = false;
        break;
    }
    setTimeout(() => resizeRenderer(camera, renderer, canvasPanel), 0);
  }

  // Set initial view to be summary
  showView('summary');

  function renderSurvey(container) {
    const i = AppState.currentDrawingIndex;
    applyCustomTheme(customTheme);

    const survey = new SurveyKO.Model(surveyJson);
    container.innerHTML = '';
    survey.css = { ...survey.css, root: "sv-root-modern sv-root-plain" };
    survey.render(container);

    survey.onAfterRenderQuestion.add(function (survey, options) {
      // Reformat the intensity scale question
      if (options.question.name === "intensityScale") {
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
      }
    });

    survey.onComplete.add(sender => {
      const canvas = AppState.drawingInstances[i].canvas;
      AppState.drawingInstances[i].uvDrawingData = canvas.toDataURL('image/png');
      AppState.drawingInstances[i].questionnaireData = sender.data;

      if (AppState.baseTextureContext && AppState.baseTextureTexture) {
        AppState.baseTextureContext.drawImage(canvas, 0, 0);
        AppState.baseTextureTexture.needsUpdate = true;
      }
      AppState.baseTextureTexture.needsUpdate = true;
      showView('summary');
    });
  }

  function focusCameraOnBones(boneNames) {
    const mesh = AppState.skinMesh;
    const boneList = mesh.skeleton.bones.filter(b => boneNames.includes(b.name));
    if (boneList.length === 0) return;

    const center = new THREE.Vector3();
    boneList.forEach(bone => {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      center.add(pos);
    });
    center.divideScalar(boneList.length);

    const distance = camera.position.distanceTo(controls.target);
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    const newPosition = center.clone().addScaledVector(direction, distance * 0.7);

    camera.position.copy(newPosition);
    controls.target.copy(center);
    controls.update();
  }

  window.cleanupApplication = () => {
    cleanupInteraction();
    cleanupAllModels();
    if (renderer) renderer.dispose();
    texturePool.disposeAll();
    eventManager.removeAll();
  };

  window.addEventListener('beforeunload', window.cleanupApplication);
}
