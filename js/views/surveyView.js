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

  // Create progress bar
  const progressContainer = document.createElement('div');
  progressContainer.id = 'survey-progress-container';

  const progressBar = document.createElement('div');
  progressBar.id = 'survey-progress-bar';

  const progressFill = document.createElement('div');
  progressFill.id = 'survey-progress-fill';

  const progressText = document.createElement('span');
  progressText.id = 'survey-progress-text';
  progressText.textContent = '0 of 0 questions completed';

  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);

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

  function updateTitle(type='area') {
    if (type === 'general') {
      surveyTitle.textContent = 'General Questionnaire';
    } else {
      const current = AppState.currentSurveyIndex + 1;
      const titleText = `Area #${current} Questionnaire`;
      surveyTitle.textContent = titleText;
    }

    // Also update the surveyJson title if it exists
    if (window.surveyInstance) {
      window.surveyInstance.title = titleText;
    }
  }

  function initializeProgressSegments(total) {
    // Clear existing segments
    progressBar.innerHTML = '';
    
    // Create individual segments
    for (let i = 0; i < total; i++) {
      const segment = document.createElement('div');
      segment.className = 'progress-segment';
      segment.dataset.index = i;
      progressBar.appendChild(segment);
    }
  }

  function updateProgress(completed, total) {
    // Initialize segments if total changed
    const currentSegments = progressBar.querySelectorAll('.progress-segment').length;
    if (currentSegments !== total) {
      initializeProgressSegments(total);
    }
    
    // Update segment states
    const segments = progressBar.querySelectorAll('.progress-segment');
    segments.forEach((segment, index) => {
      if (index < completed) {
        segment.classList.add('completed');
      } else {
        segment.classList.remove('completed');
      }
    });
    
    // Update text
    progressText.textContent = `${completed} of ${total} Questions Completed`;
  }

  updateTitle();

  surveyHeader.appendChild(surveyTitle);
  surveyHeader.appendChild(progressContainer);

  const surveyFooter = document.createElement('div');
  surveyFooter.id = 'footer-survey';
  surveyFooter.classList.add('footer');

  const prevAreaButton = document.createElement('button');
  prevAreaButton.id = 'previous-drawing'
  prevAreaButton.textContent = '← Previous Area Questionnaire';
  prevAreaButton.classList.add('button', 'button-survey-prev-nav');

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
    updateTitle,
    updateProgress
  };
}