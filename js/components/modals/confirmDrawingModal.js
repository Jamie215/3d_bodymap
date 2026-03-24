// modals/confirmDrawingModal.js
// "Done Drawing" confirmation with drawing preview and 3-button layout:
//   Return to Home | Return to Drawing (X) | Yes, Proceed

import { createModal, createModalContent, createButton, createButtonGroup } from './modalBase.js';

let continueModalEl = null;
let continueModalText = null;
let continueModalButton = null;
let returnModalButton = null;
let returnToSummaryButton = null;
let drawingPreview = null;

export function initDrawContinueModal(container) {
    continueModalEl = createModal('confirmation-modal');
    const modalContent = createModalContent();

    // Close button (X) in top-right corner
    returnModalButton = document.createElement('button');
    returnModalButton.className = 'modal-close-btn';
    returnModalButton.innerHTML = '<i class="fa-solid fa-x"></i>';
    returnModalButton.setAttribute('aria-label', 'Return to Drawing');

    continueModalText = document.createElement('h2');
    continueModalText.id = 'modal-text';

    drawingPreview = document.createElement('img');
    drawingPreview.id = 'drawing-preview';
    drawingPreview.classList.add('drawing-preview');

    returnToSummaryButton = createButton('modal-return-summary', 'Return to Home');
    continueModalButton = createButton('modal-continue', 'Yes, Proceed');

    const buttonGroup = createButtonGroup(returnToSummaryButton, continueModalButton);

    modalContent.appendChild(returnModalButton);
    modalContent.appendChild(continueModalText);
    modalContent.appendChild(drawingPreview);
    modalContent.appendChild(buttonGroup);
    continueModalEl.appendChild(modalContent);
    container.appendChild(continueModalEl);
}

export function showMoveToSurveyModal(text, canProceed, previewDataURL = null, showReturnToSummary = false) {
    continueModalText.textContent = text;

    continueModalButton.style.display = canProceed ? 'flex' : 'none';
    returnToSummaryButton.style.display = showReturnToSummary ? 'flex' : 'none';

    if (previewDataURL) {
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

export function getConfirmDrawingElements() {
    return {
        continueButton: continueModalButton,
        returnButton: returnModalButton,
        returnToSummaryButton
    };
}