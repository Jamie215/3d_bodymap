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
import { attachSurveyDrawer, detachSurveyDrawer } from '../components/surveyDrawer.js';
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

    canvasContent.querySelectorAll('.canvas-floating-btn').forEach(el => el.remove());
    canvasContent.parentElement?.querySelector('.summary-canvas-header')?.remove();
    document.documentElement.removeAttribute('data-drawer-state');

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
    // Change-model button placement by viewport:
    //   Desktop/tablet — canvas toolbar
    //   Mobile         — summary footer, just above "Add a New Pain or Symptom"
    // Visibility is controlled by summary.updateSummaryStatus(): the button is
    // shown only in the empty state, hidden once any area is recorded — so the
    // selection view stays unreachable from summary once areas exist.
    if (responsive.is('isMobile')) {
        summary.summaryFooter.insertBefore(
            summary.changeModelButton,
            summary.addNewInstanceButton
        );
    } else {
        canvasToolbar.appendChild(summary.changeModelButton);
    }
    slotRight.appendChild(summary.summaryStatusPanel);
    slotFooter.appendChild(summary.summaryFooter);

    const hasAreas = AppState.drawingInstances.length > 0;
    const isMobile = responsive.is('isMobile');

    // Mobile + empty state: place title + "How do I use this form" link
    // above the 3D model, between the canvas toolbar and canvas content.
    if (isMobile && !hasAreas) {
        const canvasPanel = canvasContent.parentElement;
        if (canvasPanel && !canvasPanel.contains(summary.mobileCanvasHeader)) {
            canvasPanel.insertBefore(summary.mobileCanvasHeader, canvasContent);
        }
    } else {
        summary.mobileCanvasHeader.remove();
    }

    // Help button floats only when areas exist
    if (summary.helpButton && AppState.drawingInstances > 0) {
        canvasContent.appendChild(summary.helpButton);
    }

    // Mobile "View Summary" toggle — only useful once there are areas to view
    if (isMobile && hasAreas) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'button button-secondary';
        toggleBtn.textContent = 'View Summary';
        toggleBtn.onclick = () => {
            document.documentElement.classList.toggle('show-summary-panel');
        };
        slotFooter.insertBefore(toggleBtn, slotFooter.firstChild);
    }

    // Re-render summary content on viewport relayouts so the desktop video
    // embed / mobile empty state stays in sync. On real stage entries,
    // stageRouter.goTo() already calls updateSummaryStatus().
    if (isRelayout) {
        summary.updateSummaryStatus();
    }

    // Return-to-summary tooltips (once, after first completed area)
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
    // Stacked layout matches the popover-mode query in tooltipSteps.js
    // and the mobile + tablet-portrait media queries in layout.css.
    const isStacked = window.matchMedia(
        '(max-width: 1023px) and (orientation: portrait), (max-width: 767px)'
    ).matches;

    if (isStacked) {
        // Title gets its own band above the canvas; edit button floats
        // top-right over the canvas; survey panel becomes a bottom
        // drawer with a grab handle.
        slotHeader.appendChild(survey.surveyTitle);
        canvasContent.appendChild(survey.editDrawingButton);
        survey.editDrawingButton.classList.add('canvas-floating-btn');
        attachSurveyDrawer(survey.surveyPanel);
    } else {
        // Restore: title back inside survey-header; edit button in
        // the canvas toolbar; no drawer handle.
        survey.surveyHeader.insertBefore(survey.surveyTitle, survey.surveyHeader.firstChild);
        canvasToolbar.appendChild(survey.editDrawingButton);
        survey.editDrawingButton.classList.remove('canvas-floating-btn');
        detachSurveyDrawer(survey.surveyPanel);
    }

    slotRight.appendChild(survey.surveyPanel);
    slotFooter.appendChild(survey.surveyFooter);
}

function layoutGeneralSurvey(survey) {
    // Restore — in case we arrived from a stacked area-survey.
    survey.surveyHeader.insertBefore(survey.surveyTitle, survey.surveyHeader.firstChild);
    survey.editDrawingButton.classList.remove('canvas-floating-btn');
    detachSurveyDrawer(survey.surveyPanel);

    slotRight.appendChild(survey.surveyPanel);
    slotFooter.appendChild(survey.surveyFooter);
}