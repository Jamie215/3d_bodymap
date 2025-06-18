// modal.js
let modalEl, modalText, modalContinueButton, modalReturnButton, drawingPreview, resetModalEl, resetReturnButton, resetConfirmButton, resetModalText;

export function initDrawContinueModal(container) {
  // Create modal container
  modalEl = document.createElement('div');
  modalEl.id = 'confirmation-modal';
  modalEl.style.display = 'none';
  modalEl.classList.add('modal');

  const modalContent = document.createElement('div');
  modalContent.classList.add('modal-content');

  modalText = document.createElement('h2');
  modalText.id = 'modal-text';

  drawingPreview = document.createElement('img');
  drawingPreview.id = 'drawing-preview';
  drawingPreview.classList.add('drawing-preview');

  const buttonGroup = document.createElement('div');
  buttonGroup.classList.add('modal-button-group');

  modalReturnButton = document.createElement('button');
  modalReturnButton.id = 'modal-return';
  modalReturnButton.classList.add('modal-button');
  modalReturnButton.innerText = 'No, Return to My Drawing';

  modalContinueButton = document.createElement('button');
  modalContinueButton.id = 'modal-continue';
  modalContinueButton.classList.add('modal-button');
  modalContinueButton.innerText = 'Yes, Proceed';

  buttonGroup.appendChild(modalReturnButton);
  buttonGroup.appendChild(modalContinueButton);

  modalContent.appendChild(modalText);
  modalContent.appendChild(drawingPreview);
  modalContent.appendChild(buttonGroup);
  modalEl.appendChild(modalContent);
  container.appendChild(modalEl);
}

export function initDrawResetModal(container) {
  // Create modal container
  resetModalEl = document.createElement('div');
  resetModalEl.id = 'confirmation-modal';
  resetModalEl.style.display = 'none';
  resetModalEl.classList.add('modal');

  const resetModalContent = document.createElement('div');
  resetModalContent.classList.add('modal-content');

  resetModalText = document.createElement('h2');
  resetModalText.id = 'modal-text';
  resetModalText.textContent = 'Are you sure you want to erase all of your current drawing?';

  const resetButtonGroup = document.createElement('div');
  resetButtonGroup.classList.add('modal-button-group');

  resetReturnButton = document.createElement('button');
  resetReturnButton.id = 'modal-return';
  resetReturnButton.classList.add('modal-button');
  resetReturnButton.innerText = 'No, return to my drawing';

  resetConfirmButton = document.createElement('button');
  resetConfirmButton.id = 'modal-reset';
  resetConfirmButton.classList.add('modal-button');
  resetConfirmButton.innerText = 'Yes, reset my drawing';

  resetButtonGroup.appendChild(resetReturnButton);
  resetButtonGroup.appendChild(resetConfirmButton);

  resetModalContent.appendChild(resetModalText);
  resetModalContent.appendChild(resetButtonGroup);
  resetModalEl.appendChild(resetModalContent);
  container.appendChild(resetModalEl);
}

export function getModalElements(modalType) {
  if (modalType === "continue") {
    return {
      modalContinueButton,
      modalReturnButton
    };
  } else {
    return {
      resetReturnButton,
      resetConfirmButton
    };
  }
}

export function showDrawContinueModal(text, previewVisible, previewDataURL = null) {
  modalText.textContent = text;
  modalContinueButton.disabled = !previewVisible;
  modalContinueButton.classList.toggle('disabled', !previewVisible);

  if (previewVisible && previewDataURL) {
    drawingPreview.src = previewDataURL;
    drawingPreview.style.display = 'block';
  } else {
    drawingPreview.style.display = 'none';
  }

  modalEl.style.display = 'flex';
}

export function hideDrawContinueModal() {
  modalEl.style.display = 'none';
}

export function showDrawResetModal() {
  resetModalEl.style.display = 'flex';
}

export function hideDrawResetModal() {
  resetModalEl.style.display = 'none';
}