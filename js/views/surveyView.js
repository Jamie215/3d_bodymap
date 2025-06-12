// surveyView.js
export function createSurveyViewElements() {
  const surveyView = document.createElement('div');
  surveyView.id = 'survey-view';

  const surveyPanel = document.createElement('div');
  surveyPanel.id = 'survey-panel';

  const surveyInnerContainer = document.createElement('div');
  surveyInnerContainer.id = 'survey-inner';

  const returnDrawingButton = document.createElement('button');
  returnDrawingButton.innerHTML = '← Return to Drawing';
  returnDrawingButton.classList.add('button', 'button-secondary', 'return-button');

  surveyPanel.appendChild(returnDrawingButton);
  surveyPanel.appendChild(surveyInnerContainer);
  surveyView.appendChild(surveyPanel);

  return {
    root: surveyView,
    surveyPanel,
    surveyInnerContainer,
    returnDrawingButton
  };
}
