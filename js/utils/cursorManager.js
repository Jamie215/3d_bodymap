// cursorManager.js
// Manages the custom draw/erase cursor that follows the mouse
// over the canvas during the drawing stage.
//
// Desktop-only — hidden automatically on touch devices via CSS.

import AppState from '../app/state.js';

// ============================================================================
// MODULE STATE
// ============================================================================

let cursorContainer = null;
let cursorIconEl    = null;

const handlers = {
    mousemove:     null,
    mouseleave:    null,
    drawBtnClick:  null,
    eraseBtnClick: null
};

const DRAW_COLOR  = 'var(--primary-color)';
const ERASE_COLOR = 'var(--light-red)';

const getDrawIcon  = (c) => `<i class="fa-solid fa-pen" style="color: ${c};"></i>`;
const getEraseIcon = (c) => `<i class="fa-solid fa-eraser" style="color: ${c};"></i>`;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create (if needed) and activate the custom cursor.
 * Wires mousemove/mouseleave on the canvas panel and click
 * listeners on the draw/erase buttons to keep the icon in sync.
 */
export function setupCursorManagement() {
    const canvasPanel = document.getElementById('canvas-panel');
    if (!canvasPanel) return;

    // Create the cursor DOM element once
    if (!cursorContainer || !document.body.contains(cursorContainer)) {
        cursorContainer = document.createElement('div');
        cursorContainer.classList.add('cursor-container');
        document.body.appendChild(cursorContainer);

        cursorIconEl = document.createElement('div');
        cursorIconEl.className = 'cursor-icon';
        cursorContainer.appendChild(cursorIconEl);
    }

    cursorContainer.style.display = '';
    canvasPanel.style.cursor = 'none';

    // Remove any previously attached handlers first
    disableCursorManagement();

    const updateIcon = () => {
        cursorIconEl.innerHTML = AppState.isErasing ? getEraseIcon(ERASE_COLOR) : getDrawIcon(DRAW_COLOR);
        cursorIconEl.classList.toggle('eraser-mode', AppState.isErasing);
    };

    // Mousemove — position the cursor element
    handlers.mousemove = (e) => {
        cursorContainer.style.display = 'block';
        cursorContainer.style.left    = `${e.clientX}px`;
        cursorContainer.style.top     = `${e.clientY}px`;
    };

    // Mouseleave — hide it
    handlers.mouseleave = () => {
        cursorContainer.style.display = 'none';
    };

    canvasPanel.addEventListener('mousemove',  handlers.mousemove,  { passive: true });
    canvasPanel.addEventListener('mouseleave', handlers.mouseleave, { passive: true });

    // Sync icon when draw/erase buttons are clicked
    const drawBtn  = document.getElementById('draw-button');
    const eraseBtn = document.getElementById('erase-button');

    if (drawBtn) {
        handlers.drawBtnClick = () => { AppState.isErasing = false; updateIcon(); };
        drawBtn.addEventListener('click', handlers.drawBtnClick);
    }
    if (eraseBtn) {
        handlers.eraseBtnClick = () => { AppState.isErasing = true; updateIcon(); };
        eraseBtn.addEventListener('click', handlers.eraseBtnClick);
    }

    // Set the initial icon
    updateIcon();
}

/**
 * Detach all cursor-related event listeners and hide the cursor.
 */
export function disableCursorManagement() {
    const canvasPanel = document.getElementById('canvas-panel');
    if (!canvasPanel) return;

    if (handlers.mousemove) {
        canvasPanel.removeEventListener('mousemove', handlers.mousemove);
        handlers.mousemove = null;
    }
    if (handlers.mouseleave) {
        canvasPanel.removeEventListener('mouseleave', handlers.mouseleave);
        handlers.mouseleave = null;
    }

    const drawBtn  = document.getElementById('draw-button');
    const eraseBtn = document.getElementById('erase-button');

    if (drawBtn && handlers.drawBtnClick) {
        drawBtn.removeEventListener('click', handlers.drawBtnClick);
        handlers.drawBtnClick = null;
    }
    if (eraseBtn && handlers.eraseBtnClick) {
        eraseBtn.removeEventListener('click', handlers.eraseBtnClick);
        handlers.eraseBtnClick = null;
    }

    if (cursorContainer) cursorContainer.style.display = 'none';
    canvasPanel.style.cursor = 'default';
}