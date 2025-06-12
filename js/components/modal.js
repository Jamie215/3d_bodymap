// modal.js
let modalEl, modalText, modalContinueButton, modalReturnButton, drawingPreview;

export function initModal(container) {
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

export function getModalElements() {
  return {
    modalContinueButton,
    modalReturnButton
  };
}

export function showModal(text, previewVisible, previewDataURL = null) {
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

export function hideModal() {
  modalEl.style.display = 'none';
}