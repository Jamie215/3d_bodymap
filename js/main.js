import { createScene, resizeRenderer } from './scene.js';
import { loadModel, cleanupAllModels } from './modelLoader.js';
import { enableInteraction, cleanupInteraction, setupCursorManagement, getBoneFromPaintedUV } from './interaction.js';
import { createDrawingControls, addNewDrawingInstance, updateCurrentDrawing, isCurrentDrawingBlank } from './drawingControls.js';
import { createViewControls } from './viewControls.js';
import texturePool from './textureManager.js';
import eventManager from './eventManager.js';
import AppState from './state.js';

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
    <img id="drawing-preview" class="drawing-preview" /?
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
// const modalAddButton = document.getElementById('modal-add');
const drawingPreview = document.getElementById('drawing-preview');

continueButton.addEventListener('click', () => {
    if (isCurrentDrawingBlank()) {
        modalText.textContent = "No drawing has been found!";
        modalContinueButton.disabled = true;
        modalContinueButton.classList.add('disabled');
        drawingPreview.style.display = 'none';
    } else {
        modalText.textContent = "A drawing has been found in the following region(s)"
        modalContinueButton.disabled = false;
        modalContinueButton.classList.remove('disabled');
        drawingPreview.style.display = 'block';

        const regionBoneList = [...AppState.drawnBoneNames];


        if (regionBoneList.length > 0) {
            console.log("Detected bones:", regionBoneList);

            // Store in AppState
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
            
            // // Build list HTML
            // const labelHTML = `
            //     <ul style="margin-top: 0;">
            //         ${regionBoneList.map(b => `<li>${b}</li>`).join('')}
            //     </ul>
            // `;

            // // Insert into modal below main text
            // const infoContainer = document.createElement('div');
            // infoContainer.innerHTML = labelHTML;
            // modalText.after(infoContainer);
        }
    }
    modalEl.style.display = 'flex';
});

modalContinueButton.addEventListener('click', () => {
    modalEl.style.display = 'none';
    // infoContainer.remove();
    alert('Proceeding to next step...'); // Replace with your actual action
});

modalReturnButton.addEventListener('click', () => {
    modalEl.style.display = 'none';
    AppState.drawnBoneNames = new Set();
    // infoContainer?.remove();
})

// modalAddButton.addEventListener('click', () => {
//     modalEl.style.display = 'none';
//     AppState.drawnBoneNames = new Set();
//     // infoContainer?.remove();
//     addNewDrawingInstance(); // use your existing function
// });

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
setupCursorManagement(renderer);

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
      
      if (AppState.drawingInstances.length === 0) {
        addNewDrawingInstance();
      } else {
        updateCurrentDrawing();
      }
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

// Update status when ready
console.log('Application initialized');

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

    const newPosition = center.clone().addScaledVector(direction, distance*0.8);

    camera.position.copy(newPosition);
    controls.target.copy(center);
    controls.update();
}
