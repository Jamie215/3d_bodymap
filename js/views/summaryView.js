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
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
    </svg>
    <span style="font-size: var(--min-font-size)">Change My Body Type</span>
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
          <div class="complete-icon">✓</div>
          <h2>Submission Complete</h2>
          <p>Thank you for completing your pain assessment.</p>
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
          <p style="margin-top: 1rem;">Select <strong>"Add a New Pain or Symptom"</strong> to draw your first area on the body model.</p>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
              </svg>
              Edit
            </button>
            <button class="area-delete-btn" data-index="${index}" title="Delete this area">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    summaryStatusPanel.innerHTML = `
      <div class="summary-with-areas">
        <h3>Your Pain/Symptom Areas</h3>
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

  // Add CSS styles for the summary panel
  const style = document.createElement('style');
  style.textContent = `
    .summary-empty, .summary-complete, .summary-with-areas {
      padding: 1rem;
    }

    .summary-complete {
      text-align: center;
    }

    .summary-complete .complete-icon {
      font-size: 3rem;
      color: var(--success-color, #10b981);
      margin-bottom: 1rem;
    }

    .summary-complete h2 {
      margin-bottom: 0.5rem;
      color: var(--success-color, #10b981);
    }

    .summary-with-areas h3 {
      margin-bottom: 0.5rem;
      font-size: var(--h3-font-size, 1.1rem);
    }

    .summary-instruction {
      color: var(--text-secondary, #6b7280);
      margin-bottom: 1rem;
    }

    .areas-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-height: 300px;
      overflow-y: auto;
    }

    .area-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--surface-color, #f9fafb);
      border-radius: 8px;
      border: 1px solid var(--border-color, #e5e7eb);
    }

    .area-info {
      display: flex;
      align-items: center;
    }

    .area-number {
      font-weight: 600;
      font-size: 1rem;
    }

    .area-actions {
      display: flex;
      gap: 0.5rem;
    }

    .area-edit-btn, .area-delete-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.85rem;
      border-radius: 4px;
      border: 1px solid var(--border-color, #e5e7eb);
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .area-edit-btn:hover {
      background: var(--primary-color-light, #e0f2fe);
      border-color: var(--primary-color, #0284c7);
    }

    .area-delete-btn:hover {
      background: var(--danger-color-light, #fee2e2);
      border-color: var(--danger-color, #ef4444);
      color: var(--danger-color, #ef4444);
    }

    .area-delete-btn:hover svg {
      stroke: var(--danger-color, #ef4444);
    }

    @media (max-width: 480px) {
      .area-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .area-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `;
  
  // Only add styles if not already present
  if (!document.getElementById('summary-view-styles')) {
    style.id = 'summary-view-styles';
    document.head.appendChild(style);
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