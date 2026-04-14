// stageLayout.js
// Owns the setStage() function that swaps DOM content between
// the app-shell's slots (header, left, canvas-toolbar, right, footer)
// whenever the application transitions between stages.
//
// This is the "view layer" counterpart to stageRouter.js, which
// handles state, textures, and camera positioning.

import { getResponsiveManager } from '../utils/responsiveManager.js';
import { setupRegionSelectorForDrawing } from '../components/viewControls.js';
import { runDrawingTooltips, runReturnToSummaryTooltips, haveDrawingTooltipsShown } from './tooltipRunner.js';
import AppState from './state.js';

// ============================================================================
// MODULE STATE — injected via initStageLayout()
// ============================================================================

let slotHeader      = null;
let slotLeft        = null;
let slotRight       = null;
let slotFooter      = null;
let canvasToolbar   = null;
let canvasContent   = null;
let views           = null;   // { summary, selection, drawing, survey }
let responsive      = null;

// ============================================================================
// INITIALISATION
// ============================================================================

/**
 * Call once at startup to provide DOM references and view objects.
 *
 * @param {Object} deps
 * @param {HTMLElement}  deps.slotHeader
 * @param {HTMLElement}  deps.slotLeft
 * @param {HTMLElement}  deps.slotRight
 * @param {HTMLElement}  deps.slotFooter
 * @param {HTMLElement}  deps.canvasToolbar
 * @param {HTMLElement}  deps.canvasContent
 * @param {Object}       deps.views — { summary, selection, drawing, survey }
 */
export function initStageLayout(deps) {
    slotHeader    = deps.slotHeader;
    slotLeft      = deps.slotLeft;
    slotRight     = deps.slotRight;
    slotFooter    = deps.slotFooter;
    canvasToolbar = deps.canvasToolbar;
    canvasContent = deps.canvasContent;
    views         = deps.views;
    responsive    = getResponsiveManager();
}

// ============================================================================
// PUBLIC — STAGE LAYOUT
// ============================================================================

/**
 * Swap DOM slot contents and set data-stage / data-viewport attributes.
 * Called by stageRouter.goTo() after state + texture work is done,
 * or by main.js on viewport change (with isRelayout = true).
 *
 * @param {'summary'|'selection'|'drawing'|'area-survey'|'general-survey'} stage
 * @param {boolean} [isRelayout=false] — true when called due to viewport/breakpoint
 *        change rather than a genuine stage transition. Suppresses one-time actions
 *        like showing the region selector modal.
 */
export function setStage(stage, isRelayout = false) {
    document.documentElement.setAttribute('data-stage', stage);

    const viewportType = responsive.getViewportType();
    document.documentElement.setAttribute('data-viewport', viewportType);

    // Clear all slots
    slotHeader.innerHTML  = '';
    slotLeft.innerHTML    = '';
    slotRight.innerHTML   = '';
    slotFooter.innerHTML  = '';
    canvasToolbar.innerHTML = '';

    const { summary, selection, drawing, survey } = views;

    switch (stage) {
        case 'summary':
            layoutSummary(summary, isRelayout);
            break;

        case 'selection':
            layoutSelection(selection);
            break;

        case 'drawing':
            layoutDrawing(drawing, survey, isRelayout);
            break;

        case 'area-survey':
            layoutAreaSurvey(survey);
            break;

        case 'general-survey':
            layoutGeneralSurvey(survey);
            break;
    }
}

// ============================================================================
// PER-STAGE LAYOUT HELPERS
// ============================================================================

function layoutSummary(summary, isRelayout) {
    canvasToolbar.appendChild(summary.changeModelButton);
    slotRight.appendChild(summary.summaryStatusPanel);
    slotFooter.appendChild(summary.summaryFooter);

    // Help button floats over the canvas (same as drawing view)
    if (summary.helpButton) {
        canvasContent.appendChild(summary.helpButton);
    }

    // Mobile: toggle button for summary panel
    if (responsive.is('isMobile')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'button button-secondary';
        toggleBtn.textContent = 'View Summary';
        toggleBtn.onclick = () => {
            document.documentElement.classList.toggle('show-summary-panel');
        };
        slotFooter.insertBefore(toggleBtn, slotFooter.firstChild);
    }

    // Return-to-summary tooltips (once, after first completed area)
    // Skip on relayout — tooltips track their own shown-state internally
    if (
        !isRelayout &&
        AppState.drawingInstances.length > 0 &&
        !AppState.generalQuestionnaireResponse
    ) {
        runReturnToSummaryTooltips();
    }
}

function layoutSelection(selection) {
    slotRight.appendChild(selection.modelSelectionPanel);
    slotFooter.appendChild(selection.selectionFooter);
}

function layoutDrawing(drawing, survey, isRelayout) {
    // Header: status bar
    slotHeader.appendChild(drawing.headerContent);

    // Left: drawing controls (CSS handles horizontal vs vertical)
    slotLeft.appendChild(drawing.drawingControlsPanel);

    // Footer: region selector (left) + done drawing (right)
    slotFooter.appendChild(drawing.drawingFooter);

    const isFirstDrawingEntry = !AppState.isEditingFromSurvey;

    // Setup region selector — adds button to footerLeft.
    // Only show the modal on genuine stage entry (not viewport relayouts).
    if (isFirstDrawingEntry && !isRelayout) {
        setupRegionSelectorForDrawing(drawing.footerLeft, true, (regionName) => {
            drawing.updateStatusBar(regionName);

            // Trigger drawing tooltips once after first region selection
            if (!haveDrawingTooltipsShown()) {
                runDrawingTooltips();
            }
        });
    } else {
        setupRegionSelectorForDrawing(drawing.footerLeft, false, drawing.updateStatusBar);
    }

    // Help button floats over the canvas
    canvasContent.appendChild(drawing.helpButton);

    // Close any open drawers from other stages
    const scrim = document.body.querySelector('.drawer-scrim');
    const l     = document.body.querySelector('.drawer.left');
    const r     = document.body.querySelector('.drawer.right');
    scrim?.classList.remove('is-visible');
    l?.classList.remove('open');
    r?.classList.remove('open');
}

function layoutAreaSurvey(survey) {
    slotRight.appendChild(survey.surveyPanel);
    slotFooter.appendChild(survey.surveyFooter);

    // Edit-drawing button in toolbar on tablet+
    if (!responsive.is('isMobile')) {
        canvasToolbar.appendChild(survey.editDrawingButton);
    }
}

function layoutGeneralSurvey(survey) {
    slotRight.appendChild(survey.surveyPanel);
    slotFooter.appendChild(survey.surveyFooter);
}