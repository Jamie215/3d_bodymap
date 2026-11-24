// tooltipRunner.js
// Thin wrapper around Driver.js that runs the guided-tour tooltip sequences.
// Consumes step definitions from tooltipSteps.js.
//
// Tours never start on their own. The participant starts one from the Help
// panel ("Show me around this screen"), so they can replay it as often as they
// like. Because nothing runs automatically, there is no "already shown" state
// to track.

import { buildDrawingSteps, buildSummarySteps, DRIVER_CONFIG } from './tooltipSteps.js';

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
