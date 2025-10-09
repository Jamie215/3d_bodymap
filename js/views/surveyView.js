// surveyView.js
import AppState from '../app/state.js';

export function createSurveyViewElements() {
  const surveyView = document.createElement('div');
  surveyView.id = 'survey-view';

  const surveyPanel = document.createElement('div');
  surveyPanel.id = 'survey-panel';

  const surveyInnerContainer = document.createElement('div');
  surveyInnerContainer.id = 'survey-inner';

  const prevButton = document.createElement('button');
  prevButton.textContent = '← Previously Drawn Area';
  prevButton.classList.add('button', 'button-secondary', 'return-button');

  const statusBar = document.createElement('div');
  statusBar.id = 'survey-status-bar';

  function updateStatusBar() {
    const current = AppState.currentDrawingIndex + 1;
    const total = AppState.drawingInstances.length;
    statusBar.innerHTML = `
      <span style="font-size: var(--min-font-size);color: var(--primary-color)"> Area ${current} of ${total}</span>
      `;
  }

  surveyPanel.appendChild(statusBar);
  surveyPanel.appendChild(prevButton);
  surveyPanel.appendChild(surveyInnerContainer);
  surveyView.appendChild(surveyPanel);

  return {
    root: surveyView,
    surveyPanel,
    surveyInnerContainer,
    prevButton,
    statusBar,
    updateStatusBar
  };
}
