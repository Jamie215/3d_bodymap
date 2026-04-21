// js/components/modals/helpModal.js
// Context-aware help panel with accordion Q&A.
//
// Hybrid positioning:
//   Desktop (≥768px) — fixed right-side panel, no scrim
//   Mobile  (<768px) — full-screen modal with scrim
//
// While open, sets data-help-open="true" on <html> so CSS can disable
// pointer events on the canvas. First item auto-expanded; only one
// accordion item open at a time.

import { HELP_CONTENT } from '../../data/helpContent.js';
import { createVideoEmbed } from '../videoEmbed.js';

// ============================================================================
// MODULE STATE
// ============================================================================

let helpModalEl      = null;   // The panel element itself
let helpScrimEl      = null;   // Mobile-only backdrop
let helpContentEl    = null;   // Accordion container (re-rendered per open)
let helpTitleEl      = null;   // Title that updates per context
let helpCloseButton  = null;
let isOpen           = false;
let escapeHandler    = null;

// ============================================================================
// INIT
// ============================================================================

export function initHelpModal(container) {
    // Scrim (mobile only — hidden on desktop via CSS)
    helpScrimEl = document.createElement('div');
    helpScrimEl.className = 'help-modal-scrim';
    helpScrimEl.style.display = 'none';

    // Panel
    helpModalEl = document.createElement('aside');
    helpModalEl.className = 'help-modal';
    helpModalEl.id = 'help-modal';
    helpModalEl.setAttribute('role', 'dialog');
    helpModalEl.setAttribute('aria-modal', 'true');
    helpModalEl.setAttribute('aria-labelledby', 'help-modal-title');
    helpModalEl.style.display = 'none';

    // Header
    const header = document.createElement('div');
    header.className = 'help-modal-header';

    helpTitleEl = document.createElement('h2');
    helpTitleEl.id = 'help-modal-title';
    helpTitleEl.className = 'help-modal-title';
    helpTitleEl.innerHTML = '<span>Help</span> <i class="fa-solid fa-circle-question"></i>';

    helpCloseButton = document.createElement('button');
    helpCloseButton.className = 'help-modal-close';
    helpCloseButton.setAttribute('aria-label', 'Close help');
    helpCloseButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    header.append(helpTitleEl, helpCloseButton);

    // Content (accordion container — populated on show)
    helpContentEl = document.createElement('div');
    helpContentEl.className = 'help-modal-content';

    helpModalEl.append(header, helpContentEl);
    container.append(helpScrimEl, helpModalEl);

    // Event listeners
    helpCloseButton.addEventListener('click', hideHelpModal);
    helpScrimEl.addEventListener('click', hideHelpModal);
}

// ============================================================================
// SHOW / HIDE
// ============================================================================

/**
 * Show the help modal with Q&A content for the given context.
 *
 * @param {'drawing'|'summary'} context — which Q&A set to render
 */
export function showHelpModal(context = 'drawing') {
    if (!helpModalEl) {
        console.warn('Help modal not initialized. Call initHelpModal first.');
        return;
    }

    const entries = HELP_CONTENT[context];
    if (!entries) {
        console.warn(`No help content found for context: ${context}`);
        return;
    }

    renderAccordion(entries);

    helpModalEl.style.display = 'flex';
    helpScrimEl.style.display = 'block';

    // Force reflow before adding visible class so transition runs
    void helpModalEl.offsetWidth;
    requestAnimationFrame(() => {
        helpModalEl.classList.add('visible');
        helpScrimEl.classList.add('visible');
    });

    // Disable canvas interaction while open
    document.querySelector('.app-shell')?.setAttribute('inert', '');
    requestAnimationFrame(() => {
        helpCloseButton?.focus();
    });

    isOpen = true;
}

export function hideHelpModal() {
    if (!helpModalEl || !isOpen) return;

    helpModalEl.classList.remove('visible');
    helpScrimEl.classList.remove('visible');

    setTimeout(() => {
        helpModalEl.style.display = 'none';
        helpScrimEl.style.display = 'none';
    }, 300);

    document.querySelector('.app-shell')?.removeAttribute('inert');
    isOpen = false;
}

// ============================================================================
// INTERNAL — ACCORDION RENDERING
// ============================================================================

/**
 * Build the accordion from the given Q&A entries.
 * First item is expanded by default; clicking a question opens it
 * and collapses any other open item.
 */
function renderAccordion(entries) {
    helpContentEl.textContent = '';

    const accordion = document.createElement('div');
    accordion.className = 'help-modal-accordion';

    entries.forEach((entry, index) => {
        accordion.appendChild(createAccordionItem(entry, false));
    });

    helpContentEl.appendChild(accordion);
}

/**
 * Build a single accordion item with a question button and collapsible answer.
 */
function createAccordionItem(entry, expanded) {
    const item = document.createElement('div');
    item.className = 'help-accordion-item';

    // Question button
    const btn = document.createElement('button');
    btn.className = 'help-accordion-question';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', String(expanded));

    const qText = document.createElement('span');
    qText.className = 'help-accordion-question-text';
    qText.textContent = entry.q;

    const chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down help-accordion-chevron';

    btn.append(qText, chevron);

    // Answer panel
    const answer = document.createElement('div');
    answer.className = 'help-accordion-answer';
    if (expanded) answer.classList.add('is-open');

    entry.a.forEach(block => {
        answer.appendChild(renderBlock(block));
    });

    // Toggle behavior — single-open accordion
    btn.addEventListener('click', () => {
        const wasOpen = btn.getAttribute('aria-expanded') === 'true';

        // Collapse all siblings
        const allButtons = helpContentEl.querySelectorAll('.help-accordion-question');
        const allAnswers = helpContentEl.querySelectorAll('.help-accordion-answer');
        allButtons.forEach(b => b.setAttribute('aria-expanded', 'false'));
        allAnswers.forEach(a => a.classList.remove('is-open'));

        // Open this one if it wasn't already
        if (!wasOpen) {
            btn.setAttribute('aria-expanded', 'true');
            answer.classList.add('is-open');
        }
    });

    item.append(btn, answer);
    return item;
}

/**
 * Render a single content block into a DOM element.
 * Unknown block types are skipped silently with a console warning.
 */
function renderBlock(block) {
    switch (block.type) {
        case 'text': {
            const p = document.createElement('p');
            p.className = 'help-block-text';
            p.textContent = block.content;
            return p;
        }

        case 'image':
        case 'gif': {
            const img = document.createElement('img');
            img.className = 'help-block-image';
            img.src = block.src;
            img.alt = block.alt || '';
            img.loading = 'lazy';
            return img;
        }

        case 'video': {
            return createVideoEmbed(sanitiseVideoId(block.videoId), null);
        }

        default:
            console.warn(`renderBlock: unknown block type "${block.type}"`);
            return document.createComment(`unknown block type: ${block.type}`);
    }
}

/**
 * Sanitise a YouTube video ID — only alphanumerics, hyphens, and underscores.
 */
function sanitiseVideoId(videoId) {
    if (typeof videoId !== 'string') return '';
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
}

// ============================================================================
// ELEMENT GETTER (for getModalElements)
// ============================================================================

export function getHelpElements() {
    return { helpCloseButton };
}