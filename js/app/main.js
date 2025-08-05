// main.js
import { initApp } from './appController.js';
import { initDrawContinueModal, initDrawResetModal } from '../components/modal.js';
import { createScene } from '../utils/scene.js';
import { createDrawingViewElements } from '../views/drawingView.js';
import { createSelectionView } from '../views/selectionView.js';
import { createSummaryView } from '../views/summaryView.js';
import { createSurveyViewElements } from '../views/surveyView.js';

// Grab predefined slots from index.html
const slotLeft = document.querySelector('.slot-left');
const slotRight = document.querySelector('.slot-right');
const slotCanvas = document.querySelector('.slot-canvas');
const slotFooter = document.querySelector('.slot-footer');

const canvasPanel = slotCanvas.querySelector('#canvas-panel');
const { scene, camera, renderer, controls } = createScene(canvasPanel);

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

// Initialize modals
initDrawContinueModal(document.body);
initDrawResetModal(document.body);

const ro = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
});
ro.observe(canvasPanel);

(() => {
  const rect = canvasPanel.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
})();

// Start application logic
initApp({
  scene, 
  camera, 
  renderer, 
  controls,
  views: {summary, selection, drawing, survey},
  setStage(stage) {
    document.documentElement.setAttribute('data-stage', stage);

    // Clear slots
    slotLeft.innerHTML = '';
    slotRight.innerHTML = '';
    slotFooter.innerHTML = '';

    switch (stage) {
      case 'summary':
        slotLeft.innerHTML = '';
        slotRight.innerHTML = '';
        slotFooter.appendChild(summary.addNewInstanceButton);
        slotFooter.appendChild(summary.summaryDoneButton);
        break;
      case 'selection':
        slotLeft.appendChild(selection.modelSelectionPanel);
        slotFooter.appendChild(selection.addNewInstanceButton);
        break;
      case 'drawing':
        slotLeft.appendChild(drawing.drawingControlsPanel);
        slotRight.appendChild(drawing.viewControlsPanel);
        slotFooter.appendChild(drawing.continueButton);
        break;
      case 'survey':
        slotRight.appendChild(survey.surveyPanel);
        break;
    }
  },

  registerModelSelectionHandler: handler => {
    selectionViewModelHandler = handler;
  }
});