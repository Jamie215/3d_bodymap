// views/summaryView.js
import AppState from '../app/state.js';

export function createSummaryView() {
  const modelSummaryView = document.createElement('div');
  modelSummaryView.id = 'model-summary-view';

  const summaryStatusPanel = document.createElement('div');
  summaryStatusPanel.id = 'summary-status-panel';

  const changeModelButton = document.createElement('button');
  changeModelButton.id = 'change-model-button';
  changeModelButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
    </svg>
    <span>Change My Body Type</span>
    `;
  changeModelButton.classList.add('button');

  const summaryFooter = document.createElement('div');
  summaryFooter.id = 'footer-summary';
  summaryFooter.classList.add('footer');

  const addNewInstanceButton = document.createElement('button');
  addNewInstanceButton.id = 'add-new-instance-summary';
  addNewInstanceButton.textContent = 'Add a New Pain or Symptom';
  addNewInstanceButton.classList.add('button', 'button-primary');

  const summaryDoneButton = document.createElement('button');
  summaryDoneButton.textContent = 'Done';
  summaryDoneButton.classList.add('button', 'button-secondary');
  summaryDoneButton.disabled = true;
  summaryDoneButton.style.marginRight = '5%';

  summaryFooter.appendChild(addNewInstanceButton);
  summaryFooter.appendChild(summaryDoneButton);

  modelSummaryView.appendChild(summaryStatusPanel);
  modelSummaryView.appendChild(summaryFooter);

  function updateSummaryStatus() {
    const count = AppState.drawingInstances.length;
    summaryStatusPanel.innerHTML = count > 0
      ? `<p>You have <span style="color: var(--primary-color); font-weight: bold;">${count}</span> pain or symptom(s) logged.</p>`
      : `<p>You currently don’t have any pain or symptoms logged.</br></br>You will be prompted to add each area of pain or symptom in turn. Select <span style="font-weight: bold;">"Add a New Pain or Symptom"</span> to start.</p>`;
    summaryDoneButton.disabled = count === 0;
  }

  return {
    root: modelSummaryView,
    updateStatus: updateSummaryStatus,
    summaryStatusPanel,
    changeModelButton,
    addNewInstanceButton,
    summaryDoneButton
  };
}
