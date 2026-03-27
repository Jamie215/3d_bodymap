// tooltipSteps.js
// Driver.js tooltip step definitions, extracted from main.js.
// Pure data — no DOM manipulation or Driver.js instantiation.

/**
 * Steps shown the first time a user enters the drawing view.
 * Highlights: region selector, draw/erase tools, brush size, rotation, zoom.
 */
export const DRAWING_STEPS = [
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
];

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