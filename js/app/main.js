// main.js
import { initApp } from './appController.js';
import { 
    initDrawContinueModal, 
    initDrawResetModal, 
    initDeleteEmptyModal, 
    initRegionSelectorModal,
    initOnboardingModal,
    showOnboardingModal,

    setOnOnboardingComplete
} from '../components/modal.js';
import { createScene } from '../utils/scene.js';
import { createDrawingViewElements } from '../views/drawingView.js';
import { createCanvasRotationControls, setupRegionSelectorForDrawing } from '../components/viewControls.js';
import { createSelectionView } from '../views/selectionView.js';
import { createSummaryView } from '../views/summaryView.js';
import { createSurveyViewElements } from '../views/surveyView.js';
import { getResponsiveManager } from '../utils/responsiveManager.js';
import AppState from './state.js';

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

// === NEW: Create dedicated toolbar structure ===
// Replace overlay with a proper toolbar that takes dedicated space
const canvasToolbar = document.createElement('div');
canvasToolbar.id = 'canvas-toolbar';

// Create a wrapper for the actual canvas content
const canvasContent = document.createElement('div');
canvasContent.id = 'canvas-content';

// Move existing canvas-overlay (if present) or create canvas wrapper
const existingOverlay = canvasPanel.querySelector('#canvas-overlay');
if (existingOverlay) {
  existingOverlay.remove(); // Remove the old overlay approach
}

// Get any existing children (like the Three.js canvas) and move them to canvasContent
const existingChildren = Array.from(canvasPanel.children);
existingChildren.forEach(child => {
  // Skip rotation controls if they exist (we'll add them after)
  if (child.id !== 'canvas-rotation-controls') {
    canvasContent.appendChild(child);
  }
});

// Restructure canvas panel: toolbar first, then content
canvasPanel.appendChild(canvasToolbar);
canvasPanel.appendChild(canvasContent);

// Now create the scene inside the canvas content wrapper
const { scene, camera, renderer, controls } = createScene(canvasContent);

// Create canvas rotation controls and add to canvas content (not panel)
const rotationControls = createCanvasRotationControls(canvasContent);
canvasContent.appendChild(rotationControls.container);

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

// Initialize modals (must be done before setStage is called)
initDrawContinueModal(document.body);
initDrawResetModal(document.body);
initDeleteEmptyModal(document.body);
initRegionSelectorModal(document.body);
initOnboardingModal(document.body);

// Track if onboarding has been shown this session
let hasShownOnboardingThisSession = false;

// Improved ResizeObserver with debouncing - now observe canvasContent
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
ro.observe(canvasContent); // Observe the content area, not the panel

(() => {
  const rect = canvasContent.getBoundingClientRect();
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

  // === NEW: Clear the canvas toolbar instead of manipulating overlay ===
  canvasToolbar.innerHTML = '';

  switch (stage) {
    case 'summary':
      // Add change model button to the dedicated toolbar
      canvasToolbar.appendChild(summary.changeModelButton);
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
      
      // Show onboarding modal on first visit to summary
      if (!hasShownOnboardingThisSession) {
        hasShownOnboardingThisSession = true;
        // Delay slightly to allow the UI to render first
        setTimeout(() => {
          showOnboardingModal();
        }, 500);
      }
      break;

    case 'selection':
      slotRight.appendChild(selection.modelSelectionPanel);
      slotFooter.appendChild(selection.selectionFooter);
      break;

    case 'drawing':
      // Both mobile and desktop use the same basic layout now
      // Mobile: toolbar is horizontal below header (via CSS)
      // Desktop: toolbar is vertical in slot-left
      
      // Header: Status bar
      slotHeader.appendChild(drawing.headerContent);
      
      // Left: Drawing controls (CSS handles horizontal/vertical display)
      slotLeft.appendChild(drawing.drawingControlsPanel);
      
      // Footer: Change View (left) + Done Drawing (right)
      slotFooter.appendChild(drawing.drawingFooter);
      
      // Setup region selector - adds button to footerLeft
      setupRegionSelectorForDrawing(drawing.footerLeft, !AppState.isEditingFromSurvey);

      // Close any open drawers from other stages
      const scrim = document.body.querySelector('.drawer-scrim');
      const l = document.body.querySelector('.drawer.left');
      const r = document.body.querySelector('.drawer.right');
      scrim?.classList.remove('is-visible');
      l?.classList.remove('open');
      r?.classList.remove('open');
      
      break;

    case 'area-survey':
      slotRight.appendChild(survey.surveyPanel);
      slotFooter.appendChild(survey.surveyFooter);
      
      // Add edit button to canvas toolbar on tablet+
      if (!responsive.is('isMobile')) {
        canvasToolbar.appendChild(survey.editDrawingButton);
      }
      break;

    case 'general-survey':
      slotRight.appendChild(survey.surveyPanel);
      slotFooter.appendChild(survey.surveyFooter);
      break;
  }
}

// Optional: Set callback for when onboarding is completed
setOnOnboardingComplete(() => {
  console.log('Onboarding completed');
  // You can trigger any action here after the user clicks "Get Started"
});

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
  },
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