// main.js
import { initApp } from './appController.js';
import { initDrawContinueModal, initDrawResetModal, initDeleteEmptyModal } from '../components/modal.js';
import { createScene } from '../utils/scene.js';
import { createDrawingViewElements } from '../views/drawingView.js';
import { createCanvasRotationControls } from '../components/viewControls.js';
import { createSelectionView } from '../views/selectionView.js';
import { createSummaryView } from '../views/summaryView.js';
import { createSurveyViewElements } from '../views/surveyView.js';
import { getResponsiveManager } from '../utils/responsiveManager.js';

window.sessionStartTime = new Date().toISOString();

// Initialize responsive manager
const responsive = getResponsiveManager();

// Grab predefined slots from index.html
const slotHeader = document.querySelector('.slot-header');
const slotLeft = document.querySelector('.slot-left');
const slotRight = document.querySelector('.slot-right');
const slotCanvas = document.querySelector('.slot-canvas');
const slotFooter = document.querySelector('.slot-footer');

const canvasPanel = slotCanvas.querySelector('#canvas-panel');
const { scene, camera, renderer, controls } = createScene(canvasPanel);

// Create canvas rotation controls
const rotationControls = createCanvasRotationControls(canvasPanel);
canvasPanel.appendChild(rotationControls.container);

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
initDeleteEmptyModal(document.body);

