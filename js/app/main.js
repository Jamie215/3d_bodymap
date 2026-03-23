// main.js
import './three_global.js'
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

// Track if tooltips have shown this session per view
let hasShownDrawingTooltips = false;
let hasShownReturnTooltips = false;

// Run a Driver.js tooltip sequence for the drawing view
function runDrawingTooltips() {
  if (typeof window.driver === 'undefined' || !window.driver?.js?.driver) {
    console.warn('Driver.js not loaded - skipping tooltips');
    return;
  }

  const driverInstance = window.driver.js.driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    allowClose: true,
    overlayClickNext: false,
    stagePadding: 8,
    stageRadius: 8,
    disableActiveInteraction: true,
    popoverClass: 'app-tooltip',
    steps: [
      {
        element: '#draw-button',
        popover: {
          title: 'Draw Tool',
          description: 'Use this to draw on the body model. This tool is selected by default when you enter the drawing view.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '#erase-button',
        popover: {
          title: 'Eraser Tool',
          description: 'Switch to the eraser to remove parts of your drawing. You can toggle back to the draw tool anytime.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '.vertical-slider-container',
        popover: {
          title: 'Marker Size',
          description: 'Drag the slider to adjust how large or small your brush or eraser is.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '#canvas-rotation-controls',
        popover: {
          title: 'Rotate the Body',
          description: 'Use these arrows to rotate the body model left or right so you can reach different areas.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#canvas-content',
        popover: {
          title: 'Zoom In / Out',
          description: 'Use your mouse wheel or pinch gesture to zoom in and out on the body model for more precision.',
          side: 'top',
          align: 'center'
        }
      }
    ]
  });
 
  setTimeout(() => {
    driverInstance.drive();
  }, 1500);
}

/**
 * Runs a Driver.js tooltip sequence when the user returns to summary
 * after completing their first pain/symptom area.
 * Highlights: area card, add more button, proceed button.
 */
function runReturnToSummaryTooltips() {
  if (typeof window.driver === 'undefined' || !window.driver?.js?.driver) {
    console.warn('Driver.js not loaded — skipping return tooltips');
    return;
  }

  const driverInstance = window.driver.js.driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    allowClose: true,
    overlayClickNext: false,
    stagePadding: 8,
    stageRadius: 8,
    disableActiveInteraction: true,
    popoverClass: 'app-tooltip',
    steps: [
      {
        element: '.area-item',
        popover: {
          title: 'Your Logged Area',
          description: 'Each pain or symptom area you complete will appear here. You can edit or delete any area at any time.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#add-new-instance-summary',
        popover: {
          title: 'Add More Areas',
          description: 'If you have pain or symptoms in other areas, click here to draw and log another one.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#summary-done-button',
        popover: {
          title: 'Finish Up',
          description: 'Once you\'ve added all your areas, click here to complete the general questionnaire and submit.',
          side: 'top',
          align: 'center'
        }
      }
    ]
  });

  setTimeout(() => {
    driverInstance.drive();
  }, 500);
}

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

      // Show return tooltips when coming back with at least one area logged
      if (!hasShownReturnTooltips && AppState.drawingInstances.length > 0 && !AppState.generalQuestionnaireResponse) {
        hasShownReturnTooltips = true;
        runReturnToSummaryTooltips();
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

      // For triggering first time tooltip
      const isFirstDrawingEntry = !AppState.isEditingFromSurvey;
      
      // Setup region selector - adds button to footerLeft
      if (isFirstDrawingEntry) {
        setupRegionSelectorForDrawing(drawing.footerLeft, isFirstDrawingEntry, (regionName) => {
          drawing.updateStatusBar(regionName);

          // If this is the first time entering drawing, also trigger the tooltip for region selection
          if (!hasShownDrawingTooltips && isFirstDrawingEntry) {
            hasShownDrawingTooltips = true;
            runDrawingTooltips();
          }
        });
      } else {
        setupRegionSelectorForDrawing(drawing.footerLeft, !AppState.isEditingFromSurvey, drawing.updateStatusBar);
      }


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

setOnOnboardingComplete(() => {
  console.log('Onboarding completed');
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