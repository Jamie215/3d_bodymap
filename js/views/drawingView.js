// drawingView.js
import { createDrawingControls } from '../components/drawingControls.js';
import { createViewControls } from '../components/viewControls.js';

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
  statusBar.innerHTML = 'Add ONE of your main areas of pain or symptom at a time';

  const drawingFooter = document.createElement('div');
  drawingFooter.id = 'footer-drawing';
  drawingFooter.classList.add('footer');

  const continueButton = document.createElement('button');
  continueButton.id = 'continue-drawing';
  continueButton.textContent = 'Go to Area Questions';
  continueButton.classList.add('button', 'button-primary');
  drawingFooter.appendChild(continueButton);

  drawingMainRow.appendChild(drawingControlsPanel);
  drawingMainRow.appendChild(drawingCanvasPanel);
  drawingMainRow.appendChild(viewControlsPanel);

  drawingView.appendChild(statusBar);
  drawingView.appendChild(drawingMainRow);
  drawingView.appendChild(drawingFooter);

  createDrawingControls(drawingControlsPanel);
  createViewControls(controls, viewControlsPanel);

  return {
    root: drawingView,
    drawingControlsPanel,
    drawingCanvasPanel,
    viewControlsPanel,
    drawingFooter,
    continueButton,
    statusBar
  };
}
