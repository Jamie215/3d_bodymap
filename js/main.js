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
const modelSummaryView = document.createElement('div');
modelSummaryView.id = 'model-summary-view';

// Summary Status Panel
const summaryStatusPanel = document.createElement('div');
summaryStatusPanel.id = 'summary-status-panel';
summaryStatusPanel.innerHTML = '<p style="margin: 5%">You currently don’t have any pain or symptoms logged.</br></br>Select <span style="font-weight: bold;">Add a New Pain or Symptom</span> to start.</p>'

const changeModelButton = document.createElement('button');
changeModelButton.id = 'change-model-button';
changeModelButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
    </svg>
    <span>Change My Body Type</span>
    `;
changeModelButton.classList.add('button');

changeModelButton.addEventListener('click', () => {
  showView('selection');
})

// Footer for summary view
const summaryFooter = document.createElement('div');
summaryFooter.id = 'footer-summary';
summaryFooter.classList.add('footer');

const addNewInstanceButton1 = document.createElement('button');
addNewInstanceButton1.textContent = 'Add a New Pain or Symptom';
addNewInstanceButton1.classList.add('button', 'button-primary');

addNewInstanceButton1.addEventListener('click', () => {
  addNewDrawingInstance();
  showView('drawing');
});

const summaryDoneButton = document.createElement('button');
summaryDoneButton.textContent = 'Done';
summaryDoneButton.classList.add('button', 'button-secondary');
summaryDoneButton.disabled = true;
summaryDoneButton.style.marginRight = '5%';

summaryDoneButton.addEventListener('click', () => {
  alert('Logging Pain & Symptom Completed!');
});

summaryFooter.appendChild(addNewInstanceButton1);
summaryFooter.appendChild(summaryDoneButton);

// Model Selection View - Composed of Model Preview, Model Selector
const modelSelectionView = document.createElement('div');
modelSelectionView.id = 'model-selection-view';

// Model Preview Panel
const modelPreviewPanel = document.createElement('div');
modelPreviewPanel.id = 'model-preview-panel';

// Model Selector Panel
const modelSelectorPanel = document.createElement('div');
modelSelectorPanel.id = 'model-selector-panel';

// Select Status Bar
const selectStatusBar = document.createElement('h1');
selectStatusBar.id = 'select-status-bar';
selectStatusBar.textContent = 'Select My Body';

// Models
const models = [
    { name: 'Type 1', file: './assets/female_young_avgheight2.glb' },
    { name: 'Type 2', file: './assets/male_young_avgheight2.glb' }
];

// Default selected to be the first model
const initialModel = models[0];
let selectedModelPath = initialModel.file;

const modelButtonsContainer = document.createElement('div');
modelButtonsContainer.id = 'model-buttons-container'

const returnSummaryButton = document.createElement('button');
returnSummaryButton.innerHTML = '← Return to Summary';
returnSummaryButton.classList.add('button', 'return-button');

returnSummaryButton.addEventListener('click', () => {
  showView('summary');
})
  
const addNewInstanceButton2 = document.createElement('button');
addNewInstanceButton2.textContent = 'Add a New Pain or Symptom';
addNewInstanceButton2.classList.add('button', 'button-primary');
addNewInstanceButton2.style.marginRight = '5%';

addNewInstanceButton2.addEventListener('click', () => {
  addNewDrawingInstance();
  showView('drawing');
});

// Footer for selection view
const selectionFooter = document.createElement('div');
selectionFooter.id = 'footer-selection';
selectionFooter.classList.add('footer');

selectionFooter.appendChild(addNewInstanceButton2);

modelSelectorPanel.appendChild(returnSummaryButton);
modelSelectorPanel.appendChild(selectStatusBar);
modelSelectorPanel.appendChild(modelButtonsContainer);

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

// Footer for Drawing View
const drawingFooter = document.createElement('div');
drawingFooter.id = 'footer-drawing';
drawingFooter.classList.add('footer');

const continueButton = document.createElement('button');
continueButton.textContent = 'Continue';
continueButton.classList.add('button', 'button-primary');
continueButton.style.marginRight = '8%';

drawingFooter.appendChild(continueButton);

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
        updateCurrentDrawing();
        modalText.textContent = "Does this represent your intended pain/symptom area?"
        modalContinueButton.disabled = false;
        modalContinueButton.classList.remove('disabled');
        drawingPreview.style.display = 'block';

        const regionBoneList = [...AppState.drawingInstances[AppState.currentDrawingIndex].drawnBoneNames];

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
returnDrawingButton.innerHTML = '← Return to Drawing';
returnDrawingButton.classList.add('button', 'button-secondary', 'return-button');

returnDrawingButton.addEventListener('click', () => {
    showView('drawing');
})
surveyPanel.appendChild(returnDrawingButton);
surveyPanel.appendChild(surveyInnerContainer);

const canvasWrapper = document.createElement('div');
canvasWrapper.id = 'canvas-wrapper';
canvasWrapper.appendChild(changeModelButton);
canvasWrapper.appendChild(canvasPanel);

// Append elements based on views
modelSummaryView.appendChild(canvasWrapper);
modelSummaryView.appendChild(summaryStatusPanel);
modelSummaryView.appendChild(summaryFooter);
appContainer.appendChild(modelSummaryView);

modelSelectionView.appendChild(modelPreviewPanel);
modelSelectionView.appendChild(modelSelectorPanel);
modelSelectionView.appendChild(selectionFooter);
appContainer.appendChild(modelSelectionView);

drawingMainRow.appendChild(drawingControlsPanel);
drawingMainRow.appendChild(drawingCanvasPanel);
drawingMainRow.appendChild(viewControlsPanel);
drawingView.appendChild(statusBar);
drawingView.appendChild(drawingMainRow);
drawingView.appendChild(drawingFooter);
appContainer.appendChild(drawingView);

surveyView.appendChild(surveyPanel);
appContainer.appendChild(surveyView);

function showView(viewName) {
  if (canvasWrapper.parentElement) {
    canvasWrapper.parentElement.removeChild(canvasWrapper);
  }

  modelSummaryView.style.display = 'none';
  modelSelectionView.style.display = 'none';
  drawingView.style.display = 'none';
  surveyView.style.display = 'none';

  summaryFooter.style.display = 'none';
  selectionFooter.style.display = 'none';
  drawingFooter.style.display = 'none';

  addNewInstanceButton1.style.display = 'none';
  summaryDoneButton.style.display = 'none';
  addNewInstanceButton2.style.display = 'none';
  continueButton.style.display = 'none';
  changeModelButton.style.display = 'none';

  switch (viewName) {
    case 'summary':
      modelSummaryView.insertBefore(canvasWrapper, summaryStatusPanel);
      canvasWrapper.style.width = '70vw';
      if (AppState.drawingInstances.length === 0) {
        changeModelButton.style.display = 'block';
        canvasPanel.style.height = '100vh';
      }
      modelSummaryView.style.display = 'flex';
      summaryFooter.style.display = 'flex';
      addNewInstanceButton1.style.display = 'flex';
      summaryDoneButton.style.display = 'flex';
      
      document.body.classList.add('non-drawing-mode');
      const mergedTexture = generateMergedTextureFromDrawings();
      if (AppState.skinMesh && AppState.skinMesh.material && mergedTexture) {
          AppState.skinMesh.material.map = mergedTexture;
          AppState.skinMesh.material.needsUpdate = true;
          AppState.skinMesh.userData.texture = mergedTexture;
      }
      renderer.render(scene, camera)
      controls.enableZoom = false;
      updateSummaryStatus();
      break;
    case 'selection':
      modelPreviewPanel.appendChild(canvasWrapper);
      canvasWrapper.style.width = '50vw';
      modelSelectionView.style.display = 'flex';
      selectionFooter.style.display = 'flex';
      addNewInstanceButton2.style.display = 'flex';
      break;
    case 'drawing':
      drawingCanvasPanel.appendChild(canvasWrapper);
      canvasWrapper.style.width = '50vw';
      drawingView.style.display = 'flex';
      drawingFooter.style.display = 'flex';
      continueButton.style.display = 'flex';

      document.body.classList.remove('non-drawing-mode');
      enableInteraction(renderer, camera, controls);
      controls.enableZoom = true;
      setupCursorManagement();
      break;
    case 'survey':
      surveyView.insertBefore(canvasWrapper, surveyPanel);
      canvasWrapper.style.width = '40vw';
      controls.enableZoom = false;
      surveyView.style.display = 'flex';
      document.body.classList.add('non-drawing-mode');
      break;
  }

  setTimeout(() => {
    resizeRenderer(camera, renderer, canvasPanel);
  }, 0);
}

// Create scene, camera, renderer
const { scene, camera, renderer, controls } = createScene(canvasPanel);
showView('summary');

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
createViewControls(controls, viewControlsPanel);

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

function generateMergedTextureFromDrawings() {
    if (AppState.drawingInstances.length === 0 || !AppState.drawingInstances[0].canvas) return null;
    
    const width = AppState.drawingInstances[0].canvas.width;
    const height = AppState.drawingInstances[0].canvas.height;

    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = width;
    mergedCanvas.height = height;
    const mergedCtx = mergedCanvas.getContext('2d');
    mergedCtx.fillStyle = '#ffffff';
    mergedCtx.fillRect(0, 0, width, height);

    const mergedImageData = mergedCtx.createImageData(width, height);
    const mergedData = mergedImageData.data;

    // Set non-purple pixels to be white for rendering
    for (let i = 0; i < mergedData.length; i += 4) {
        mergedData[i] = 255;     // R
        mergedData[i + 1] = 255; // G
        mergedData[i + 2] = 255; // B
        mergedData[i + 3] = 255; // A
    }

    AppState.drawingInstances.forEach(instance => {
      const ctx = instance.canvas.getContext('2d');
      const srcImageData = ctx.getImageData(0, 0, width, height);
      const srcData = srcImageData.data;

      for (let j = 0; j < srcData.length; j += 4) {
        const r = srcData[j];
        const g = srcData[j+1];
        const b = srcData[j+2];
        const a = srcData[j+3];

        // Keep the purple pixels for merging
        const isPurple = r === 149 && g === 117 && b === 205 && a > 0;
        if (isPurple) {
          mergedData[j] = r;
          mergedData[j+1] = g;
          mergedData[j+2] = b;
          mergedData[j+3] = 255;
        } 
      }
    })

    mergedCtx.putImageData(mergedImageData, 0, 0);

    const texture = new THREE.CanvasTexture(mergedCanvas);
    texture.needsUpdate = true;

    // Update the camera view back to origin view
    controls.target.set(0, 1.0, 0);
    controls.object.position.set(0, 1.0, 1.5);
    controls.update();

    return texture;
}

function updateSummaryStatus() {
  const count = AppState.drawingInstances.length;
  if (count > 0) {
    summaryStatusPanel.innerHTML = `You have <span style="color: var(--primary-color); display: inline !important; font-weight: bold !important;">${count}</span> pain or symptom(s) logged.`;
    summaryDoneButton.disabled = false;
  } else {
    summaryDoneButton.disabled = true;
  }
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
      maxLabel.innerHTML = "Worst pain or<br>symptom imaginable";
      maxLabel.classList.add('rating-layout-label');

      ratingContent.removeChild(ratingRow);

      layoutRow.appendChild(minLabel);
      layoutRow.appendChild(ratingRow);
      layoutRow.appendChild(maxLabel);

      ratingContent.appendChild(layoutRow);
    }
  });

  survey.onComplete.add(sender => {
    const canvas = AppState.drawingInstances[i]?.canvas;
    AppState.drawingInstances[i].uvDrawingData = canvas.toDataURL('image/png');
    AppState.drawingInstances[i].questionnaireData = sender.data;
    console.log(`Saved survey for Drawing ${i + 1}`);

    // Return to summary view
    showView('summary');
  });
}