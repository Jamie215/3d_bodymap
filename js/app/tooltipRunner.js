// tooltipRunner.js
// Thin wrapper around Driver.js that runs the guided-tour tooltip sequences.
// Consumes step definitions from tooltipSteps.js.
//
// Every screen tour can be started (and replayed) from the Help panel
// ("Take a quick tour"). In the full form (drawings + questionnaires), the
// drawing and summary tours also start automatically once per session, as in
// the original app. In drawing-only mode they never start on their own.
//
// "Already shown" is kept in sessionStorage (see sessionFlags.js): it survives
// an accidental page refresh, and endSession() clears it so the next
// participant sees the tours again.

import { buildDrawingSteps, buildSummarySteps, DRIVER_CONFIG } from './tooltipSteps.js';
import { hasShown, markShown } from '../utils/sessionFlags.js';
import { isDrawingOnly } from './studyMode.js';

const DRAWING_TOUR_SHOWN_KEY = 'painSurvey_drawingTooltipsShown';
const SUMMARY_TOUR_SHOWN_KEY = 'painSurvey_returnTooltipsShown';

/** Step builders for each screen that has a tour, keyed by help context. */
const TOUR_STEPS = {
    drawing: buildDrawingSteps,
    summary: buildSummarySteps
};

// ============================================================================
// INTERNAL
// ============================================================================

/**
 * Create a Driver.js instance, merge the shared config with the
 * supplied steps, and drive after a short delay.
 *
 * @param {Function} buildSteps — returns the Driver.js step array. A builder
 *                                (not a fixed array) so steps can depend on the
 *                                viewport and the study mode at the moment the
 *                                tour starts.
 * @param {number}   delay      — ms to wait before starting
 */
function runSequence(buildSteps, delay) {
    if (typeof window.driver === 'undefined' || !window.driver?.js?.driver) {
        console.warn('Driver.js not loaded — skipping tooltips');
        return;
    }

    const driverInstance = window.driver.js.driver({
        ...DRIVER_CONFIG,
        steps: buildSteps()
    });

    // Block stray clicks while the help panel finishes closing.
    const blocker = document.getElementById('blocker');
    if (blocker) blocker.style.display = 'block';

    setTimeout(() => {
        if (blocker) blocker.style.display = 'none';
        driverInstance.drive();
    }, delay);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Whether a guided tour exists for the given screen.
 * @param {string} context — help context, e.g. 'drawing' or 'summary'
 * @returns {boolean}
 */
export function hasScreenTour(context) {
    return context in TOUR_STEPS;
}

/**
 * Start the guided tour for the given screen.
 *
 * @param {'drawing'|'summary'} context
 * @param {number} [delay=350] — ms to wait first; the default lets the help
 *                               panel's 300 ms close animation finish so the
 *                               highlighted controls are not covered.
 */
export function runScreenTour(context, delay = 350) {
    const buildSteps = TOUR_STEPS[context];
    if (!buildSteps) {
        console.warn(`No guided tour for context: ${context}`);
        return;
    }
    runSequence(buildSteps, delay);
}

/**
 * Full form only: run the drawing tour automatically, once per session.
 * Call after the participant has picked a region on their first visit to the
 * drawing screen, so the drawing controls are visible.
 */
export function runDrawingTourOnce() {
    if (isDrawingOnly() || hasShown(DRAWING_TOUR_SHOWN_KEY)) return;
    markShown(DRAWING_TOUR_SHOWN_KEY);
    runSequence(buildDrawingSteps, 1500);
}

/**
 * Full form only: run the summary tour automatically, once per session.
 * Call when the participant lands on the summary with at least one area and
 * the general questionnaire not yet submitted.
 */
export function runSummaryTourOnce() {
    if (isDrawingOnly() || hasShown(SUMMARY_TOUR_SHOWN_KEY)) return;
    markShown(SUMMARY_TOUR_SHOWN_KEY);
    runSequence(buildSummarySteps, 500);
}
