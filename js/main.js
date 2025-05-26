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

// Left panel (Drawing Controls)
const drawingControlsPanel = document.createElement('div');
drawingControlsPanel.id = 'drawing-control-panel';

// Center panel (Canvas/3D Model)
const canvasPanel = document.createElement('div');
canvasPanel.id = 'canvas-panel';

// Right panel (View Controls)
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
continueButton.classList.add('button', 'button-primary', 'bottom-continue-button');

footerBar.appendChild(continueButton);

appContainer.appendChild(statusBar);
appContainer.appendChild(drawingControlsPanel);
appContainer.appendChild(canvasPanel);
appContainer.appendChild(viewControlsPanel);
appContainer.appendChild(footerBar);

// Confirmation Display Modal
const modal = document.createElement('div');
modal.id = 'confirmation-modal';
modal.innerHTML = `
  <div class="modal-content">
    <h3 id="modal-text">Does this drawing capture your intended pain or symptom?</h3>
    <img id="drawing-preview" class="drawing-preview" />
    <div class="modal-button-group">
      <button id="modal-continue" class="modal-button">Yes, Proceed </button>
      <button id="modal-return" class="modal-button">No, Return to My Drawing </button>
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
        modalText.textContent = "Does the following drawing represent your intended pain/symptom area?"
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
                const previewHeight = 300;

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
    // Switch to survey view  
    modalEl.style.display = 'none';
    drawingControlsPanel.style.display = 'none';
    viewControlsPanel.style.display = 'none';
    footerBar.style.display = 'none';
    statusBar.style.display = 'none';

    cleanupInteraction();
    disableCursorManagement();
    document.body.classList.add('survey-mode');

    document.body.classList.remove('drawing-active');
    canvasPanel.style.cursor = 'default';

    surveyPanel.style.display = 'block';
    renderSurveyForCurrentDrawing();
});

modalReturnButton.addEventListener('click', () => {
    // Close the modal
    modalEl.style.display = 'none';
})

const surveyPanel = document.createElement('div');
surveyPanel.id = 'survey-panel';
surveyPanel.style.display = 'none';
appContainer.appendChild(surveyPanel);

// Models
const models = [
    { name: 'Type 1', file: './assets/female_young_avgheight2.glb' },
    { name: 'Type 2', file: './assets/male_young_avgheight2.glb' }
];

// Create scene, camera, renderer
const { scene, camera, renderer, controls } = createScene(canvasPanel);

// Hook up modules
createDrawingControls(drawingControlsPanel);
createViewControls(scene, controls, viewControlsPanel, models);
enableInteraction(renderer, camera, controls);
setupCursorManagement();

// Handle window resize
window.addEventListener('resize', () => resizeRenderer(camera, renderer, canvasPanel));
resizeRenderer(camera, renderer, canvasPanel);

window.camera = camera;
window.controls = controls;

// Load initial model and then zoom for mobile
loadModel(models[0].file, models[0].name, scene, controls, () => {
    // Wait until skinMesh is ready
    const waitUntilSkinMeshReady = setInterval(() => {
    if (AppState.skinMesh) {
      clearInterval(waitUntilSkinMeshReady);
      updateCurrentDrawing();
      enableInteraction(renderer, camera, controls);
    }
  }, 50);
});

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

function initializeDrawings() {
    if (AppState.drawingInstances.length === 0) {
        addNewDrawingInstance();
    }
}

initializeDrawings();

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

    const newPosition = center.clone().addScaledVector(direction, distance*0.75);

    camera.position.copy(newPosition);
    controls.target.copy(center);
    controls.update();
}

function renderSurveyForCurrentDrawing() {
  const i = AppState.currentDrawingIndex;
  applyCustomTheme(customTheme);
  
  const survey = new SurveyKO.Model(surveyJson);
  const surveyPanel = document.getElementById("survey-panel");
  surveyPanel.innerHTML = "";
  survey.css = { ...survey.css, root: "sv-root-modern sv-root-plain", page: "custom-page"};
  survey.render("survey-panel");
  survey.onAfterRenderQuestion.add(function (survey, options) {
    if (options.question.name === "intensityScale") {
      const questionEl = options.htmlElement;
      const ratingContent = questionEl.querySelector(".sd-question__content");

      if (!ratingContent) return;

      const ratingRow = ratingContent.querySelector(".sd-rating");

      if (!ratingRow) return;

      // Create wrapper to hold labels and rating
      const layoutRow = document.createElement("div");
      layoutRow.style.display = "flex";
      layoutRow.style.alignItems = "center";
      layoutRow.style.justifyContent = "space-between";
      layoutRow.style.width = "100%";
      layoutRow.style.flex = "1"; // allow it to grow/shrink
      layoutRow.style.overflowX = "auto";

      // Min label
      const minLabel = document.createElement("div");
      minLabel.innerHTML = "No pain<br>or symptom";
      minLabel.style.fontSize = "14px";
      minLabel.style.lineHeight = "1.2";
      minLabel.style.textAlign = "left";

      // Max label
      const maxLabel = document.createElement("div");
      maxLabel.innerHTML = "Worst pain<br>or symptom<br>imaginable";
      maxLabel.style.fontSize = "14px";
      maxLabel.style.lineHeight = "1.2";
      maxLabel.style.textAlign = "left";

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
    surveyPanel.style.display = 'none';
    drawingControlsPanel.style.display = 'flex';
    viewControlsPanel.style.display = 'flex';
    footerBar.style.display = 'flex';
    statusBar.style.display = 'flex';
    AppState.drawnBoneNames = new Set();

    // Add next drawing instance
    document.body.classList.remove('survey-mode');
    addNewDrawingInstance();
    enableInteraction(renderer, camera, controls);
  });
}