// surveyView.js - Updated version
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

  // Create the title element that will show "Area #X Questionnaire"
  const surveyTitle = document.createElement('h2');
  surveyTitle.id = 'survey-title';
  surveyTitle.style.width = '100%';
  surveyTitle.style.textAlign = 'center';
  surveyTitle.style.margin = '0';
  surveyTitle.style.padding = '1rem 0';

  // Edit button will be created separately for canvas panel
  const editDrawingButton = document.createElement('button');
  editDrawingButton.id = 'edit-drawing-button';
  editDrawingButton.classList.add('button', 'button-secondary');
  
  const editIcon = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
    </svg>
  `;
  editDrawingButton.innerHTML = editIcon + '<span>Edit Drawing</span>';
  editDrawingButton.style.alignItems = 'center';

  function updateTitle() {
    const current = AppState.currentSurveyIndex + 1;
    const titleText = `Area #${current} Questionnaire`;
    surveyTitle.textContent = titleText;
    
    // Also update the surveyJson title if it exists
    if (window.surveyInstance) {
      window.surveyInstance.title = titleText;
    }
  }

  updateTitle();

  // Only add the title to the header, not the button
  surveyHeader.appendChild(surveyTitle);

  const surveyFooter = document.createElement('div');
  surveyFooter.id = 'footer-survey';
  surveyFooter.classList.add('footer');

  const prevAreaButton = document.createElement('button');
  prevAreaButton.id = 'previous-drawing'
  prevAreaButton.textContent = '← Previous Area Questionnaire';
  prevAreaButton.classList.add('button', 'button-prev-nav');

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
    editDrawingButton, // Return it separately to be added to canvas panel
    prevAreaButton,
    nextAreaButton,
    updateTitle
  };
}