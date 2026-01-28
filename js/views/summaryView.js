// views/summaryView.js - Updated for new workflow (Option A: all areas always complete)
import AppState from '../app/state.js';

export function createSummaryView() {
  const modelSummaryView = document.createElement('div');
  modelSummaryView.id = 'model-summary-view';

  const summaryStatusPanel = document.createElement('div');
  summaryStatusPanel.id = 'summary-status-panel';

  const changeModelButton = document.createElement('button');
  changeModelButton.id = 'change-model-button';
  changeModelButton.innerHTML = `
    <i class="fa-solid fa-person"></i>
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
  summaryDoneButton.id = 'summary-done-button';
  summaryDoneButton.textContent = 'Proceed to General Questionnaire';
  summaryDoneButton.classList.add('button', 'button-success');
  summaryDoneButton.disabled = true;

  summaryFooter.appendChild(addNewInstanceButton);
  summaryFooter.appendChild(summaryDoneButton);

  modelSummaryView.appendChild(summaryStatusPanel);
  modelSummaryView.appendChild(summaryFooter);

  // Store callbacks for edit/delete actions
  let onEditArea = null;
  let onDeleteArea = null;

  function setEditCallback(callback) {
    onEditArea = callback;
  }

  function setDeleteCallback(callback) {
    onDeleteArea = callback;
  }

  function updateSummaryStatus() {
    const count = AppState.drawingInstances.length;
    const isComplete = !!AppState.generalQuestionnaireResponse;

    if (isComplete) {
      // Session completed
      summaryStatusPanel.innerHTML = `
        <div class="summary-complete">
          <i class="fa-solid fa-circle-check" style="color: var(--success-color); font-size: var(--font-title-large);"></i>
          <span class="summary-title">Submission Complete</span>
          <p style="margin-top: var(--space-md);">Thank you for completing your pain assessment.</p>
          <p>You logged <strong>${count}</strong> pain or symptom area${count !== 1 ? 's' : ''}.</p>
        </div>
      `;
      summaryDoneButton.disabled = true;
      summaryDoneButton.style.display = 'none';
      addNewInstanceButton.style.display = 'none';
      return;
    }

    if (count === 0) {
      // No areas logged yet - show change model button
      changeModelButton.style.display = 'inline-flex';
      
      // No areas logged yet
      summaryStatusPanel.innerHTML = `
        <div class="summary-empty">
          <p>You currently don't have any pain or symptoms logged.</p>
          <p style="margin-top: var(--space-md);">Select <strong>"Add a New Pain or Symptom"</strong> to draw your first area on the body model.</p>
        </div>
      `;
      summaryDoneButton.disabled = true;
      return;
    }

    // Hide change model button when areas are logged
    changeModelButton.style.display = 'none';

    // Areas logged - show simple list with edit/delete options
    const areasHtml = AppState.drawingInstances.map((instance, index) => {
      const areaNum = index + 1;
      
      return `
        <div class="area-item" data-index="${index}">
          <div class="area-info">
            <span class="area-number" style="color: ${instance.colour || 'var(--primary-color)'}">
              Area #${areaNum}
            </span>
          </div>
          <div class="area-actions">
            <button class="area-edit-btn" data-index="${index}" title="Edit this area">
              <i class="fa-solid fa-user-pen"></i>
              Edit
            </button>
            <button class="area-delete-btn" data-index="${index}" title="Delete this area">
              <i class="fa-solid fa-trash"></i>
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    summaryStatusPanel.innerHTML = `
      <div class="summary-with-areas">
        <span class="summary-title">Your Pain/Symptom Areas</span>
        <p class="summary-instruction">You can add more areas or proceed to the general questionnaire.</p>
        <div class="areas-list">
          ${areasHtml}
        </div>
      </div>
    `;

    // Enable done button since we have at least one area
    summaryDoneButton.disabled = false;

    // Add event listeners to edit/delete buttons
    summaryStatusPanel.querySelectorAll('.area-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        if (onEditArea) onEditArea(index);
      });
    });

    summaryStatusPanel.querySelectorAll('.area-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        if (onDeleteArea) onDeleteArea(index);
      });
    });
  }

  return {
    root: modelSummaryView,
    updateSummaryStatus,
    summaryStatusPanel,
    summaryFooter,
    changeModelButton,
    addNewInstanceButton,
    summaryDoneButton,
    setEditCallback,
    setDeleteCallback
  };
}