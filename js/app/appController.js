// appController.js
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

export function initApp({ scene, camera, renderer, controls, views, registerModelSelectionHandler, setStage }) {
  const { summary, selection, drawing, survey } = views;
  const { modalContinueButton, modalReturnButton } = getModalElements("continue");

  const handleModelSelection = async(model) => {
    summary.addNewInstanceButton.disabled = true;
    selection.addNewInstanceButton.disabled = true;

    await loadModel(model.file, model.name, scene, controls);

    const { globalUVMap, globalPixelBoneMap, faceBoneMap } = buildGlobalUVMap(
        AppState.skinMesh.geometry,
        texturePool.width,
        texturePool.height
    );
    AppState.globalUVMap = globalUVMap;
    AppState.globalPixelBoneMap = globalPixelBoneMap;
    AppState.faceBoneMap = faceBoneMap;

    summary.addNewInstanceButton.disabled = false;
    selection.addNewInstanceButton.disabled = false;
    renderer.render(scene, camera);
  };

  registerModelSelectionHandler(handleModelSelection);
  const initialModel = { name: 'Type 1', file: './assets/female_young_avgheight2.glb' };
  handleModelSelection(initialModel);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Stage routing
  function goTo(stage) {
    setStage(stage);

    if (stage !== 'drawing') {
      cleanupInteraction();
      disableCursorManagement();
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
    }

    switch (stage) {
      case 'summary': {
        //Reset view
        controls.target.set(0, 1.0, 0);
        controls.object.position.set(0, 1.0, 1.5);
        controls.update();

        if (AppState.skinMesh && AppState.baseTextureTexture) {
          AppState.skinMesh.material.map = AppState.baseTextureTexture;
          AppState.skinMesh.material.needsUpdate = true;
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

          if (!currentInstance.initialized) {
            // Initialize drawing texture from base texture
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, currentInstance.canvas.width, currentInstance.canvas.height);
            if (AppState.baseTextureCanvas) ctx.drawImage(AppState.baseTextureCanvas, 0, 0);
          }

          AppState.skinMesh.material.map = currentInstance.texture;
          AppState.skinMesh.material.needsUpdate = true;
          currentInstance.initialized = true;
          currentInstance.texture.needsUpdate = true;
        }
        break;
      }

      case 'survey': {
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

  drawing.continueButton.addEventListener('click', () => {
    if (isDrawingBlank()) {
      showDrawContinueModal("No drawing has been found!", false);
      return;
    }

    updateCurrentDrawing();
    const regionBoneList = [...AppState.drawingInstances[AppState.currentDrawingIndex].drawnBoneNames];
    
    if (regionBoneList.length > 0) {
      AppState.drawingInstances[AppState.currentDrawingIndex].boneNames = regionBoneList;
      focusCameraOnBones(regionBoneList);

      setTimeout(() => {
        // generate preview without permanently changing the renderer sizing
        const previewWidth = 400;
        const previewHeight = 350;
        const originalSize = renderer.getSize(new THREE.Vector2());
        const originalPixelRatio = renderer.getPixelRatio();

        renderer.setSize(previewWidth, previewHeight, false);
        renderer.setPixelRatio(1);
        renderer.render(scene, camera);
        const dataURL = renderer.domElement.toDataURL('image/png');

        // restore
        renderer.setSize(originalSize.x, originalSize.y, false);
        renderer.setPixelRatio(originalPixelRatio);
        renderer.render(scene, camera);

        showDrawContinueModal("Does this represent your intended pain/symptom area?", true, dataURL);
      }, 100);
    } else {
      showDrawContinueModal("Does this represent your intended pain/symptom area?", false);
    }
  });

  modalContinueButton.addEventListener('click', () => {
    hideDrawContinueModal();
    cleanupInteraction();
    disableCursorManagement();
    goTo('survey');
  });
  modalReturnButton.addEventListener('click', () => hideDrawContinueModal());

  survey.returnDrawingButton.addEventListener('click', () => goTo('drawing'));

  // Set initial view
  goTo('summary');

  function renderSurvey(container) {
    const i = AppState.currentDrawingIndex;
    applyCustomTheme(customTheme);

    const survey = new SurveyKO.Model(surveyJson);
    container.innerHTML = '';
    survey.css = { ...survey.css, root: "sv-root-modern sv-root-plain" };
    survey.render(container);

    survey.onAfterRenderQuestion.add(function (survey, options) {
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

    survey.onComplete.add(sender => {
      const canvas = AppState.drawingInstances[i].canvas;
      AppState.drawingInstances[i].uvDrawingData = canvas.toDataURL('image/png');
      AppState.drawingInstances[i].questionnaireData = sender.data;

      if (AppState.baseTextureContext && AppState.baseTextureTexture) {
        AppState.baseTextureContext.drawImage(canvas, 0, 0);
        AppState.baseTextureTexture.needsUpdate = true;
      }
      AppState.baseTextureTexture.needsUpdate = true;
      goTo('summary');
    });
  }

  function focusCameraOnBones(boneNames) {
    const mesh = AppState.skinMesh;
    if(!mesh || !mesh.skeleton) return;

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

  // Cleanup
  window.cleanupApplication = () => {
    cleanupInteraction();
    cleanupAllModels();
    if (renderer) renderer.dispose();
    texturePool.disposeAll();
    eventManager.removeAll();
  };

  window.addEventListener('beforeunload', window.cleanupApplication);
}
