import { createScene, resizeRenderer } from './scene.js';
import { loadModel, cleanupAllModels } from './modelLoader.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, disableCursorManagement } from './interaction.js';
import { createDrawingControls, addNewDrawingInstance, updateCurrentDrawing, isCurrentDrawingBlank } from './drawingControls.js';
import { createViewControls } from './viewControls.js';
import { surveyJson } from './questionnaires.js';
import { customTheme, applyCustomTheme } from './questionnaires_theme.js';
import texturePool from './textureManager.js';
import eventManager from './eventManager.js';
import AppState from './state.js';
import SurveyKO from "https://cdn.skypack.dev/survey-knockout";

// Initial UI setup
const appContainer = document.createElement('div');
appContainer.id = 'app-container';
document.body.appendChild(appContainer);

// Model Summary View - Composed of Model Preview, Status Check

// Model Selection View - Composed of Model Preview, Model Selector
const modelSelectionView = document.createElement('div');
modelSelectionView.id = 'model-selection-view';

// Model Preview Panel
const modelPreviewPanel = document.createElement('div');
modelPreviewPanel.id = 'model-preview-panel';

// Model Selector Panel
const modelSelectorPanel = document.createElement('div');
modelSelectorPanel.id = 'model-selector-panel';

// Drawing Status Bar
const selectStatusBar = document.createElement('h1');
selectStatusBar.id = 'select-status-bar';
selectStatusBar.textContent = 'Select My Body';

// Models
const models = [
    { name: 'Type 1', file: './assets/female_young_avgheight2.glb' },
    { name: 'Type 2', file: './assets/male_young_avgheight2.glb' }
];

const modelButtonsContainer = document.createElement('div');
modelButtonsContainer.id = 'model-buttons-container'

modelSelectorPanel.appendChild(selectStatusBar);
modelSelectorPanel.appendChild(modelButtonsContainer);

// Default Selected to be first model
let selectedModelPath = models[0].file;

models.forEach(model => {
  const button = document.createElement('button');
  button.classList.add('model-selection-button');

  const img = document.createElement('img');
  img.src = `./assets/preview_svg/${model.name}.svg`;
  img.alt = model.name;
  img.style.width = '300px';
  img.style.height = '350px';
  img.style.objectFit = 'contain';

  const label = document.createElement('div');
  label.classList.add('label');
  label.textContent = model.name;

  button.appendChild(img);
  button.appendChild(label);
  modelButtonsContainer.appendChild(button);

  button.addEventListener('click', () => {
    selectedModelPath = model.file;
     [...modelButtonsContainer.children].forEach(b => b.style.borderColor = 'transparent');
    button.style.borderColor = 'var(--primary-color)';

    loadModel(model.file, model.name, scene, controls, () => {
      const waitUntilSkinMeshReady = setInterval(() => {
        if (AppState.skinMesh) {
          clearInterval(waitUntilSkinMeshReady);
          resizeRenderer(camera, renderer, canvasPanel);
        }
      }, 50);
    });
  });

  if(model === models[0]) {
    button.style.borderColor = 'var(--primary-color)';
  }
});

const startDrawingBtn = document.createElement('button');
startDrawingBtn.textContent = 'Draw My Pain or Symptom';
startDrawingBtn.classList.add('button', 'button-primary');

startDrawingBtn.addEventListener('click', () => {
  const waitUntilSkinMeshReady = setInterval(() => {
    if (AppState.skinMesh) {
      clearInterval(waitUntilSkinMeshReady);
      
      showView('drawing');

      updateCurrentDrawing();

      if (AppState.drawingInstances.length === 0) {
        addNewDrawingInstance();
      }
      enableInteraction(renderer, camera, controls);
    }
  }, 50);
})

// Drawing View - Composed of Drawing Controls, Canvas, View Controls
const drawingView = document.createElement('div');
drawingView.id = 'drawing-view';
drawingView.style.display = 'none';

const drawingMainRow = document.createElement('div');
drawingMainRow.style.display = 'flex';
drawingMainRow.style.flex = '1';

// Drawing Controls Panel
const drawingControlsPanel = document.createElement('div');
drawingControlsPanel.id = 'drawing-control-panel';

// Canvas Panel
const canvasPanel = document.createElement('div');
canvasPanel.id = 'canvas-panel';

const drawingCanvasPanel = document.createElement('div');
drawingCanvasPanel.id = 'drawing-canvas-panel';

// View Controls Panel
const viewControlsPanel = document.createElement('div')
viewControlsPanel.id = 'view-control-panel';

// Drawing Status Bar
const statusBar = document.createElement('div');
statusBar.id = 'drawing-status-bar';
statusBar.textContent = 'Add Your Main Area of Pain or Symptom #1';

// Bottom Footer Control
const footerBar = document.createElement('div');
footerBar.id = 'bottom-footer';

