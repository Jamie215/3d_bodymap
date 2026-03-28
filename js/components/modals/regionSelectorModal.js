// modals/regionSelectorModal.js
// Body-region selector with cascading main-area / sub-area dropdowns.
// On confirmation, sets region visibility and camera focus.

import AppState from '../../app/state.js';
import { setVisibleRegions } from '../../utils/regionVisibility.js';
import {
    REGION_HIERARCHY,
    mapToCameraRegion,
    mapFromCameraRegion,
    resolveRegionIds
} from '../../utils/regionHierarchy.js';

// ============================================
// MODULE STATE
// ============================================

let regionModalEl = null;
let regionModalOverlay = null;
let mainAreaSelect = null;
let subAreaSelect = null;
let regionConfirmBtn = null;
let subAreaGroup = null;
let selectedMainArea = null;
let selectedSubArea = null;
let onRegionSelectedCallback = null;

// ============================================
// DOM HELPERS
// ============================================

/**
 * Build an <option> element. Values are set via DOM properties,
 * never interpolated into markup strings.
 *
 * @param {string} value
 * @param {string} label
 * @param {boolean} [selected=false]
 * @returns {HTMLOptionElement}
 */
function createOption(value, label, selected = false) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (selected) opt.selected = true;
    return opt;
}

/**
 * Replace all options in a <select> element.
 *
 * @param {HTMLSelectElement} selectEl
 * @param {Array<{value: string, label: string}>} options
 * @param {string} [placeholderText] — if provided, adds a disabled placeholder first
 * @param {string} [selectedValue] — pre-select this value if present
 */
function populateSelect(selectEl, options, placeholderText = null, selectedValue = null) {
    selectEl.textContent = '';
    if (placeholderText) {
        selectEl.appendChild(createOption('', placeholderText));
    }
    for (const { value, label } of options) {
        selectEl.appendChild(createOption(value, label, value === selectedValue));
    }
}

// ============================================
// INIT
// ============================================

export function initRegionSelectorModal(container) {
    regionModalOverlay = document.createElement('div');
    regionModalOverlay.className = 'region-modal-overlay modal-overlay';
    regionModalOverlay.style.display = 'none';

    regionModalEl = document.createElement('div');
    regionModalEl.className = 'region-modal modal-container';
    regionModalEl.id = 'region-selector-modal';

    // ── Modal content ──────────────────────────────────────────────
    const content = document.createElement('div');
    content.className = 'region-modal-content modal-body';

    // Icon
    const iconWrapper = document.createElement('h1');
    iconWrapper.className = 'region-modal-icon modal-icon';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-location-dot';
    iconWrapper.appendChild(icon);

    // Title
    const title = document.createElement('h2');
    title.className = 'region-modal-title modal-title';
    title.textContent = 'Where Do You Experience Your Pain or Symptom?';

    // Instruction
    const instruction = document.createElement('p');
    instruction.className = 'region-modal-instruction';
    instruction.textContent = 'Select the area where you feel this pain or symptom. Draw only one area at a time — you can add more after.';

    // Selectors container
    const selectors = document.createElement('div');
    selectors.className = 'region-selectors';

    // ── Main area selector ─────────────────────────────────────────
    const mainGroup = document.createElement('div');
    mainGroup.className = 'selector-group';

    const mainLabel = document.createElement('label');
    mainLabel.htmlFor = 'main-area-select';
    mainLabel.textContent = 'Body Area: ';

    mainAreaSelect = document.createElement('select');
    mainAreaSelect.id = 'main-area-select';
    mainAreaSelect.className = 'region-select';

    // Build main-area options from REGION_HIERARCHY
    const mainOptions = [
        { value: 'Entire Body', label: 'Entire Body' },
        ...Object.entries(REGION_HIERARCHY).map(([area, config]) => ({
            value: area,
            label: config.displayName || area
        }))
    ];
    populateSelect(mainAreaSelect, mainOptions, '-- Select Area --');

    mainGroup.append(mainLabel, mainAreaSelect);

    // ── Sub-area selector (hidden by default) ──────────────────────
    subAreaGroup = document.createElement('div');
    subAreaGroup.className = 'selector-group sub-area-group';
    subAreaGroup.id = 'sub-area-group';
    subAreaGroup.style.display = 'none';

    const subLabel = document.createElement('label');
    subLabel.htmlFor = 'sub-area-select';
    subLabel.textContent = 'Specific Region: ';

    subAreaSelect = document.createElement('select');
    subAreaSelect.id = 'sub-area-select';
    subAreaSelect.className = 'region-select';
    populateSelect(subAreaSelect, [], '-- Select Region --');

    subAreaGroup.append(subLabel, subAreaSelect);

    // ── Confirm button ─────────────────────────────────────────────
    regionConfirmBtn = document.createElement('button');
    regionConfirmBtn.id = 'region-confirm-btn';
    regionConfirmBtn.className = 'region-confirm-btn modal-btn-primary';
    regionConfirmBtn.textContent = 'Focus on This Region';
    regionConfirmBtn.disabled = true;

    // Assemble
    selectors.append(mainGroup, subAreaGroup, regionConfirmBtn);
    content.append(iconWrapper, title, instruction, selectors);
    regionModalEl.appendChild(content);
    regionModalOverlay.appendChild(regionModalEl);
    container.appendChild(regionModalOverlay);

    setupRegionModalEvents();
}

