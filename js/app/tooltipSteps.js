// tooltipSteps.js
// Driver.js tooltip step definitions, extracted from main.js.
// Pure data — no DOM manipulation or Driver.js instantiation,
// with one exception: the marker-size step uses Driver.js's own
// onHighlightStarted / onDeselected callbacks to open the size
// popover on touch viewports. This is a step-level lifecycle hook,
// not free-floating DOM work.

// ============================================================================
// MARKER SIZE STEP
// ============================================================================
//
// On desktop and tablet landscape the slider lives inline in the drawing
// controls panel (vertical on desktop, horizontal in the tablet toolbar).
// On mobile and tablet portrait it lives in a popover triggered by a
// chevron inside the Draw button.
//
// To keep the tooltip pointing at the actual slider on every viewport,
// the step uses Driver.js's `onHighlightStarted` to open the popover
// before highlighting, and `onDeselected` to close it again when the
// user advances. The slider DOM is the same element in both cases —
// only its location and visibility differ.

// ============================================================================
// MARKER SIZE STEPS
// ============================================================================
//
// Touch viewports get two steps:
//   1. Chevron — "tap this arrow." Pulses for emphasis, popover stays closed.
//   2. Slider — opened by step 2's onHighlightStarted, tooltip points at it.
//
// Desktop / tablet landscape get a single step targeting the inline slider —
// same as the original tooltip behaviour, since there's no chevron to gesture
// at and no popover to open.

function buildMarkerSizeChevronStep() {
    return {
        element: '.button-draw-control.button-primary .marker-size-trigger',
        popover: {
            title: 'Marker Size',
            description: 'Tap this arrow to open a slider for adjusting your brush or eraser size.',
            side: 'bottom',
            align: 'center'
        },
        onHighlightStarted: () => {
            const api = window.__markerSizePopover;
            if (!api) return;

            // Make sure the popover isn't lingering from anywhere else.
            api.close();

            // Draw the user's eye to the chevron with a one-shot pulse.
            api.pulseChevron();
        }
    };
}

function buildMarkerSizeInlineStep() {
    return {
        element: '.vertical-slider-container',
        popover: {
            title: 'Marker Size',
            description: 'Drag the slider to adjust how large or small your brush or eraser is.',
            side: 'right',
            align: 'center'
        }
    };
}

/**
 * Steps shown the first time a user enters the drawing view.
 * Highlights: region selector, draw/erase tools, brush size, rotation, zoom.
 *
 * Built as a function (rather than a static const) so the marker-size
 * portion of the sequence can vary by viewport — touch devices get a
 * two-step (chevron, then slider) walkthrough; desktop and tablet
 * landscape get a single inline-slider step.
 *
 * @returns {Array} Driver.js step definitions
 */
export function buildDrawingSteps() {
    const isPopoverMode = window.matchMedia(
        '(max-width: 1023px) and (orientation: portrait), (max-width: 767px)'
    ).matches;

    const markerSteps = isPopoverMode
        ? [buildMarkerSizeChevronStep()]
        : [buildMarkerSizeInlineStep()];

    return [
        {
            element: '#region-selector-footer-btn',
            popover: {
                title: 'Change Your Focus Area',
                description: 'Want to focus on a different part of the body? Click here to reopen the region selector.',
                side: 'top',
                align: 'start'
            }
        },
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
        ...markerSteps,
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
    ];
}

/**
 * Steps shown when the user returns to the summary view after
 * completing their first pain/symptom area.
 * Highlights: area card, add-more button, proceed button.
 */
export const RETURN_TO_SUMMARY_STEPS = [
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
            description: "Once you've added all your areas, click here to complete the general questionnaire and submit.",
            side: 'top',
            align: 'center'
        }
    }
];

/**
 * Shared Driver.js configuration used by all tooltip sequences.
 */

export const DRIVER_CONFIG = {
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    allowClose: true,
    overlayClickNext: false,
    stagePadding: 8,
    stageRadius: 8,
    disableActiveInteraction: true,
    popoverClass: 'app-tooltip'
};