const continueButton = document.createElement('button');
continueButton.textContent = 'Continue';
continueButton.classList.add('button', 'button-primary');
continueButton.style.marginRight = '8%';

footerBar.appendChild(continueButton);

// Confirmation Display Modal
const modal = document.createElement('div');
modal.id = 'confirmation-modal';
modal.innerHTML = `
  <div class="modal-content">
    <h2 id="modal-text">Does this drawing capture your intended pain or symptom?</h2>
    <img id="drawing-preview" class="drawing-preview" />
    <div class="modal-button-group">
      <button id="modal-return" class="modal-button">No, Return to My Drawing </button>
      <button id="modal-continue" class="modal-button">Yes, Proceed </button>
    </div>
  </div>
`;

document.body.appendChild(modal);

const modalEl = document.getElementById('confirmation-modal');
const modalText = document.getElementById('modal-text');
const modalContinueButton = document.getElementById('modal-continue');
const modalReturnButton = document.getElementById('modal-return');
const drawingPreview = document.getElementById('drawing-preview');

continueButton.addEventListener('click', () => {
    if (isCurrentDrawingBlank()) {
        modalText.textContent = "No drawing has been found!";
        modalContinueButton.disabled = true;
        modalContinueButton.classList.add('disabled');
        drawingPreview.style.display = 'none';
    } else {
        modalText.textContent = "Does this represent your intended pain/symptom area?"
        modalContinueButton.disabled = false;
        modalContinueButton.classList.remove('disabled');
        drawingPreview.style.display = 'block';

        const regionBoneList = [...AppState.drawnBoneNames];

        if (regionBoneList.length > 0) {
            console.log("Detected bones:", regionBoneList);

            AppState.drawingInstances[AppState.currentDrawingIndex].boneNames = regionBoneList;
            focusCameraOnBones(regionBoneList, camera, controls, AppState.skinMesh);
            setTimeout(() => {
                const previewWidth = 400;
                const previewHeight = 350;

                const originalSize = renderer.getSize(new THREE.Vector2());
                const originalPixelRatio = renderer.getPixelRatio();

                renderer.setSize(previewWidth, previewHeight);
                renderer.setPixelRatio(1);
                renderer.render(scene, camera); // force re-render
                const dataURL = renderer.domElement.toDataURL('image/png');
                drawingPreview.src = dataURL;

                renderer.setSize(originalSize.x, originalSize.y);
                renderer.setPixelRatio(originalPixelRatio);
            }, 100);
        }
    }
    modalEl.style.display = 'flex';
});

modalContinueButton.addEventListener('click', () => {
    modalEl.style.display = 'none';
    cleanupInteraction();
    disableCursorManagement();

    document.body.classList.add('survey-mode');
    canvasPanel.style.cursor = 'default';

    showView('survey');
    renderSurveyForCurrentDrawing();
});

modalReturnButton.addEventListener('click', () => {
    // Close the modal
    modalEl.style.display = 'none';
})

const surveyView = document.createElement('div');
surveyView.id = 'survey-view';
surveyView.style.display = 'none';

const surveyPanel = document.createElement('div');
surveyPanel.id = 'survey-panel';

const surveyInnerContainer = document.createElement('div');
surveyInnerContainer.id ='survey-inner';

const returnDrawingButton = document.createElement('button');
returnDrawingButton.id = 'return-drawing-button';
returnDrawingButton.innerHTML = '← Return to Drawing';
returnDrawingButton.classList.add('button', 'button-secondary');

returnDrawingButton.addEventListener('click', () => {
    // Return to drawing view
    showView('drawing');
    document.body.classList.remove('survey-mode');    
    enableInteraction(renderer, camera, controls);
})
surveyPanel.appendChild(returnDrawingButton);
surveyPanel.appendChild(surveyInnerContainer);

const canvasWrapper = document.createElement('div');
canvasWrapper.id = 'canvas-wrapper';
canvasWrapper.appendChild(canvasPanel);

// Append elements based on views
modelSelectorPanel.appendChild(startDrawingBtn);
modelSelectionView.appendChild(modelPreviewPanel);
modelSelectionView.appendChild(modelSelectorPanel);
appContainer.appendChild(modelSelectionView);

drawingMainRow.appendChild(drawingControlsPanel);
drawingMainRow.appendChild(drawingCanvasPanel);
drawingMainRow.appendChild(viewControlsPanel);
drawingView.appendChild(statusBar);
drawingView.appendChild(drawingMainRow);
drawingView.appendChild(footerBar);
appContainer.appendChild(drawingView);

surveyView.appendChild(surveyPanel);
appContainer.appendChild(surveyView);

