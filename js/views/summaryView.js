// summaryView.js
// Summary stage: shows logged pain/symptom areas with edit/delete actions,
// or — on desktop empty state — the getting-started video.
// On mobile empty state the title + a "How do I use this form" link
// are placed above the 3D model by stageLayout.

import AppState from '../app/state.js';
import { createVideoEmbed, createVideoLink } from '../components/videoEmbed.js';
import { showHelpModal } from '../components/modal.js';
import { getResponsiveManager } from '../utils/responsiveManager.js';

const responsive = getResponsiveManager();

export function createSummaryView() {
    const modelSummaryView = document.createElement('div');
    modelSummaryView.id = 'model-summary-view';

    const summaryStatusPanel = document.createElement('div');
    summaryStatusPanel.id = 'summary-status-panel';

    // ── Header button ──────────────────────────────────────────────────
    const changeModelButton = document.createElement('button');
    changeModelButton.id = 'change-model-button';
    changeModelButton.innerHTML = `
        <i class="fa-solid fa-person"></i>
        <span>Change My Body Type</span>
    `;
    changeModelButton.classList.add('button');

    // ── Help button ────────────────────────────────────────────────────
    const helpButton = document.createElement('button');
    helpButton.id = 'help-button-summary';
    helpButton.classList.add('button', 'canvas-floating-btn');
    helpButton.style.display = 'none';
    helpButton.innerHTML = '<span>Help</span><i class="fa-solid fa-circle-question"></i>';
    helpButton.addEventListener('click', () => {
        showHelpModal('summary');
    });

    // ── Mobile canvas header (title + "How do I use this form" link) ──
    // Placed in the canvas panel by stageLayout on mobile empty state.
    const mobileCanvasHeader = document.createElement('div');
    mobileCanvasHeader.className = 'summary-canvas-header';

    const mobileTitle = document.createElement('h2');
    mobileTitle.className = 'summary-canvas-title';
    mobileTitle.textContent = 'Pain & Symptom Assessment Form';

    mobileCanvasHeader.append(mobileTitle, createVideoLink());

    // ── Footer ─────────────────────────────────────────────────────────
    const summaryFooter = document.createElement('div');
    summaryFooter.id = 'footer-summary';
    summaryFooter.classList.add('footer');

    const addNewInstanceButton = document.createElement('button');
    addNewInstanceButton.id = 'add-new-instance-summary';
    addNewInstanceButton.innerHTML =
        '<span class="summary-btn-text-full">Add a New Pain or Symptom</span>' +
        '<span class="summary-btn-text-short">Add a New Area</span>';
    addNewInstanceButton.classList.add('button', 'button-primary');

    const summaryDoneButton = document.createElement('button');
    summaryDoneButton.id = 'summary-done-button';
    summaryDoneButton.innerHTML =
        '<span class="summary-btn-text-full">Proceed to General Questionnaire</span>' +
        '<span class="summary-btn-text-short">Continue</span>';
    summaryDoneButton.classList.add('button', 'button-success');

    summaryFooter.appendChild(addNewInstanceButton);
    summaryFooter.appendChild(summaryDoneButton);

    modelSummaryView.appendChild(summaryStatusPanel);
    modelSummaryView.appendChild(summaryFooter);

    // ── Callbacks ──────────────────────────────────────────────────────
    let onEditArea    = null;
    let onDeleteArea  = null;
    let onDownload    = null;
    let onConfirmSaved = null;

    function setEditCallback(callback)        { onEditArea     = callback; }
    function setDeleteCallback(callback)      { onDeleteArea   = callback; }
    function setDownloadCallback(callback)    { onDownload     = callback; }
    function setConfirmSavedCallback(callback){ onConfirmSaved = callback; }

    // ── Status update ──────────────────────────────────────────────────

    function updateSummaryStatus() {
        const count      = AppState.drawingInstances.length;

        // Once "Finish" is clicked the session data is flushed (REB #8), so we
        // can't key off generalQuestionnaireResponse anymore — pin the final
        // screen explicitly so a re-render (e.g. device rotation) keeps it.
        if (AppState.sessionComplete) {
            renderComplete(count);
            return;
        }

        const isComplete = !!AppState.generalQuestionnaireResponse;

        if (isComplete) {
            // After the questionnaire is done the responses are downloaded; the
            // participant must confirm they saved the file before we show the
            // final "done" screen.
            if (AppState.downloadConfirmed) {
                renderComplete(count);
            } else {
                renderSaveToDevice(count);
            }
            return;
        }

        if (count === 0) {
            renderEmpty();
            return;
        }

        renderAreaList(count);
    }

    // ── Render states ──────────────────────────────────────────────────

    // Save-to-encrypted-device screen. Shown after the questionnaire is complete
    // and the responses have been downloaded, before the final "done" screen.
    // There is no backend — the participant stores the downloaded file on the
    // encrypted device provided to them.
    function renderSaveToDevice(count) {
        summaryStatusPanel.textContent = '';

        summaryDoneButton.style.display    = 'none';
        addNewInstanceButton.style.display = 'none';
        helpButton.style.display           = 'none';

        const wrapper = document.createElement('div');
        wrapper.className = 'summary-save';

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-circle-exclamation';
        icon.style.color = 'var(--primary-color)';
        icon.style.fontSize = 'var(--font-title-large)';

        const title = document.createElement('span');
        title.className = 'summary-title';
        title.textContent = 'Save Your Response';

        const instruction = document.createElement('p');
        instruction.className = 'summary-instruction';
        const countStrong = document.createElement('strong');
        countStrong.textContent = String(count);
        instruction.append(
            'You logged ',
            countStrong,
            ` pain or symptom area${count !== 1 ? 's' : ''}. Download your response and save it to the `,
            (() => { const s = document.createElement('strong'); s.textContent = 'encrypted device provided'; return s; })(),
            ' before closing this page.'
        );

        // The download is triggered here (not automatically) — the button can be
        // clicked again if the file is misplaced.
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'button button-primary';
        downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> <span>Download response</span>';
        downloadBtn.addEventListener('click', () => {
            if (onDownload) onDownload();
        });

        // Confirmation gate.
        const confirmRow = document.createElement('label');
        confirmRow.className = 'summary-save-confirm';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';

        const confirmText = document.createElement('span');
        confirmText.textContent = 'I have saved the file to the provided device.';

        confirmRow.append(checkbox, confirmText);

        const finishBtn = document.createElement('button');
        finishBtn.className = 'button button-success';
        finishBtn.textContent = 'Finish';
        finishBtn.disabled = true;
        checkbox.addEventListener('change', () => {
            finishBtn.disabled = !checkbox.checked;
        });
        finishBtn.addEventListener('click', () => {
            if (checkbox.checked && onConfirmSaved) onConfirmSaved();
        });

        wrapper.append(icon, title, instruction, downloadBtn, confirmRow, finishBtn);
        summaryStatusPanel.appendChild(wrapper);
    }

    function renderComplete(count) {
        summaryStatusPanel.textContent = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'summary-complete';

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-circle-check';
        icon.style.color = 'var(--success-color)';
        icon.style.fontSize = 'var(--font-title-large)';

        const title = document.createElement('span');
        title.className = 'summary-title';
        title.textContent = 'All Done';

        const thankYou = document.createElement('p');
        thankYou.style.marginTop = 'var(--space-md)';
        thankYou.textContent = 'Thank you for completing your pain assessment.';

        const saved = document.createElement('p');
        saved.textContent =
            'Your responses have been saved to the provided device. You may now close this page.';

        wrapper.append(icon, title, thankYou, saved);
        summaryStatusPanel.appendChild(wrapper);

        summaryDoneButton.style.display    = 'none';
        addNewInstanceButton.style.display = 'none';
        helpButton.style.display           = 'none';
    }

    function renderEmpty() {
        changeModelButton.style.display = 'inline-flex';
        summaryDoneButton.style.display = 'none';
        helpButton.style.display        = 'none';

        summaryStatusPanel.textContent = '';

        // Desktop: show the video embed in the side panel.
        // Mobile: title + link is rendered into the canvas panel by stageLayout —
        // leave summaryStatusPanel empty so the (hidden) right slot stays clean.
        if (!responsive.is('isMobile')) {
            summaryStatusPanel.appendChild(createVideoEmbed());
        }
    }

    function renderAreaList(count) {
        changeModelButton.style.display = 'none';
        summaryDoneButton.style.display = '';
        summaryDoneButton.disabled      = false;

        summaryStatusPanel.textContent = '';

        helpButton.style.display = 'inline-flex';

        const wrapper = document.createElement('div');
        wrapper.className = 'summary-with-areas';

        const title = document.createElement('span');
        title.className = 'summary-title';
        title.textContent = 'Your Pain/Symptom Areas';

        const instruction = document.createElement('p');
        instruction.className = 'summary-instruction';
        instruction.textContent = 'You can add more areas or proceed to the general questionnaire.';

        const areasList = document.createElement('div');
        areasList.className = 'areas-list';

        AppState.drawingInstances.forEach((instance, index) => {
            areasList.appendChild(createAreaItem(instance, index));
        });

        wrapper.append(title, instruction, areasList);
        summaryStatusPanel.appendChild(wrapper);
    }

    function createAreaItem(instance, index) {
        const areaNum = index + 1;

        const item = document.createElement('div');
        item.className = 'area-item';
        item.dataset.index = index;

        const info = document.createElement('div');
        info.className = 'area-info';

        const number = document.createElement('span');
        number.className = 'area-number';
        number.style.color = instance.color || 'var(--primary-color)';
        number.textContent = `Area #${areaNum}`;

        info.appendChild(number);

        const actions = document.createElement('div');
        actions.className = 'area-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'area-edit-btn';
        editBtn.dataset.index = index;
        editBtn.title = 'Edit this area';
        editBtn.innerHTML = '<i class="fa-solid fa-user-pen"></i> Edit';
        editBtn.addEventListener('click', () => {
            if (onEditArea) onEditArea(index);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'area-delete-btn';
        deleteBtn.dataset.index = index;
        deleteBtn.title = 'Delete this area';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
        deleteBtn.addEventListener('click', () => {
            if (onDeleteArea) onDeleteArea(index);
        });

        actions.append(editBtn, deleteBtn);
        item.append(info, actions);

        return item;
    }

    return {
        root: modelSummaryView,
        updateSummaryStatus,
        summaryStatusPanel,
        summaryFooter,
        changeModelButton,
        helpButton,
        mobileCanvasHeader,
        addNewInstanceButton,
        summaryDoneButton,
        setEditCallback,
        setDeleteCallback,
        setDownloadCallback,
        setConfirmSavedCallback
    };
}