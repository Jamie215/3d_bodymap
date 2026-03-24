// modals/deleteAreaModal.js
// Confirms deletion of a logged pain/symptom area from the summary view.

import { createModal, createModalContent, createButton, createButtonGroup } from './modalBase.js';

let deleteAreaModalEl = null;
let deleteAreaText = null;
let deleteAreaReturnButton = null;
let deleteAreaConfirmButton = null;
let onDeleteAreaConfirm = null;

export function initDeleteAreaModal(container) {
    deleteAreaModalEl = createModal('delete-area-modal');
    const modalContent = createModalContent();

    deleteAreaText = document.createElement('h2');
    deleteAreaText.id = 'delete-area-text';

    deleteAreaReturnButton = createButton('delete-area-return', 'Cancel');
    deleteAreaConfirmButton = createButton('delete-area-confirm', 'Delete');

    const buttonGroup = createButtonGroup(deleteAreaReturnButton, deleteAreaConfirmButton);

    modalContent.appendChild(deleteAreaText);
    modalContent.appendChild(buttonGroup);
    deleteAreaModalEl.appendChild(modalContent);
    container.appendChild(deleteAreaModalEl);

    // Wire button handlers once during init
    deleteAreaReturnButton.addEventListener('click', () => {
        hideDeleteAreaModal();
    });

    deleteAreaConfirmButton.addEventListener('click', () => {
        const callback = onDeleteAreaConfirm;
        hideDeleteAreaModal();
        if (callback) callback();
    });
}

/**
 * Show the delete-area confirmation modal.
 *
 * @param {string}   message    Text shown in the modal body
 * @param {Function} onConfirm  Called if the user clicks "Delete"
 */
export function showDeleteAreaModal(message, onConfirm) {
    deleteAreaText.textContent = message;
    onDeleteAreaConfirm = onConfirm || null;
    deleteAreaModalEl.style.display = 'flex';
}

export function hideDeleteAreaModal() {
    deleteAreaModalEl.style.display = 'none';
    onDeleteAreaConfirm = null;
}

export function getDeleteAreaElements() {
    return { deleteAreaReturnButton, deleteAreaConfirmButton };
}