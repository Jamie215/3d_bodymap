// main.js
// Application entry point.
// Responsibilities: DOM scaffolding, scene creation, view instantiation,
// modal initialisation, resize handling, responsive listeners, and startup.
//
// Stage layout (setStage) extracted to stageLayout.js
// Tooltip definitions extracted to tooltipSteps.js / tooltipRunner.js

import './three_global.js';
import { initApp } from './appController.js';
import {
    initDrawContinueModal,
    initDrawResetModal,
    initDeleteEmptyModal,
    initDeleteAreaModal,
    initRegionSelectorModal,
    initOnboardingModal,
    showOnboardingModal,
    hasOnboardingBeenShown,
    setOnOnboardingComplete
} from '../components/modal.js';
import { createScene } from '../utils/scene.js';
import { createDrawingViewElements } from '../views/drawingView.js';
import { createCanvasRotationControls } from '../components/viewControls.js';
import { createSelectionView } from '../views/selectionView.js';
import { createSummaryView } from '../views/summaryView.js';
import { createSurveyViewElements } from '../views/surveyView.js';
import { getResponsiveManager } from '../utils/responsiveManager.js';
import { initStageLayout, setStage } from './stageLayout.js';
import AppState from './state.js';

window.AppState = AppState;
window.sessionStartTime = new Date().toISOString();

// ====================================================================
// RESPONSIVE MANAGER
// ====================================================================

const responsive = getResponsiveManager();

// ====================================================================
// DOM SCAFFOLDING
// ====================================================================

const slotHeader  = document.querySelector('.slot-header');
const slotLeft    = document.querySelector('.slot-left');
const slotRight   = document.querySelector('.slot-right');
const slotCanvas  = document.querySelector('.slot-canvas');
const slotFooter  = document.querySelector('.slot-footer');
const canvasPanel = slotCanvas.querySelector('#canvas-panel');

// Replace the old overlay approach with a dedicated toolbar + content wrapper
const canvasToolbar = document.createElement('div');
canvasToolbar.id = 'canvas-toolbar';

const canvasContent = document.createElement('div');
canvasContent.id = 'canvas-content';

// Remove legacy overlay if present
const existingOverlay = canvasPanel.querySelector('#canvas-overlay');
if (existingOverlay) existingOverlay.remove();

// Move existing children into canvasContent
Array.from(canvasPanel.children).forEach(child => {
    if (child.id !== 'canvas-rotation-controls') {
        canvasContent.appendChild(child);
    }
});

canvasPanel.appendChild(canvasToolbar);
canvasPanel.appendChild(canvasContent);

// ====================================================================
// SCENE + CONTROLS
// ====================================================================

const { scene, camera, renderer, controls } = createScene(canvasContent);

const rotationControls = createCanvasRotationControls(canvasContent);
canvasContent.appendChild(rotationControls.container);

// ====================================================================
// VIEWS
// ====================================================================

let selectionViewModelHandler = null;

const summary   = createSummaryView();
const selection  = createSelectionView(model => {
    if (selectionViewModelHandler) selectionViewModelHandler(model);
});
const drawing    = createDrawingViewElements(controls);
const survey     = createSurveyViewElements();

const views = { summary, selection, drawing, survey };

// ====================================================================
// MODALS
// ====================================================================

initDrawContinueModal(document.body);
initDrawResetModal(document.body);
initDeleteEmptyModal(document.body);
initDeleteAreaModal(document.body);
initRegionSelectorModal(document.body);
initOnboardingModal(document.body);

// ====================================================================
// STAGE LAYOUT INIT
// ====================================================================

initStageLayout({
    slotHeader,
    slotLeft,
    slotRight,
    slotFooter,
    canvasToolbar,
    canvasContent,
    views
});

// ====================================================================
// RESIZE OBSERVER
// ====================================================================

let resizeTimeout = null;

const ro = new ResizeObserver(entries => {
    if (resizeTimeout) clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
        const { width, height } = entries[0].contentRect;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    }, 100);
});

ro.observe(canvasContent);

// Initial size sync
(() => {
    const rect = canvasContent.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    }
})();

// ====================================================================
// APPLICATION INIT
// ====================================================================

setOnOnboardingComplete(() => {
    console.log('Onboarding completed');
});

initApp({
    scene,
    camera,
    renderer,
    controls,
    views,
    setStage,
    registerModelSelectionHandler: handler => {
        selectionViewModelHandler = handler;
    }
});

if (!hasOnboardingBeenShown()) {
    showOnboardingModal();
}

// ====================================================================
// RESPONSIVE EVENT HANDLING
// ====================================================================

let currentViewport = responsive.getViewportType();

responsive.on('breakpointChange', (newBreakpoint, oldBreakpoint) => {
    const newViewport = responsive.getViewportType();
    if (currentViewport !== newViewport) {
        currentViewport = newViewport;
        const currentStage = document.documentElement.getAttribute('data-stage');
        requestAnimationFrame(() => {
            if (currentStage) setStage(currentStage, true);
        });
    }
});

responsive.on('isLandscape', (isLandscape) => {
    document.documentElement.setAttribute('data-orientation', isLandscape ? 'landscape' : 'portrait');
});

responsive.on('prefersReducedMotion', (prefersReduced) => {
    document.documentElement.classList.toggle('reduced-motion', prefersReduced);
});

// ====================================================================
// DOM CONTENT LOADED + CLEANUP
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Firebase removed for integration handover.
    // To re-enable, add firebaseService.js to index.html and uncomment:
    // if (window.firebaseService) window.firebaseService.init();

    document.documentElement.setAttribute('data-viewport', responsive.getViewportType());
    document.documentElement.setAttribute('data-orientation', responsive.is('isLandscape') ? 'landscape' : 'portrait');
});

window.addEventListener('beforeunload', () => {
    ro.disconnect();
    if (resizeTimeout) clearTimeout(resizeTimeout);
});

export { responsive };