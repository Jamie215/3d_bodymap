// main.js
import { initApp } from './appController.js';
import { initDrawContinueModal, initDrawResetModal } from '../components/modal.js';
import { createScene } from '../utils/scene.js';
import { createDrawingViewElements } from '../views/drawingView.js';
import { createSelectionView } from '../views/selectionView.js';
import { createSummaryView } from '../views/summaryView.js';
import { createSurveyViewElements } from '../views/surveyView.js';

// Create app container
const appContainer = document.createElement('div');
appContainer.id = 'app-container';
document.body.appendChild(appContainer);

// Build the shared canvas components
const canvasPanel = document.createElement('div');
canvasPanel.id = 'canvas-panel';
const canvasWrapper = document.createElement('div');
canvasWrapper.id = 'canvas-wrapper';
canvasWrapper.appendChild(canvasPanel);
appContainer.appendChild(canvasWrapper);

// Build the 3D scene
const { scene, camera, renderer, controls} = createScene(canvasPanel);

// Create views
let selectionViewModelHandler = null;
const summary = createSummaryView();
const selection = createSelectionView(model => {
  if (selectionViewModelHandler) {
    selectionViewModelHandler(model);
  }
});
const drawing = createDrawingViewElements(controls);
const survey = createSurveyViewElements();

// Attach views into app container
appContainer.appendChild(summary.root);
appContainer.appendChild(selection.root);
appContainer.appendChild(drawing.root);
appContainer.appendChild(survey.root);

// Create modal component into DOM
initDrawContinueModal(appContainer);
initDrawResetModal(appContainer);

window.addEventListener('resize', () => {
  const { width, height } = canvasPanel.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
});

// Start application logic
initApp({
  canvasPanel,
  canvasWrapper,
  scene, 
  camera, 
  renderer, 
  controls,
  views: {summary, selection, drawing, survey},

  registerModelSelectionHandler: handler => {
    selectionViewModelHandler = handler;
  }
});