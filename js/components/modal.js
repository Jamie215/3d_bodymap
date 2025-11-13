// modal.js
// Continue/Survey Modal
let continueModalEl, continueModalText, continueModalButton, returnModalButton, drawingPreview;

// Reset Modal
let resetModalEl, resetModalText, resetReturnButton, resetConfirmButton;

// Delete Empty Modal
let deleteEmptyModalEl, deleteEmptyText, deleteEmptyReturnButton, deleteEmptyContinueButton;

// Helper to create modal structure
function createModal(id, className = 'modal') {
  const modal = document.createElement('div');
  modal.id = id;
  modal.style.display = 'none';
  modal.classList.add(className);
  return modal;
}

function createModalContent() {
  const content = document.createElement('div');
  content.classList.add('modal-content');
  return content;
}

function createButton(id, text, className = 'modal-button') {
  const button = document.createElement('button');
  button.id = id;
  button.classList.add(className);
  button.innerText = text;
  return button;
}

function createButtonGroup(...buttons) {
  const group = document.createElement('div');
  group.classList.add('modal-button-group');
  buttons.forEach(btn => group.appendChild(btn));
  return group;
}

export function initDrawContinueModal(container) {
  continueModalEl = createModal('confirmation-modal');
  const modalContent = createModalContent();

  continueModalText = document.createElement('h2');
  continueModalText.id = 'modal-text';

  drawingPreview = document.createElement('img');
  drawingPreview.id = 'drawing-preview';
  drawingPreview.classList.add('drawing-preview');

  returnModalButton = createButton('modal-return', 'Return to My Drawing');
  continueModalButton = createButton('modal-continue', 'Yes, Proceed');
  
  const buttonGroup = createButtonGroup(returnModalButton, continueModalButton);

  modalContent.appendChild(continueModalText);
  modalContent.appendChild(drawingPreview);
  modalContent.appendChild(buttonGroup);
  continueModalEl.appendChild(modalContent);
  container.appendChild(continueModalEl);
}

export function initDrawResetModal(container) {
  resetModalEl = createModal('reset-modal');
  const modalContent = createModalContent();

  resetModalText = document.createElement('h2');
  resetModalText.id = 'reset-modal-text';
  resetModalText.textContent = 'Are you sure you want to erase all of your current drawing?';

  resetReturnButton = createButton('modal-return-reset', 'Return to my drawing');
  resetConfirmButton = createButton('modal-reset-confirm', 'Reset my drawing');
  
  const buttonGroup = createButtonGroup(resetReturnButton, resetConfirmButton);
  resetConfirmButton.classList.add('button-danger');

  modalContent.appendChild(resetModalText);
  modalContent.appendChild(buttonGroup);
  resetModalEl.appendChild(modalContent);
  container.appendChild(resetModalEl);
}

export function initDeleteEmptyModal(container) {
  deleteEmptyModalEl = createModal('delete-empty-modal');
  const modalContent = createModalContent();

  deleteEmptyText = document.createElement('h2');
  deleteEmptyText.id = 'delete-empty-text';

  deleteEmptyReturnButton = createButton('delete-empty-return', 'Okay');
  deleteEmptyContinueButton = createButton('delete-empty-continue', 'Delete & Proceed');
  
  const buttonGroup = createButtonGroup(deleteEmptyReturnButton, deleteEmptyContinueButton);
  deleteEmptyContinueButton.classList.add('button-danger');

  modalContent.appendChild(deleteEmptyText);
  modalContent.appendChild(buttonGroup);
  deleteEmptyModalEl.appendChild(modalContent);
  container.appendChild(deleteEmptyModalEl);
}

export function getModalElements(modalType) {
  const modalMap = {
    continue: { continueButton: continueModalButton, returnButton: returnModalButton },
    reset: { resetReturnButton, resetConfirmButton },
    deleteEmpty: { deleteEmptyReturnButton, deleteEmptyContinueButton }
  };
  return modalMap[modalType] || {};
}

// Continue/Survey Modal functions
export function showMoveToSurveyModal(text, previewVisible, previewDataURL = null) {
  continueModalText.textContent = text;
  continueModalButton.style.display = previewVisible ? 'flex' : 'none';
  
  if (previewVisible && previewDataURL) {
    drawingPreview.src = previewDataURL;
    drawingPreview.style.display = 'block';
  } else {
    drawingPreview.style.display = 'none';
  }

  continueModalEl.style.display = 'flex';
}

export function hideDrawContinueModal() {
  continueModalEl.style.display = 'none';
}

// Reset Modal functions
export function showDrawResetModal() {
  resetModalEl.style.display = 'flex';
}

export function hideDrawResetModal() {
  resetModalEl.style.display = 'none';
}

// Delete Empty Modal functions
export function showDeleteEmptyModal(text) {
  deleteEmptyText.textContent = text;
  deleteEmptyModalEl.style.display = 'flex';

  if (text=="You haven't made a drawing yet. Please make one before adding another area.") {
    deleteEmptyContinueButton.style.display = 'none';
  } else {
    deleteEmptyContinueButton.style.display = 'flex';
  }
}

export function hideDeleteEmptyModal() {
  deleteEmptyModalEl.style.display = 'none';
}