// ============================================
// INTERNAL — EVENT WIRING
// ============================================

function setupRegionModalEvents() {
    mainAreaSelect.addEventListener('change', (e) => {
        selectedMainArea = e.target.value;
        selectedSubArea = null;

        if (selectedMainArea === 'Entire Body') {
            subAreaGroup.style.display = 'none';
            regionConfirmBtn.disabled = false;
        } else if (selectedMainArea && REGION_HIERARCHY[selectedMainArea]) {
            const config = REGION_HIERARCHY[selectedMainArea];

            if (config.subAreas && config.subAreas.length > 0) {
                subAreaGroup.style.display = 'block';
                const subOptions = config.subAreas.map(sub => ({ value: sub, label: sub }));
                populateSelect(subAreaSelect, subOptions, '-- Select Region --');
            } else {
                subAreaGroup.style.display = 'none';
            }

            regionConfirmBtn.disabled = false;
        } else {
            subAreaGroup.style.display = 'none';
            regionConfirmBtn.disabled = true;
        }
    });

    subAreaSelect.addEventListener('change', (e) => {
        selectedSubArea = e.target.value || null;
    });

    regionConfirmBtn.addEventListener('click', () => {
        confirmRegionSelection();
    });
}

// ============================================
// INTERNAL — SELECTION LOGIC
// ============================================

function confirmRegionSelection() {
    if (!selectedMainArea) return;

    // Entire Body — clear filter and reset view
    if (selectedMainArea === 'Entire Body') {
        setVisibleRegions(null, null);
        if (AppState.cameraUtils) {
            AppState.cameraUtils.resetView();
        }
        if (onRegionSelectedCallback) {
            onRegionSelectedCallback('Entire Body');
        }
        hideRegionSelectorModal();
        return;
    }

    const config = REGION_HIERARCHY[selectedMainArea];
    if (!config) return;

    if (config.hideOthers) {
        // Limbs (Arms / Legs): hide other body parts, keep entire limb visible
        const limbIds = resolveRegionIds([selectedMainArea]);
        setVisibleRegions(limbIds, [selectedMainArea]);

        if (selectedSubArea) {
            const cameraRegion = mapToCameraRegion(selectedMainArea, selectedSubArea);
            if (AppState.cameraUtils) {
                AppState.cameraUtils.focusOnRegion(cameraRegion, false);
            }
            if (onRegionSelectedCallback) {
                onRegionSelectedCallback(`${selectedMainArea} - ${selectedSubArea}`);
            }
        } else {
            if (AppState.cameraUtils) {
                AppState.cameraUtils.fitToVisibleRegions(limbIds);
                AppState.cameraUtils.focusedRegionName = selectedMainArea;
            }
            if (onRegionSelectedCallback) {
                onRegionSelectedCallback(selectedMainArea);
            }
        }
    } else {
        // Head / Neck / Torso: focus camera only, no visibility filter
        setVisibleRegions(null, null);

        const cameraRegion = selectedSubArea
            ? mapToCameraRegion(selectedMainArea, selectedSubArea)
            : (config.cameraRegion || selectedMainArea);

        if (AppState.cameraUtils) {
            AppState.cameraUtils.focusOnRegion(cameraRegion, false);
        }

        if (onRegionSelectedCallback) {
            const label = selectedSubArea
                ? `${selectedMainArea} - ${selectedSubArea}`
                : selectedMainArea;
            onRegionSelectedCallback(label);
        }
    }

    hideRegionSelectorModal();
}

