// surveyView.js
import AppState from '../app/state.js';

export function createSurveyViewElements() {
  const surveyView = document.createElement('div');
  surveyView.id = 'survey-view';

  const surveyPanel = document.createElement('div');
  surveyPanel.id = 'survey-panel';

  const surveyInnerContainer = document.createElement('div');
  surveyInnerContainer.id = 'survey-inner';

  const surveyHeader = document.createElement('div');
  surveyHeader.id = 'survey-header';

  const editDrawingButton = document.createElement('button');
  editDrawingButton.id = 'edit-drawing-button';
  editDrawingButton.classList.add('button', 'button-secondary');
  
  const editIcon = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
    </svg>
  `;
  editDrawingButton.innerHTML = editIcon + '<span>Edit Drawing</span>';
  editDrawingButton.style.display = 'inline-flex';
  editDrawingButton.style.alignItems = 'center';

  const surveyTitle = document.createElement('h2');
  surveyTitle.id = 'survey-title';

  function updateTitle() {
    const current = AppState.currentSurveyIndex + 1;
    surveyTitle.textContent = `Area #${current} Questionnaire`;
  }

  updateTitle();

  surveyHeader.appendChild(editDrawingButton);
  surveyHeader.appendChild(surveyTitle);

  const surveyFooter = document.createElement('div');
  surveyFooter.id = 'footer-survey';
  surveyFooter.classList.add('footer');

  const prevAreaButton = document.createElement('button');
  prevAreaButton.id = 'previous-drawing'
  prevAreaButton.textContent = '← Previous Area Questionnaire';
  prevAreaButton.classList.add('button', 'button-secondary', 'button-survey-nav');

  const nextAreaButton = document.createElement('button');
  nextAreaButton.id = 'next-drawing';
  nextAreaButton.textContent = 'Next Area Questionnaire';
  nextAreaButton.classList.add('button', 'button-primary', 'button-survey-nav');

  surveyPanel.appendChild(surveyHeader);
  surveyPanel.appendChild(surveyInnerContainer);
  surveyFooter.appendChild(prevAreaButton);
  surveyFooter.appendChild(nextAreaButton);

  return {
    root: surveyView,
    surveyPanel,
    surveyInnerContainer,
    surveyFooter,
    editDrawingButton,
    prevAreaButton,
    nextAreaButton,
    updateTitle
  };
}
