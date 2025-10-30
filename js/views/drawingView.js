// drawingView.js
import { createDrawingControls } from '../components/drawingControls.js';
import { createViewControls } from '../components/viewControls.js';
import AppState from '../app/state.js';

export function createDrawingViewElements(controls) {
  const drawingView = document.createElement('div');
  drawingView.id = 'drawing-view';

  const drawingMainRow = document.createElement('div');
  drawingMainRow.style.display = 'flex';
  drawingMainRow.style.flex = '1';

  const drawingControlsPanel = document.createElement('div');
  drawingControlsPanel.id = 'drawing-control-panel';

  const drawingCanvasPanel = document.createElement('div');
  drawingCanvasPanel.id = 'drawing-canvas-panel';

  const viewControlsPanel = document.createElement('div');
  viewControlsPanel.id = 'view-control-panel';

  const statusBar = document.createElement('div');
  statusBar.id = 'drawing-status-bar';

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
      statusBar.innerHTML = `<div style="display: flex; justify-content: center; margin-top: 4px;">
          <span style="font-size: var(--min-font-size); color: ${colour}; background-color: ${bgColour}; padding: 0.5rem 1rem; border-radius: 3rem; font-weight: 600; width: fit-content;">You are drawing Area #${current}</span>
        </div>`;
    } else {
      statusBar.innerHTML = `<span style="font-size: var(--h2-font-size); font-weight: 600;">Add ONE of your main areas of pain or symptom at a time. Click "Add Next Area" to add the next one.</span>
        <div style="display: flex; justify-content: center; margin-top: 4px;">
          <span style="font-size: var(--min-font-size); color: ${colour}; background-color: ${bgColour}; padding: 0.5rem 1rem; border-radius: 3rem; font-weight: 600; width: fit-content;">You are drawing Area #${current}</span>
        </div>
        `;
    }
  }
  
  updateStatusBar();

  const drawingFooter = document.createElement('div');
  drawingFooter.id = 'footer-drawing';
  drawingFooter.classList.add('footer');

  const drawingNavContainer = document.createElement('div');
  drawingNavContainer.classList.add('drawing-nav');

  const prevAreaButton = document.createElement('button');
  prevAreaButton.id = 'previous-drawing'
  prevAreaButton.textContent = '← Previous Area'
  prevAreaButton.classList.add('button', 'button-prev-nav', 'button-drawing-center');

  const nextAreaButton = document.createElement('button');
  nextAreaButton.id = 'next-drawing';
  nextAreaButton.textContent = 'Add Next Area';
  nextAreaButton.classList.add('button', 'button-primary', 'button-drawing-center');

  const continueButton = document.createElement('button');
  continueButton.textContent = "I've Added All Areas";
  continueButton.classList.add('button', 'button-success');

  drawingNavContainer.appendChild(prevAreaButton);
  drawingNavContainer.appendChild(nextAreaButton);
  drawingFooter.appendChild(drawingNavContainer);
  drawingFooter.appendChild(continueButton);

  createDrawingControls(drawingControlsPanel);
  createViewControls(controls, viewControlsPanel);

  return {
    root: drawingView,
    drawingControlsPanel,
    drawingCanvasPanel,
    viewControlsPanel,
    drawingFooter,
    drawingNavContainer,
    prevAreaButton,
    nextAreaButton,
    continueButton,
    statusBar,
    updateStatusBar
  };
}
