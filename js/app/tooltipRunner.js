// tooltipRunner.js
// Thin wrapper around Driver.js that runs tooltip sequences.
// Consumes step definitions from tooltipSteps.js.

import { buildDrawingSteps, RETURN_TO_SUMMARY_STEPS, DRIVER_CONFIG } from './tooltipSteps.js';

// Track which sequences have already been shown this session
let hasShownDrawingTooltips = false;
let hasShownReturnTooltips  = false;

// ============================================================================
// INTERNAL
// ============================================================================

/**
 * Create a Driver.js instance, merge the shared config with the
 * supplied steps, and drive after a short delay.
 *
 * Steps can be passed as an array, or as a builder function returning
 * an array (used by sequences whose targeting varies with viewport).
 *
 * @param {Object[]|Function} stepsOrBuilder
 * @param {number} delay — ms to wait before starting (default 500)
 */
function runSequence(stepsOrBuilder, delay = 500) {
    if (typeof window.driver === 'undefined' || !window.driver?.js?.driver) {
        console.warn('Driver.js not loaded — skipping tooltips');
        return;
    }

    const steps = typeof stepsOrBuilder === 'function'
        ? stepsOrBuilder()
        : stepsOrBuilder;

    const driverInstance = window.driver.js.driver({
        ...DRIVER_CONFIG,
        steps
    });

    setTimeout(() => driverInstance.drive(), delay);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Show the drawing-view tooltip sequence (once per session).
 * Call after the region-selector modal has closed and the drawing
 * controls are visible.
 */
export function runDrawingTooltips() {
    if (hasShownDrawingTooltips) return;
    hasShownDrawingTooltips = true;
    runSequence(buildDrawingSteps, 1500);
}

/**
 * Show the return-to-summary tooltip sequence (once per session).
 * Call when the user lands on the summary view with at least one
 * completed area and no general questionnaire submitted yet.
 */
export function runReturnToSummaryTooltips() {
    if (hasShownReturnTooltips) return;
    hasShownReturnTooltips = true;
    runSequence(RETURN_TO_SUMMARY_STEPS, 500);
}

/**
 * Query whether the drawing tooltips have already been triggered.
 * Useful inside setStage/drawing to decide whether to wire up
 * the one-time region-selected callback.
 */
export function haveDrawingTooltipsShown() {
    return hasShownDrawingTooltips;
}