function resetRegionSelections(preselect = null) {
    if (preselect && preselect.mainArea) {
        selectedMainArea = preselect.mainArea;
        selectedSubArea = preselect.subArea;

        if (mainAreaSelect) mainAreaSelect.value = preselect.mainArea;

        const config = REGION_HIERARCHY[preselect.mainArea];

        if (config && config.subAreas && config.subAreas.length > 0) {
            if (subAreaGroup) subAreaGroup.style.display = 'block';
            if (subAreaSelect) {
                const subOptions = config.subAreas.map(sub => ({ value: sub, label: sub }));
                populateSelect(subAreaSelect, subOptions, '-- Select Region --', preselect.subArea);
            }
        } else {
            if (subAreaGroup) subAreaGroup.style.display = 'none';
        }

        if (regionConfirmBtn) regionConfirmBtn.disabled = false;
    } else {
        selectedMainArea = null;
        selectedSubArea = null;

        if (mainAreaSelect) mainAreaSelect.value = '';
        if (subAreaSelect) {
            populateSelect(subAreaSelect, [], '-- Select Region --');
        }

        if (subAreaGroup) subAreaGroup.style.display = 'none';
        if (regionConfirmBtn) regionConfirmBtn.disabled = true;
    }
}

// ============================================
// SHOW / HIDE
// ============================================

export function showRegionSelectorModal() {
    if (!regionModalOverlay) {
        console.warn('Region selector modal not initialized. Call initRegionSelectorModal first.');
        return;
    }

    regionModalOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
        regionModalOverlay.classList.add('visible');
    });

    // Pre-select current focused region if available
    const currentRegion = AppState.cameraUtils?.focusedRegionName;
    const preselect = mapFromCameraRegion(currentRegion);
    resetRegionSelections(preselect);
}

export function hideRegionSelectorModal() {
    if (!regionModalOverlay) return;

    const footerBtn = document.getElementById('region-selector-footer-btn');

    // If footer button exists and is visible, animate modal toward it
    if (footerBtn && footerBtn.offsetParent !== null) {
        const modalRect = regionModalEl.getBoundingClientRect();
        const btnRect = footerBtn.getBoundingClientRect();

        const modalCenterX = modalRect.left + modalRect.width / 2;
        const modalCenterY = modalRect.top + modalRect.height / 2;
        const btnCenterX = btnRect.left + btnRect.width / 2;
        const btnCenterY = btnRect.top + btnRect.height / 2;

        const deltaX = btnCenterX - modalCenterX;
        const deltaY = btnCenterY - modalCenterY;

        regionModalEl.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease';
        regionModalEl.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.05)`;
        regionModalEl.style.opacity = '0';

        regionModalOverlay.style.transition = 'opacity 0.3s ease';
        regionModalOverlay.classList.remove('visible');

        setTimeout(() => {
            regionModalOverlay.style.display = 'none';

            regionModalEl.style.transition = '';
            regionModalEl.style.transform = '';
            regionModalEl.style.opacity = '';
            regionModalOverlay.style.transition = '';

            footerBtn.classList.add('pulse-highlight');
            setTimeout(() => {
                footerBtn.classList.remove('pulse-highlight');
            }, 1000);
        }, 420);
    } else {
        regionModalOverlay.classList.remove('visible');
        setTimeout(() => {
            regionModalOverlay.style.display = 'none';
        }, 300);
    }
}

// ============================================
// CALLBACK REGISTRATION
// ============================================

export function setOnRegionSelected(callback) {
    onRegionSelectedCallback = callback;
}

// ============================================
// FOOTER BUTTON FACTORY
// ============================================

export function createRegionSelectorFooterButton() {
    const button = document.createElement('button');
    button.id = 'region-selector-footer-btn';
    button.className = 'region-selector-footer-btn button button-secondary';

    const label = document.createElement('span');
    label.textContent = 'Select Body Region';
    button.appendChild(label);

    button.addEventListener('click', () => {
        showRegionSelectorModal();
    });

    return button;
}

// ============================================
// ELEMENT GETTER (for getModalElements)
// ============================================

export function getRegionSelectorElements() {
    return { mainAreaSelect, subAreaSelect, regionConfirmBtn };
}