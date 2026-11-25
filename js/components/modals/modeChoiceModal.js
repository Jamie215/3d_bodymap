// modals/modeChoiceModal.js
// First screen of every session: the participant chooses between the full form
// (drawings + questionnaires) and drawing only. Shown before onboarding,
// because onboarding's steps depend on the choice.
//
// It cannot be dismissed without choosing (no close button, no Escape, no
// backdrop click), so no session starts without a mode. It only reports the
// choice through the callback; recording it is the caller's job (studyMode.js).
//
// Reuses the onboarding overlay's look (.onboarding-modal-*) so the two first
// screens feel like one sequence; only the option cards have their own styles.

import { STUDY_MODES } from '../../app/studyMode.js';

let overlayEl = null;
let onChosen  = null;

const OPTIONS = [
    {
        mode: STUDY_MODES.FULL,
        icon: 'fa-clipboard-list',
        title: 'Drawing + questionnaires',
        description: 'Draw each area, then answer questions about it.'
    },
    {
        mode: STUDY_MODES.DRAWING_ONLY,
        icon: 'fa-paintbrush',
        title: 'Drawing only',
        description: 'Draw your areas and save. No questionnaires.'
    }
];

export function initModeChoiceModal(container) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'onboarding-modal-overlay modal-overlay';
    overlayEl.id = 'mode-choice-overlay';
    overlayEl.style.display = 'none';

    const dialog = document.createElement('div');
    dialog.className = 'onboarding-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'mode-choice-title');
    // Focusable so it can take focus on open (see showModeChoiceModal).
    dialog.tabIndex = -1;

    const content = document.createElement('div');
    content.className = 'onboarding-modal-content';

    const title = document.createElement('h2');
    title.id = 'mode-choice-title';
    title.className = 'onboarding-modal-title';
    title.textContent = 'Pain & Symptom Assessment Form';

    const subtitle = document.createElement('p');
    subtitle.className = 'mode-choice-subtitle';
    subtitle.textContent = 'How would you like to continue?';

    const options = document.createElement('div');
    options.className = 'mode-choice-options';
    OPTIONS.forEach(option => options.appendChild(createOptionCard(option)));

    content.append(title, subtitle, options);
    dialog.appendChild(content);
    overlayEl.appendChild(dialog);
    container.appendChild(overlayEl);
}

function createOptionCard({ mode, icon, title, description }) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mode-choice-card';
    card.dataset.mode = mode;

    const iconEl = document.createElement('i');
    iconEl.className = `fa-solid ${icon} mode-choice-card-icon`;
    iconEl.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'mode-choice-card-text';

    const titleEl = document.createElement('span');
    titleEl.className = 'mode-choice-card-title';
    titleEl.textContent = title;

    const descEl = document.createElement('span');
    descEl.className = 'mode-choice-card-description';
    descEl.textContent = description;

    text.append(titleEl, descEl);
    card.append(iconEl, text);

    card.addEventListener('click', () => choose(mode));
    return card;
}

function choose(mode) {
    const callback = onChosen;
    onChosen = null;          // guard against a double tap reporting twice
    hideModeChoiceModal();
    if (callback) callback(mode);
}

/**
 * Show the choice screen.
 * @param {(mode: 'full'|'drawing-only') => void} callback — called once with the choice
 */
export function showModeChoiceModal(callback) {
    if (!overlayEl) {
        console.warn('Mode choice modal not initialized. Call initModeChoiceModal first.');
        return;
    }
    onChosen = callback;
    overlayEl.style.display = 'flex';
    requestAnimationFrame(() => {
        overlayEl.classList.add('visible');
        // Focus the dialog, not a card: a focused card shows a highlight that
        // would look like a pre-selected or recommended option and could nudge
        // the participant's choice. Keyboard users press Tab to reach the cards.
        overlayEl.querySelector('[role="dialog"]')?.focus();
    });
}

export function hideModeChoiceModal() {
    if (!overlayEl) return;
    overlayEl.classList.remove('visible');
    setTimeout(() => {
        overlayEl.style.display = 'none';
    }, 300);
}
