// surveyDrawer.js
// Mobile + tablet-portrait bottom drawer for the area-survey panel.
// Three snap states (mid → expanded) cycled by tapping a
// top grab handle. The snap state is applied as a `data-drawer-state`
// attribute on <html> so the app-shell grid in layout.css can respond.
//
// This module owns nothing layout-related — it's a thin interaction
// helper. layoutAreaSurvey() in stageLayout.js decides when to attach
// and detach based on viewport.

const SNAP_CYCLE = ['expanded', 'mid'];

let handle      = null;
let currentSnap = 'mid';

function applySnap(snap) {
    currentSnap = snap;
    document.documentElement.setAttribute('data-drawer-state', snap);

    if (handle) {
        handle.setAttribute('aria-expanded', snap === 'expanded' ? 'true' : 'false');
        handle.dataset.snap = snap;
    }
}

function cycleSnap() {
    const i    = SNAP_CYCLE.indexOf(currentSnap);
    const next = SNAP_CYCLE[(i + 1) % SNAP_CYCLE.length];
    applySnap(next);
}

/**
 * Attach a drag-handle button to the top of the survey panel and reset
 * the snap state to "mid".
 *
 * @param {HTMLElement} surveyPanel
 */
export function attachSurveyDrawer(surveyPanel) {
    if (!surveyPanel) return;

    // Remove any stale handle (e.g. left over from a previous relayout)
    const existing = surveyPanel.querySelector('.survey-drawer-handle');
    if (existing) existing.remove();

    handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'survey-drawer-handle';
    handle.setAttribute('aria-label', 'Resize questionnaire panel');
    handle.setAttribute('aria-controls', 'survey-panel');

    const grip = document.createElement('span');
    grip.className = 'survey-drawer-grip';
    grip.setAttribute('aria-hidden', 'true');
    handle.appendChild(grip);

    handle.addEventListener('click', cycleSnap);

    surveyPanel.insertBefore(handle, surveyPanel.firstChild);

    // Default to mid on entry
    applySnap('mid');
}

/**
 * Remove the handle and clear the `data-drawer-state` attribute.
 * Call when leaving the stacked layout (viewport relayout to tablet
 * landscape / desktop, or stage exit).
 *
 * @param {HTMLElement} surveyPanel
 */
export function detachSurveyDrawer(surveyPanel) {
    const existing = surveyPanel?.querySelector('.survey-drawer-handle');
    if (existing) existing.remove();

    document.documentElement.removeAttribute('data-drawer-state');
    handle      = null;
    currentSnap = 'mid';
}