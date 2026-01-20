// drawingView.js - Updated for 2-column layout with footer buttons
// Left: Drawing controls, Center: Canvas, Footer: Change View + Done Drawing
import { createDrawingControls } from '../components/drawingControls.js';
import AppState from '../app/state.js';

export function createDrawingViewElements(controls) {
    const drawingView = document.createElement('div');
    drawingView.id = 'drawing-view';

    // Drawing controls panel (will go in slot-left)
    const drawingControlsPanel = document.createElement('div');
    drawingControlsPanel.id = 'drawing-control-panel';

    // Canvas panel
    const drawingCanvasPanel = document.createElement('div');
    drawingCanvasPanel.id = 'drawing-canvas-panel';

    // Status bar (header content)
    const statusBar = document.createElement('div');
    statusBar.id = 'drawing-status-bar';

    // Header container - just status bar, no cancel button
    const headerContent = document.createElement('div');
    headerContent.id = 'drawing-header-content';
    headerContent.appendChild(statusBar);

    function updateStatusBar() {
        const current = AppState.currentDrawingIndex + 1;
        const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
        const colour = currentInstance?.colour;

        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 0, g: 0, b: 0 };
        };

        const rgb = hexToRgb(colour);
        const bgColour = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.075)`;

        if (AppState.isEditingFromSurvey) {
            statusBar.innerHTML = `
                <div class="status-bar-content">
                    <span class="status-badge" style="color: ${colour}; background-color: ${bgColour};">
                        Editing Area #${current}
                    </span>
                    <span class="status-instruction">
                        Make your changes, then click "Done Editing" to return to the questionnaire.
                    </span>
                </div>
            `;
        } else {
            statusBar.innerHTML = `
                <div class="status-bar-content">
                    <span class="status-title">Draw your pain or symptom area on the body model</span>
                    <span class="status-badge" style="color: ${colour}; background-color: ${bgColour};">
                        Area #${current}
                    </span>
                    <span class="status-instruction">
                        After drawing, you'll answer questions about this specific area.
                    </span>
                </div>
            `;
        }
    }
    
    updateStatusBar();

    // Footer with left and right sections
    const drawingFooter = document.createElement('div');
    drawingFooter.id = 'footer-drawing';
    drawingFooter.classList.add('footer');

    // Left side of footer - "Change the View" button container
    const footerLeft = document.createElement('div');
    footerLeft.className = 'footer-left';
    
    // Right side of footer - "Done Drawing" button
    const footerRight = document.createElement('div');
    footerRight.className = 'footer-right';

    // Main action button - Done Drawing
    const continueButton = document.createElement('button');
    continueButton.id = 'continue-to-survey';
    continueButton.textContent = 'Done Drawing';
    continueButton.classList.add('button', 'button-primary', 'button-done-drawing');

    footerRight.appendChild(continueButton);
    
    drawingFooter.appendChild(footerLeft);
    drawingFooter.appendChild(footerRight);

    // Drawing nav container (legacy, for compatibility)
    const drawingNavContainer = document.createElement('div');
    drawingNavContainer.classList.add('drawing-nav');
    drawingNavContainer.style.display = 'none';

    // Cancel button (hidden, but kept for appController compatibility)
    const cancelButton = document.createElement('button');
    cancelButton.id = 'cancel-drawing';
    cancelButton.style.display = 'none';

    // Initialize drawing controls
    createDrawingControls(drawingControlsPanel);

    // Add styles for the layout
    const style = document.createElement('style');
    style.textContent = `
        /* Drawing footer specific styles */
        #footer-drawing {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            padding: var(--space-md, 1rem) var(--space-lg, 1.5rem);
            gap: var(--space-md, 1rem);
        }

        #footer-drawing .footer-left,
        #footer-drawing .footer-right {
            display: flex;
            align-items: center;
        }

        /* Tablet and mobile adjustments */
        @media (max-width: 768px) {
            #footer-drawing {
                padding: var(--space-sm, 0.75rem) var(--space-md, 1rem);
            }
        }

        @media (max-width: 480px) {
            #footer-drawing {
                flex-direction: row;
                gap: var(--space-sm, 0.5rem);
            }
            
            #footer-drawing .button {
                padding: var(--space-sm, 0.75rem);
                font-size: 0.85rem;
            }
        }
    `;
    
    // Only add styles if not already present
    if (!document.getElementById('drawing-view-styles')) {
        style.id = 'drawing-view-styles';
        document.head.appendChild(style);
    }

    return {
        root: drawingView,
        drawingControlsPanel,      // Goes in slot-left
        drawingCanvasPanel,
        headerContent,             // Goes in slot-header (just status bar)
        footerLeft,                // Container for "Change the View" button
        footerRight,               // Container for "Done Drawing" button
        continueButton,            // Main action button (Done Drawing)
        cancelButton,              // Hidden, for compatibility
        drawingFooter,             // Footer element
        drawingNavContainer,       // Legacy, hidden
        statusBar,
        updateStatusBar
    };
}