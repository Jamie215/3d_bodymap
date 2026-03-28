// summaryView.js
// Summary stage: shows logged pain/symptom areas with edit/delete actions,
// or the getting-started video when no areas exist yet.

import AppState from '../app/state.js';
import { createVideoEmbed } from '../components/videoEmbed.js';

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

    // ── Footer ─────────────────────────────────────────────────────────
    const summaryFooter = document.createElement('div');
    summaryFooter.id = 'footer-summary';
    summaryFooter.classList.add('footer');

    const addNewInstanceButton = document.createElement('button');
    addNewInstanceButton.id = 'add-new-instance-summary';
    addNewInstanceButton.textContent = 'Add a New Pain or Symptom';
    addNewInstanceButton.classList.add('button', 'button-primary');

    const summaryDoneButton = document.createElement('button');
    summaryDoneButton.id = 'summary-done-button';
    summaryDoneButton.textContent = 'Proceed to General Questionnaire';
    summaryDoneButton.classList.add('button', 'button-success');

    summaryFooter.appendChild(addNewInstanceButton);
    summaryFooter.appendChild(summaryDoneButton);

    modelSummaryView.appendChild(summaryStatusPanel);
    modelSummaryView.appendChild(summaryFooter);

    // ── Callbacks ──────────────────────────────────────────────────────
    let onEditArea   = null;
    let onDeleteArea = null;

    function setEditCallback(callback)   { onEditArea   = callback; }
    function setDeleteCallback(callback) { onDeleteArea = callback; }

    // ── Status update ──────────────────────────────────────────────────

    function updateSummaryStatus() {
        const count      = AppState.drawingInstances.length;
        const isComplete = !!AppState.generalQuestionnaireResponse;

        if (isComplete) {
            renderComplete(count);
            return;
        }

        if (count === 0) {
            renderEmpty();
            return;
        }

        renderAreaList(count);
    }

    // ── Render states ──────────────────────────────────────────────────

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
        title.textContent = 'Submission Complete';

        const thankYou = document.createElement('p');
        thankYou.style.marginTop = 'var(--space-md)';
        thankYou.textContent = 'Thank you for completing your pain assessment.';

        const logged = document.createElement('p');
        const countStrong = document.createElement('strong');
        countStrong.textContent = String(count);
        logged.append(
            'You logged ',
            countStrong,
            ` pain or symptom area${count !== 1 ? 's' : ''}.`
        );

        wrapper.append(icon, title, thankYou, logged);
        summaryStatusPanel.appendChild(wrapper);

        summaryDoneButton.style.display      = 'none';
        addNewInstanceButton.style.display    = 'none';
    }

    function renderEmpty() {
        changeModelButton.style.display   = 'inline-flex';
        summaryDoneButton.style.display   = 'none';

        summaryStatusPanel.textContent = '';
        summaryStatusPanel.appendChild(createVideoEmbed());
    }

    function renderAreaList(count) {
        changeModelButton.style.display = 'none';
        summaryDoneButton.style.display = '';
        summaryDoneButton.disabled      = false;

        summaryStatusPanel.textContent = '';

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

    /**
     * Build a single area card with edit/delete buttons.
     * All dynamic values (color, index) are set via DOM properties,
     * never interpolated into markup strings.
     */
    function createAreaItem(instance, index) {
        const areaNum = index + 1;

        const item = document.createElement('div');
        item.className = 'area-item';
        item.dataset.index = index;

        // Area info
        const info = document.createElement('div');
        info.className = 'area-info';

        const number = document.createElement('span');
        number.className = 'area-number';
        number.style.color = instance.color || 'var(--primary-color)';
        number.textContent = `Area #${areaNum}`;

        info.appendChild(number);

        // Action buttons
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

    // ── Public interface ───────────────────────────────────────────────

    return {
        root: modelSummaryView,
        updateSummaryStatus,
        summaryStatusPanel,
        summaryFooter,
        changeModelButton,
        addNewInstanceButton,
        summaryDoneButton,
        setEditCallback,
        setDeleteCallback
    };
}