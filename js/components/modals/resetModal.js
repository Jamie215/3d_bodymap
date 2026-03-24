// modals/resetModal.js
// "Erase All" confirmation — clears the current drawing instance.

import { createModal, createModalContent, createButton, createButtonGroup } from './modalBase.js';

let resetModalEl = null;
let resetModalText = null;
let resetReturnButton = null;
let resetConfirmButton = null;

export function initDrawResetModal(container) {
    resetModalEl = createModal('reset-modal');
    const modalContent = createModalContent();

    resetModalText = document.createElement('h2');
    resetModalText.id = 'reset-modal-text';
    resetModalText.textContent = 'Are you sure you want to reset your drawing?';

    resetReturnButton = createButton('modal-return-reset', 'Return to My Drawing');
    resetConfirmButton = createButton('modal-confirm-reset', 'Yes, Reset');

    const buttonGroup = createButtonGroup(resetReturnButton, resetConfirmButton);

    modalContent.appendChild(resetModalText);
    modalContent.appendChild(buttonGroup);
    resetModalEl.appendChild(modalContent);
    container.appendChild(resetModalEl);
}

export function showDrawResetModal() {
    resetModalEl.style.display = 'flex';
}

export function hideDrawResetModal() {
    resetModalEl.style.display = 'none';
}

export function getResetElements() {
    return { resetReturnButton, resetConfirmButton };
}