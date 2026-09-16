// modals/idleWarningModal.js
// Inactivity warning shown by the idle timer (see js/utils/idleTimer.js).
// Gives the participant a chance to keep going before the session is reset
// and the app reloads — a shared-device privacy safeguard (REB #8), so an
// abandoned session does not leave one participant's answers on screen for
// the next person.

import { createModal, createModalContent } from './modalBase.js';

let idleWarningModalEl = null;
let countdownValueEl   = null;
let continueButton     = null;

export function initIdleWarningModal(container) {
    idleWarningModalEl = createModal('idle-warning-modal');
    const modalContent = createModalContent();

    const title = document.createElement('h2');
    title.id = 'idle-warning-title';
    title.className = 'modal-title';
    title.textContent = 'Are you still there?';

    const message = document.createElement('p');
    message.id = 'idle-warning-message';
    message.className = 'modal-subtitle';
    const countStrong = document.createElement('strong');
    countdownValueEl = countStrong;
    message.append(
        'For your privacy, this session will reset in ',
        countStrong,
        ' seconds.'
    );

    continueButton = document.createElement('button');
    continueButton.id = 'idle-warning-continue';
    continueButton.className = 'modal-btn-primary';
    continueButton.textContent = 'Continue session';

    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modalContent.appendChild(continueButton);
    idleWarningModalEl.appendChild(modalContent);
    container.appendChild(idleWarningModalEl);
}

export function showIdleWarningModal() {
    if (idleWarningModalEl) idleWarningModalEl.style.display = 'flex';
}

export function hideIdleWarningModal() {
    if (idleWarningModalEl) idleWarningModalEl.style.display = 'none';
}

/** Update the visible countdown (whole seconds remaining). */
export function setIdleWarningCountdown(seconds) {
    if (countdownValueEl) countdownValueEl.textContent = String(seconds);
}

/** Wire the "Continue session" button. */
export function setOnIdleWarningContinue(callback) {
    if (continueButton) continueButton.addEventListener('click', callback);
}