function showView(viewName) {
  if (canvasWrapper.parentElement) {
    canvasWrapper.parentElement.removeChild(canvasWrapper);
  }

  modelSelectionView.style.display = 'none';
  drawingView.style.display = 'none';
  surveyView.style.display = 'none';

  switch (viewName) {
    case 'modelSelection':
      modelPreviewPanel.appendChild(canvasWrapper);
      canvasWrapper.style.width = '50vw';
      modelSelectionView.style.display = 'flex';
      break;
    case 'drawing':
      drawingCanvasPanel.appendChild(canvasWrapper);
      canvasWrapper.style.width = '50vw';
      drawingView.style.display = 'flex';

      enableInteraction(renderer, camera, controls);
      setupCursorManagement();
      break;
    case 'survey':
      surveyView.insertBefore(canvasWrapper, surveyPanel);
      canvasWrapper.style.width = '40vw';
      surveyView.style.display = 'flex';
      break;
  }

  setTimeout(() => {
    resizeRenderer(camera, renderer, canvasPanel);
  }, 0);
}

// Create scene, camera, renderer
const { scene, camera, renderer, controls } = createScene(canvasPanel);
showView('modelSelection');

const initialModel = models[0]; // or whichever is selected
loadModel(initialModel.file, initialModel.name, scene, controls, () => {
  const waitUntilSkinMeshReady = setInterval(() => {
    if (AppState.skinMesh) {
      clearInterval(waitUntilSkinMeshReady);
      resizeRenderer(camera, renderer, canvasPanel);
      renderer.render(scene, camera);  // force a re-render just in case
    }
  }, 50);
});

createDrawingControls(drawingControlsPanel);
createViewControls(scene, controls, viewControlsPanel, models);

// Handle window resize
window.addEventListener('resize', () => resizeRenderer(camera, renderer, canvasPanel));
resizeRenderer(camera, renderer, canvasPanel);

window.camera = camera;
window.controls = controls;

// Start render loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

function cleanupApplication() {
    cleanupInteraction();
    cleanupAllModels();

    if (renderer) {
      renderer.dispose();
    }

    eventManager.removeAll();
    texturePool.disposeAll();

    console.log('Application Resources cleaned up');
}

window.addEventListener('beforeunload', cleanupApplication);
window.cleanupApplication = cleanupApplication;

function focusCameraOnBones(boneNames, camera, controls, mesh) {
    const boneList = mesh.skeleton.bones.filter(b => boneNames.includes(b.name));

    if (boneList.length === 0) {
        console.warn("No matching bones found");
        return;
    }

    const center = new THREE.Vector3();
    boneList.forEach(bone => {
        const pos = new THREE.Vector3();
        bone.getWorldPosition(pos);
        center.add(pos);
    });
    center.divideScalar(boneList.length);

    const distance = camera.position.distanceTo(controls.target);
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();

    const newPosition = center.clone().addScaledVector(direction, distance*0.7);

    camera.position.copy(newPosition);
    controls.target.copy(center);
    controls.update();
}

function renderSurveyForCurrentDrawing() {
  const i = AppState.currentDrawingIndex;
  applyCustomTheme(customTheme);
  
  const survey = new SurveyKO.Model(surveyJson);
  const surveyInner = document.getElementById("survey-inner");
  surveyInner.innerHTML = "";
  survey.css = { ...survey.css, root: "sv-root-modern sv-root-plain"};
  survey.render("survey-inner");
  survey.onAfterRenderQuestion.add(function (survey, options) {
    if (options.question.name === "intensityScale") {
      const questionEl = options.htmlElement;
      const ratingContent = questionEl.querySelector(".sd-question__content");

      if (!ratingContent) return;

      const ratingRow = ratingContent.querySelector(".sd-rating");

      if (!ratingRow) return;

      // Create wrapper to hold labels and rating
      const layoutRow = document.createElement("div");
      layoutRow.classList.add('rating-layout-row');

      // Min label
      const minLabel = document.createElement("div");
      minLabel.innerHTML = "No pain<br>or symptom";
      minLabel.classList.add('rating-layout-label');

      // Max label
      const maxLabel = document.createElement("div");
      maxLabel.innerHTML = "Worst pain or<br>symptom imaginable";
      maxLabel.classList.add('rating-layout-label');

      // Remove the scale from its original container
      ratingContent.removeChild(ratingRow);

      // Insert into new layout
      layoutRow.appendChild(minLabel);
      layoutRow.appendChild(ratingRow);
      layoutRow.appendChild(maxLabel);

      // Add layout row to question content
      ratingContent.appendChild(layoutRow);
    }
  });

  survey.onComplete.add(sender => {
    AppState.drawingInstances[i].questionnaireData = sender.data;
    console.log(`Saved survey for Drawing ${i + 1}`, sender.data);

    // Return to drawing view
    showView('drawing');
    AppState.drawnBoneNames = new Set();
    document.body.classList.remove('survey-mode');
    
    addNewDrawingInstance();
    enableInteraction(renderer, camera, controls);
  });
}