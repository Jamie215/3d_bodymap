// modals/deleteEmptyModal.js
// Warns the user when they try to navigate away from a blank drawing.

import { createModal, createModalContent, createButton, createButtonGroup } from './modalBase.js';

let deleteEmptyModalEl = null;
let deleteEmptyText = null;
let deleteEmptyReturnButton = null;
let deleteEmptyContinueButton = null;

export function initDeleteEmptyModal(container) {
    deleteEmptyModalEl = createModal('delete-empty-modal');
    const modalContent = createModalContent();

    deleteEmptyText = document.createElement('h2');
    deleteEmptyText.id = 'delete-empty-text';

    deleteEmptyReturnButton = createButton('delete-empty-return', 'Return to Drawing');
    deleteEmptyContinueButton = createButton('delete-empty-continue', 'Continue Anyway');

    const buttonGroup = createButtonGroup(deleteEmptyReturnButton, deleteEmptyContinueButton);

    modalContent.appendChild(deleteEmptyText);
    modalContent.appendChild(buttonGroup);
    deleteEmptyModalEl.appendChild(modalContent);
    container.appendChild(deleteEmptyModalEl);
}

export function showDeleteEmptyModal(message) {
    deleteEmptyText.textContent = message || "You haven't made a drawing yet. If you proceed, this area will be deleted.";
    deleteEmptyModalEl.style.display = 'flex';
}

export function hideDeleteEmptyModal() {
    deleteEmptyModalEl.style.display = 'none';
}

export function getDeleteEmptyElements() {
    return { deleteEmptyReturnButton, deleteEmptyContinueButton };
}