// Improved ResizeObserver with debouncing
let resizeTimeout = null;
const ro = new ResizeObserver(entries => {
  // Clear any pending resize
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  
  // Debounce resize events for better performance
  resizeTimeout = setTimeout(() => {
    const { width, height } = entries[0].contentRect;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }, 100);
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

function shouldUseMobileUI() {
  return responsive.shouldUseMobileUI();
}

function ensureFooterFabs(slotFooter) {
  let leftFab = slotFooter.querySelector('.fab.left');
  let rightFab = slotFooter.querySelector('.fab.right');

  if (!leftFab) {
    leftFab = document.createElement('button');
    leftFab.className = 'fab left';
    leftFab.type = 'button';
    leftFab.textContent = 'View Controls';
    leftFab.setAttribute('aria-label', 'Open view controls');
    slotFooter.appendChild(leftFab);
  }
  if (!rightFab) {
    rightFab = document.createElement('button');
    rightFab.className = 'fab right';
    rightFab.type = 'button';
    rightFab.textContent = 'Draw Controls';
    rightFab.setAttribute('aria-label', 'Open drawing controls');
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
    leftDrawer.setAttribute('role', 'dialog');
    leftDrawer.setAttribute('aria-modal', 'true');
    leftDrawer.setAttribute('aria-label', 'View controls panel');
    document.body.appendChild(leftDrawer);
  }

  let rightDrawer = document.querySelector('.drawer.right');
  if (!rightDrawer) {
    rightDrawer = document.createElement('div');
    rightDrawer.className = 'drawer right';
    rightDrawer.setAttribute('role', 'dialog');
    rightDrawer.setAttribute('aria-modal', 'true');
    rightDrawer.setAttribute('aria-label', 'Drawing controls panel');
    document.body.appendChild(rightDrawer);
  }

  const ensureHeaderAndContent = (drawer) => {
    let header = drawer.querySelector('.drawer-header');
    let content = drawer.querySelector('.drawer-content');
    let closeBtn;

    if (!header) {
      header = document.createElement('div');
      header.className = 'drawer-header';

      closeBtn = document.createElement('button');
      closeBtn.className = 'drawer-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close panel');
      closeBtn.innerHTML = '&times;';

      header.appendChild(closeBtn);
      drawer.appendChild(header);
    } else {
      closeBtn = header.querySelector('.drawer-close');
    }

    if (!content) {
      content = document.createElement('div');
      content.className = 'drawer-content';
      drawer.appendChild(content);
    }

    return { header, content, closeBtn };
  };

  const left = ensureHeaderAndContent(leftDrawer);
  const right = ensureHeaderAndContent(rightDrawer);

  return { 
    scrim, 
    leftDrawer, 
    rightDrawer,
    leftContent: left.content,
    rightContent: right.content,
    leftCloseBtn: left.closeBtn,
    rightCloseBtn: right.closeBtn
  };
}

function closeDrawers(state) {
  state.leftDrawer.classList.remove('open');
  state.rightDrawer.classList.remove('open');
  state.scrim.classList.remove('is-visible');
  state.scrim.setAttribute('aria-hidden', 'true');

  // Restore focus to the button that opened the drawer
  if (state.lastFocusedElement) {
    state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }
}

function setStage(stage) {
  document.documentElement.setAttribute('data-stage', stage);

  const viewportType = responsive.getViewportType();
  document.documentElement.setAttribute('data-viewport', viewportType);

  // Clear slots
  slotHeader.innerHTML = '';
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

      // On mobile, add a button to show/hide summary panel
      if (responsive.is('isMobile')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'button button-secondary';
        toggleBtn.textContent = 'View Summary';
        toggleBtn.onclick = () => {
          document.documentElement.classList.toggle('show-summary-panel');
        };
        slotFooter.insertBefore(toggleBtn, slotFooter.firstChild);
      }
      break;
    case 'selection':
      slotRight.appendChild(selection.modelSelectionPanel);
      slotFooter.appendChild(selection.selectionFooter);
      break;
    case 'drawing':
      if (shouldUseMobileUI()) {
        slotHeader.appendChild(drawing.statusBar);
        const { leftFab, rightFab } = ensureFooterFabs(slotFooter);
        const drawers = ensureDrawers();
        drawers.leftContent.replaceChildren(drawing.viewControlsPanel);
        drawers.rightContent.replaceChildren(drawing.drawingControlsPanel);
        slotFooter.appendChild(drawing.drawingFooter);

        // Setup drawer event handlers
        const setupDrawerHandlers = () => {
          drawers.leftCloseBtn.onclick = () => closeDrawers(drawers);
          drawers.rightCloseBtn.onclick = () => closeDrawers(drawers);
          drawers.scrim.onclick = () => closeDrawers(drawers);

          leftFab.onclick = () => {
            const wasOpen = drawers.leftDrawer.classList.contains('open');
            closeDrawers(drawers);
            if (!wasOpen) {
              drawers.lastFocusedElement = leftFab;
              drawers.leftDrawer.classList.add('open');
              drawers.scrim.classList.add('is-visible');
              drawers.scrim.setAttribute('aria-hidden', 'false');
              drawers.leftDrawer.setAttribute('tabindex', '-1');
              drawers.leftDrawer.focus();
            }
          };

          rightFab.onclick = () => {
            const wasOpen = drawers.rightDrawer.classList.contains('open');
            closeDrawers(drawers);
            if (!wasOpen) {
              drawers.lastFocusedElement = rightFab;
              drawers.rightDrawer.classList.add('open');
              drawers.scrim.classList.add('is-visible');
              drawers.scrim.setAttribute('aria-hidden', 'false');
              drawers.rightDrawer.setAttribute('tabindex', '-1');
              drawers.rightDrawer.focus();
            }
          };
        };
        setupDrawerHandlers();

      } else {
        slotHeader.appendChild(drawing.statusBar);
        slotLeft.appendChild(drawing.viewControlsPanel);
        slotRight.appendChild(drawing.drawingControlsPanel);
        slotFooter.appendChild(drawing.drawingFooter);

        const scrim = document.body.querySelector('.drawer-scrim');
        const l = document.body.querySelector('.drawer.left');
        const r = document.body.querySelector('.drawer.right');
        scrim?.classList.remove('is-visible');
        l?.classList.remove('open');
        r?.classList.remove('open');
      }
      break;
    case 'area-survey':
      slotRight.appendChild(survey.surveyPanel);
      slotFooter.appendChild(survey.surveyFooter);
      
      // Add edit button to canvas on tablet+
      if (!responsive.is('isMobile')) {
        canvasOverlay.appendChild(survey.editDrawingButton);
      }
      break;
    case 'general-survey':
      slotRight.appendChild(survey.surveyPanel);
      slotFooter.appendChild(survey.surveyFooter);
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

// Responsive event handling
let currentViewport = responsive.getViewportType();

// Listen for viewport changes
responsive.on('breakpointChange', (newBreakpoint, oldBreakpoint) => {
  const newViewport = responsive.getViewportType();
  
  // Only re-apply stage if viewport type changed (mobile <-> tablet <-> desktop)
  if (currentViewport !== newViewport) {
    currentViewport = newViewport;
    const currentStage = document.documentElement.getAttribute('data-stage');
    
    // Use requestAnimationFrame for smooth transition
    requestAnimationFrame(() => {
      if (currentStage) {
        setStage(currentStage);
      }
    });
  }
});

// Handle orientation changes
responsive.on('isLandscape', (isLandscape) => {
  // You can add specific landscape adjustments here if needed
  document.documentElement.setAttribute('data-orientation', isLandscape ? 'landscape' : 'portrait');
});

// Handle reduced motion preference
responsive.on('prefersReducedMotion', (prefersReduced) => {
  document.documentElement.classList.toggle('reduced-motion', prefersReduced);
});

// Initialize Firebase when app loads
document.addEventListener('DOMContentLoaded', () => {
  if (window.firebaseService) {
    window.firebaseService.init();
  }
  
  // Set initial viewport attributes
  document.documentElement.setAttribute('data-viewport', responsive.getViewportType());
  document.documentElement.setAttribute('data-orientation', responsive.is('isLandscape') ? 'landscape' : 'portrait');
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  ro.disconnect();
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
});

export { responsive };
