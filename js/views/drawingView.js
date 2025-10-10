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
    statusBar.innerHTML = `<span style="font-size: var(--h2-font-size)">Add ONE of your main areas of pain or symptom at a time. Click "Add Next Area" to add the next one</span>
      <span style="font-size: var(--min-font-size);color: var(--primary-color)">You are drawing Area #${current}</span>
      `;
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
  prevAreaButton.classList.add('button', 'button-secondary', 'button-drawing-nav');

  const nextAreaButton = document.createElement('button');
  nextAreaButton.id = 'next-drawing';
  nextAreaButton.textContent = 'Add Next Area';
  nextAreaButton.classList.add('button', 'button-primary', 'button-drawing-nav');

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
    prevAreaButton,
    nextAreaButton,
    continueButton,
    statusBar,
    updateStatusBar
  };
}
