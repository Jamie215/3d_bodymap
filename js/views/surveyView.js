// surveyView.js - Updated for new workflow
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
  editDrawingButton.classList.add('button');
  editDrawingButton.innerHTML =
    '<i class="fa-solid fa-user-pen"></i>' +
    '<span class="edit-btn-text-full">Edit Drawing</span>' +
    '<span class="edit-btn-text-short">Edit</span>';

  /**
   * Update the survey title using DOM construction.
   * The area number is set via textContent, never interpolated into markup.
   *
   * @param {'area'|'general'} type
   */
  function updateTitle(type = 'area') {
    surveyTitle.textContent = '';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-clipboard-list';

    if (type === 'general') {
      surveyTitle.append(icon, ' General Questionnaire');
    } else {
      const current = AppState.currentSurveyIndex + 1;
      surveyTitle.append(icon, ` Area #${current} Questionnaire`);
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

  const completeButton = document.createElement('button');
  completeButton.id = 'survey-complete';
  completeButton.textContent = 'Done';
  completeButton.classList.add('button', 'button-success');

  surveyPanel.appendChild(surveyHeader);
  surveyPanel.appendChild(surveyInnerContainer);
  surveyFooter.appendChild(completeButton);

  return {
    root: surveyView,
    surveyPanel,
    surveyHeader,
    surveyTitle,
    surveyInnerContainer,
    surveyFooter,
    editDrawingButton,
    completeButton,
    updateTitle,
    updateProgress
  };
}