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

function isSmallWidth() {
  return window.matchMedia('(max-width: 1024px)').matches;
}

function ensureFooterFabs(slotFooter) {
  let leftFab = slotFooter.querySelector('.fab.left');
  let rightFab = slotFooter.querySelector('.fab.right');

  if (!leftFab) {
    leftFab = document.createElement('button');
    leftFab.className = 'fab left';
    leftFab.type = 'button';
    leftFab.textContent = 'Draw Controls';
    slotFooter.appendChild(leftFab);
  }
  if (!rightFab) {
    rightFab = document.createElement('button');
    rightFab.className = 'fab right';
    rightFab.type = 'button';
    rightFab.textContent = 'View Controls';
    slotFooter.appendChild(rightFab);
  }
  return { leftFab, rightFab };
}

function ensureDrawers() {
  let scrim = document.body.querySelector('.drawer-scrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.className = 'drawer-scrim';
    document.body.appendChild(scrim);
  }

  let leftDrawer = document.querySelector('.drawer.left');
  if (!leftDrawer) {
    leftDrawer = document.createElement('div');
    leftDrawer.className = 'drawer left';
    document.body.appendChild(leftDrawer);
  }

  let rightDrawer = document.querySelector('.drawer.right');
  if (!rightDrawer) {
    rightDrawer = document.createElement('div');
    rightDrawer.className = 'drawer right';
    document.body.appendChild(rightDrawer);
  }

  return { scrim, leftDrawer, rightDrawer }
}

function closeDrawers(state) {
  state.leftDrawer.classList.remove('open');
  state.rightDrawer.classList.remove('open');
  state.scrim.classList.remove('is-visible');
}

function setStage(stage) {
  document.documentElement.setAttribute('data-stage', stage);

  // Clear slots
  slotLeft.innerHTML = '';
  slotRight.innerHTML = '';
  slotFooter.innerHTML = '';

  // If changeModelButton exists on canvas, remove it first
  const canvasOverlay = canvasPanel.querySelector('#canvas-overlay');
  const changeModelButton = canvasOverlay.querySelector('#change-model-button');
  if (changeModelButton) {
    canvasOverlay.removeChild(changeModelButton);
  }

  switch (stage) {
    case 'summary':
      canvasOverlay.appendChild(summary.changeModelButton);
      slotRight.appendChild(summary.summaryStatusPanel);
      slotFooter.appendChild(summary.summaryFooter);
      break;
    case 'selection':
      slotRight.appendChild(selection.modelSelectionPanel);
      slotFooter.appendChild(selection.selectionFooter);
      break;
    case 'drawing':
      if (isSmallWidth()) {
        const { leftFab, rightFab } = ensureFooterFabs(slotFooter);
        const drawers = ensureDrawers();

        drawers.leftDrawer.innerHTML = '';
        drawers.rightDrawer.innerHTML = '';
        drawers.leftDrawer.appendChild(drawing.drawingControlsPanel);
        drawers.rightDrawer.appendChild(drawing.viewControlsPanel);
        
        slotFooter.appendChild(drawing.drawingFooter);

        leftFab.onclick = () => {
          const wasOpen = drawers.leftDrawer.classList.contains('open');
          closeDrawers(drawers);
          if (!wasOpen) {
            drawers.leftDrawer.classList.add('open');
            drawers.scrim.classList.add('is-visible');
          }
        };

        rightFab.onclick = () => {
          const wasOpen = drawers.rightDrawer.classList.contains('open');
          closeDrawers(drawers);
          if (!wasOpen) {
            drawers.rightDrawer.classList.add('open');
            drawers.scrim.classList.add('is-visible');
          }
        };

        drawers.scrim.onclick = () => closeDrawers(drawers);
      } else {
        slotLeft.appendChild(drawing.drawingControlsPanel);
        slotRight.appendChild(drawing.viewControlsPanel);
        slotFooter.appendChild(drawing.drawingFooter);

        const overlay = canvasPanel.querySelector('#canvas-overlay');
        const scrim = document.body.querySelector('.drawer-scrim');
        const l = document.body.querySelector('.drawer.left');
        const r = document.body.querySelector('.drawer.right');
        scrim?.classList.remove('is-visible');
        l?.classList.remove('open');
        r?.classList.remove('open');
      }
      break;
    case 'survey':
      slotRight.appendChild(survey.surveyPanel);
      break;
  }
}

// Start application logic
initApp({
  scene, 
  camera, 
  renderer, 
  controls,
  views: {summary, selection, drawing, survey},
  setStage,
  registerModelSelectionHandler: handler => {
    selectionViewModelHandler = handler;
  }
});

// Re-apply the current stage on resize/orientation (all views)
let resizeDebounce;
function reapplyCurrentStage() {
  const stage = document.documentElement.getAttribute('data-stage');
  if (stage) setStage(stage);
}

window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(reapplyCurrentStage, 150);
});

// Some browsers already emit 'resize' on rotation; this is a cheap extra.
window.addEventListener('orientationchange', reapplyCurrentStage);
