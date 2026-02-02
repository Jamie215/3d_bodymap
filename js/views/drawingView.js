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
        console.log("under updateStatusBar, selectedRegion:", AppState.selectedRegion);
        const selectedRegion = AppState.selectedRegion || 'Entire Body';

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
                    <span class="status-title"><i class="fa-solid fa-paintbrush"></i> Make your changes, then click "Done Editing" to return to the questionnaire</span>
                    <span class="status-badge" style="color: ${colour}; background-color: ${bgColour};">
                        Editing Area #${current}
                    </span>
                </div>
            `;
        } else {
            statusBar.innerHTML = `
                <div class="status-bar-content">
                    <span class="status-title"><i class="fa-solid fa-paintbrush"></i> Draw your pain or symptom area on the body</span>
                    <span class="status-badge" style="color: ${colour}; background-color: ${bgColour};">
                        You are currently viewing: <strong>${selectedRegion}</strong>
                    </span>
                </div>
            `;
        }
    }
    
    updateStatusBar();

    // Footer with left, right, and right sections
    const drawingFooter = document.createElement('div');
    drawingFooter.id = 'footer-drawing';
    drawingFooter.classList.add('footer');

    // Left side of footer - "Change the View" button container
    const footerLeft = document.createElement('div');
    footerLeft.className = 'footer-left';

    // Center of footer - Zoom In/Out Message
    const footerCenter = document.createElement('div');
    footerCenter.className = 'footer-center';
    footerCenter.innerHTML = `<?xml version="1.0" encoding="UTF-8"?><svg width="1.5rem" height="1.5rem" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#6b7280"><path d="M12 5L12.5303 4.46967C12.2374 4.17678 11.7626 4.17678 11.4697 4.46967L12 5ZM12 13L11.4697 13.5303C11.7626 13.8232 12.2374 13.8232 12.5303 13.5303L12 13ZM9.46967 6.46967C9.17678 6.76256 9.17678 7.23744 9.46967 7.53033C9.76256 7.82322 10.2374 7.82322 10.5303 7.53033L9.46967 6.46967ZM13.4697 7.53033C13.7626 7.82322 14.2374 7.82322 14.5303 7.53033C14.8232 7.23744 14.8232 6.76256 14.5303 6.46967L13.4697 7.53033ZM10.5303 10.4697C10.2374 10.1768 9.76256 10.1768 9.46967 10.4697C9.17678 10.7626 9.17678 11.2374 9.46967 11.5303L10.5303 10.4697ZM14.5303 11.5303C14.8232 11.2374 14.8232 10.7626 14.5303 10.4697C14.2374 10.1768 13.7626 10.1768 13.4697 10.4697L14.5303 11.5303ZM3.25 10V14H4.75V10H3.25ZM20.75 14V10H19.25V14H20.75ZM11.25 5V13H12.75V5H11.25ZM11.4697 4.46967L9.46967 6.46967L10.5303 7.53033L12.5303 5.53033L11.4697 4.46967ZM11.4697 5.53033L13.4697 7.53033L14.5303 6.46967L12.5303 4.46967L11.4697 5.53033ZM12.5303 12.4697L10.5303 10.4697L9.46967 11.5303L11.4697 13.5303L12.5303 12.4697ZM12.5303 13.5303L14.5303 11.5303L13.4697 10.4697L11.4697 12.4697L12.5303 13.5303ZM20.75 10C20.75 5.16751 16.8325 1.25 12 1.25V2.75C16.0041 2.75 19.25 5.99594 19.25 10H20.75ZM12 22.75C16.8325 22.75 20.75 18.8325 20.75 14H19.25C19.25 18.0041 16.0041 21.25 12 21.25V22.75ZM3.25 14C3.25 18.8325 7.16751 22.75 12 22.75V21.25C7.99594 21.25 4.75 18.0041 4.75 14H3.25ZM4.75 10C4.75 5.99594 7.99594 2.75 12 2.75V1.25C7.16751 1.25 3.25 5.16751 3.25 10H4.75Z" fill="#6b7280"></path></svg><span class="status-instruction">Use your mouse wheel or pinch to zoom in/out on the model</span>`;

    // Right side of footer - "Done Drawing" button container
    const footerRight = document.createElement('div');
    footerRight.className = 'footer-right';

    // Main action button - Done Drawing
    const continueButton = document.createElement('button');
    continueButton.id = 'continue-to-survey';
    continueButton.textContent = 'Done Drawing';
    continueButton.classList.add('button', 'button-primary', 'button-done-drawing');

    footerRight.appendChild(continueButton);
    
    drawingFooter.appendChild(footerLeft);
    drawingFooter.appendChild(footerCenter);
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