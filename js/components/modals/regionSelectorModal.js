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
let selectedMainArea = null;
let selectedSubArea = null;
let onRegionSelectedCallback = null;

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

    regionModalEl.innerHTML = `
        <div class="region-modal-content modal-body">
            <h1 class="region-modal-icon modal-icon"><i class="fa-solid fa-location-dot"></i></h1>
            <h2 class="region-modal-title modal-title">Where Do You Experience Your Pain or Symptom?</h2>
            <p class="region-modal-instruction">Select the area where you feel this pain or symptom. Draw only one area at a time — you can add more after.</p>
            
            <div class="region-selectors">
                <div class="selector-group">
                    <label for="main-area-select">Body Area: </label>
                    <select id="main-area-select" class="region-select">
                        <option value="">-- Select Area --</option>
                        <option value="Entire Body">Entire Body</option>
                        ${Object.entries(REGION_HIERARCHY).map(([area, config]) => 
                            `<option value="${area}">${config.displayName || area}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="selector-group sub-area-group" id="sub-area-group" style="display: none;">
                    <label for="sub-area-select">Specific Region: </label>
                    <select id="sub-area-select" class="region-select">
                        <option value="">-- Select Region --</option>
                    </select>
                </div>
                
                <button id="region-confirm-btn" class="region-confirm-btn modal-btn-primary" disabled>
                    Focus on This Region
                </button>
            </div>
        </div>
    `;

    regionModalOverlay.appendChild(regionModalEl);
    container.appendChild(regionModalOverlay);

    mainAreaSelect = regionModalEl.querySelector('#main-area-select');
    subAreaSelect = regionModalEl.querySelector('#sub-area-select');
    regionConfirmBtn = regionModalEl.querySelector('#region-confirm-btn');

    setupRegionModalEvents();
}

// ============================================
// INTERNAL — EVENT WIRING
// ============================================

function setupRegionModalEvents() {
    const subGroup = regionModalEl.querySelector('#sub-area-group');

    mainAreaSelect.addEventListener('change', (e) => {
        selectedMainArea = e.target.value;
        selectedSubArea = null;

        if (selectedMainArea === 'Entire Body') {
            subGroup.style.display = 'none';
            regionConfirmBtn.disabled = false;
        } else if (selectedMainArea && REGION_HIERARCHY[selectedMainArea]) {
            const config = REGION_HIERARCHY[selectedMainArea];

            if (config.subAreas && config.subAreas.length > 0) {
                subGroup.style.display = 'block';
                subAreaSelect.innerHTML = `
                    <option value="">-- Select Region --</option>
                    ${config.subAreas.map(sub => 
                        `<option value="${sub}">${sub}</option>`
                    ).join('')}
                `;
            } else {
                subGroup.style.display = 'none';
            }

            regionConfirmBtn.disabled = false;
        } else {
            subGroup.style.display = 'none';
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
    const subGroup = regionModalEl?.querySelector('#sub-area-group');

    if (preselect && preselect.mainArea) {
        selectedMainArea = preselect.mainArea;
        selectedSubArea = preselect.subArea;

        if (mainAreaSelect) mainAreaSelect.value = preselect.mainArea;

        const config = REGION_HIERARCHY[preselect.mainArea];

        if (config && config.subAreas && config.subAreas.length > 0) {
            if (subGroup) subGroup.style.display = 'block';
            if (subAreaSelect) {
                subAreaSelect.innerHTML = `
                    <option value="">-- Select Region --</option>
                    ${config.subAreas.map(sub =>
                        `<option value="${sub}"${sub === preselect.subArea ? ' selected' : ''}>${sub}</option>`
                    ).join('')}
                `;
            }
        } else {
            if (subGroup) subGroup.style.display = 'none';
        }

        if (regionConfirmBtn) regionConfirmBtn.disabled = false;
    } else {
        selectedMainArea = null;
        selectedSubArea = null;

        if (mainAreaSelect) mainAreaSelect.value = '';
        if (subAreaSelect) {
            subAreaSelect.innerHTML = '<option value="">-- Select Region --</option>';
        }

        if (subGroup) subGroup.style.display = 'none';
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
    button.innerHTML = '<span>Select Body Region</span>';

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