// modals/sessionResetModal.js
// Shown once on startup after a session has ended and the app reloaded to a
// clean front page (see endSession() in drawingInstanceManager). It tells the
// participant what happened — their assessment was completed, or the session
// was reset for inactivity — before they begin. Dismissing it reveals the
// (already fresh) front page.

import { createModal, createModalContent } from './modalBase.js';

let sessionResetModalEl = null;
let titleEl   = null;
let messageEl = null;
let dismissButton = null;

const VARIANTS = {
    complete: {
        title: 'Assessment complete',
        message: 'Thank you for completing your pain and symptom assessment.',
        button: 'Start a new session'
    },
    idle: {
        title: 'Session reset',
        message: 'You can start again from the beginning.',
        button: 'Start a new session'
    }
};

export function initSessionResetModal(container) {
    sessionResetModalEl = createModal('session-reset-modal');
    const modalContent = createModalContent();

    titleEl = document.createElement('h2');
    titleEl.id = 'session-reset-title';
    titleEl.className = 'modal-title';

    messageEl = document.createElement('p');
    messageEl.id = 'session-reset-message';
    messageEl.className = 'modal-subtitle';

    dismissButton = document.createElement('button');
    dismissButton.id = 'session-reset-dismiss';
    dismissButton.className = 'modal-btn-primary';
    dismissButton.addEventListener('click', hideSessionResetModal);

    modalContent.appendChild(titleEl);
    modalContent.appendChild(messageEl);
    modalContent.appendChild(dismissButton);
    sessionResetModalEl.appendChild(modalContent);
    container.appendChild(sessionResetModalEl);
}

/**
 * Show the modal for the given end-of-session reason.
 * @param {'complete'|'idle'} reason
 */
export function showSessionResetModal(reason) {
    if (!sessionResetModalEl) return;
    const variant = VARIANTS[reason] || VARIANTS.idle;
    titleEl.textContent   = variant.title;
    messageEl.textContent = variant.message;
    dismissButton.textContent = variant.button;
    sessionResetModalEl.style.display = 'flex';
}

export function hideSessionResetModal() {
    if (sessionResetModalEl) sessionResetModalEl.style.display = 'none';
}
