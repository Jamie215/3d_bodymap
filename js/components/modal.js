// modal.js
// UI layer for all application modals.
// Region hierarchy data and mapping logic lives in ../utils/regionHierarchy.js

import AppState from "../app/state.js";
import { setVisibleRegions } from "../utils/regionVisibility.js";
import {
    REGION_HIERARCHY,
    mapToCameraRegion,
    mapFromCameraRegion,
    resolveRegionIds
} from "../utils/regionHierarchy.js";

// ============================================
// MODULE-LEVEL REFERENCES
// ============================================

// Continue/Survey Modal
let continueModalEl, continueModalText, continueModalButton, returnModalButton, returnToSummaryButton, drawingPreview;

// Reset Modal
let resetModalEl, resetModalText, resetReturnButton, resetConfirmButton;

// Delete Empty Modal
let deleteEmptyModalEl, deleteEmptyText, deleteEmptyReturnButton, deleteEmptyContinueButton;

// Region Selector Modal
let regionModalEl, regionModalOverlay, mainAreaSelect, subAreaSelect, regionConfirmBtn;
let selectedMainArea = null;
let selectedSubArea = null;
let onRegionSelectedCallback = null;

// Onboarding Modal
let onboardingModalEl, onboardingModalOverlay, onboardingStartButton;
let onOnboardingCompleteCallback = null;

// LocalStorage key for tracking if onboarding has been shown
const ONBOARDING_SHOWN_KEY = 'painSurvey_onboardingShown';

// ============================================
// SHARED HELPERS
// ============================================

function createModal(id, className = 'modal') {
    const modal = document.createElement('div');
    modal.id = id;
    modal.style.display = 'none';
    modal.classList.add(className);
    return modal;
}

function createModalContent() {
    const content = document.createElement('div');
    content.classList.add('modal-content');
    return content;
}

function createButton(id, text, className = 'modal-button') {
    const button = document.createElement('button');
    button.id = id;
    button.classList.add(className);
    button.classList.add('modal-btn-secondary');
    button.innerText = text;
    return button;
}

function createButtonGroup(...buttons) {
    const group = document.createElement('div');
    group.classList.add('modal-button-group');
    group.classList.add('modal-btn-group');
    buttons.forEach(btn => group.appendChild(btn));
    return group;
}

// ============================================
// ONBOARDING MODAL
// ============================================

export function initOnboardingModal(container) {
    onboardingModalOverlay = document.createElement('div');
    onboardingModalOverlay.className = 'onboarding-modal-overlay modal-overlay';
    onboardingModalOverlay.style.display = 'none';

    onboardingModalEl = document.createElement('div');
    onboardingModalEl.className = 'onboarding-modal modal-container';
    onboardingModalEl.id = 'onboarding-modal';

    onboardingModalEl.innerHTML = `
        <div class="onboarding-modal-content modal-body">
            <h2 class="onboarding-modal-title modal-title">Steps to Complete Survey</h2>
            <p class="onboarding-modal-subtitle modal-subtitle">Complete these steps for one area of pain or symptom at a time. If you have multiple areas, you will repeat the steps for each one.</p>
            
            <div class="onboarding-steps">
                <div class="onboarding-step">
                    <div class="onboarding-step-icon">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div class="onboarding-step-content">
                        <span class="onboarding-step-number">1</span>
                        <p class="onboarding-step-text">Locate where you experience your pain or symptom</p>
                    </div>
                </div>
                
                <div class="onboarding-step">
                    <div class="onboarding-step-icon">
                        <i class="fa-solid fa-paintbrush"></i>
                    </div>
                    <div class="onboarding-step-content">
                        <span class="onboarding-step-number">2</span>
                        <p class="onboarding-step-text">Draw <strong>one</strong> area of pain or symptom on the body</p>
                    </div>
                </div>
                
                <div class="onboarding-step">
                    <div class="onboarding-step-icon">
                        <i class="fa-solid fa-clipboard-list"></i>
                    </div>
                    <div class="onboarding-step-content">
                        <span class="onboarding-step-number">3</span>
                        <p class="onboarding-step-text">Answer the questionnaire</p>
                    </div>
                </div>
            </div>
            
            <button id="onboarding-start-btn" class="onboarding-start-btn modal-btn-primary">
                Get Started
            </button>
        </div>
    `;

    onboardingModalOverlay.appendChild(onboardingModalEl);
    container.appendChild(onboardingModalOverlay);

    onboardingStartButton = onboardingModalEl.querySelector('#onboarding-start-btn');

    onboardingStartButton.addEventListener('click', () => {
        hideOnboardingModal();
        try {
            localStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
        } catch (e) {
            console.warn('Could not save onboarding state to localStorage:', e);
        }
        if (onOnboardingCompleteCallback) {
            onOnboardingCompleteCallback();
        }
    });
}

export function showOnboardingModal() {
    if (!onboardingModalOverlay) {
        console.warn('Onboarding modal not initialized. Call initOnboardingModal first.');
        return;
    }

    onboardingModalOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
        onboardingModalOverlay.classList.add('visible');
    });
}

export function hideOnboardingModal() {
    if (!onboardingModalOverlay) return;

    onboardingModalOverlay.classList.remove('visible');
    setTimeout(() => {
        onboardingModalOverlay.style.display = 'none';
    }, 300);
}

export function setOnOnboardingComplete(callback) {
    onOnboardingCompleteCallback = callback;
}

// ============================================
// CONTINUE/SURVEY MODAL (3 buttons)
// ============================================

export function initDrawContinueModal(container) {
    continueModalEl = createModal('confirmation-modal');
    const modalContent = createModalContent();

    // Close button (X) in top right corner
    returnModalButton = document.createElement('button');
    returnModalButton.className = 'modal-close-btn';
    returnModalButton.innerHTML = '<i class="fa-solid fa-x"></i>';
    returnModalButton.setAttribute('aria-label', 'Return to Drawing');

    continueModalText = document.createElement('h2');
    continueModalText.id = 'modal-text';

    drawingPreview = document.createElement('img');
    drawingPreview.id = 'drawing-preview';
    drawingPreview.classList.add('drawing-preview');

    returnToSummaryButton = createButton('modal-return-summary', 'Return to Home');
    continueModalButton = createButton('modal-continue', 'Yes, Proceed');

    const buttonGroup = createButtonGroup(returnToSummaryButton, continueModalButton);

    modalContent.appendChild(returnModalButton);
    modalContent.appendChild(continueModalText);
    modalContent.appendChild(drawingPreview);
    modalContent.appendChild(buttonGroup);
    continueModalEl.appendChild(modalContent);
    container.appendChild(continueModalEl);
}

export function showMoveToSurveyModal(text, canProceed, previewDataURL = null, showReturnToSummary = false) {
    continueModalText.textContent = text;

    continueModalButton.style.display = canProceed ? 'flex' : 'none';
    returnToSummaryButton.style.display = showReturnToSummary ? 'flex' : 'none';

    if (previewDataURL) {
        drawingPreview.src = previewDataURL;
        drawingPreview.style.display = 'block';
    } else {
        drawingPreview.style.display = 'none';
    }

    continueModalEl.style.display = 'flex';
}

export function hideDrawContinueModal() {
    continueModalEl.style.display = 'none';
}

// ============================================
// RESET MODAL
// ============================================

export function initDrawResetModal(container) {
    resetModalEl = createModal('reset-modal');
    const modalContent = createModalContent();

    resetModalText = document.createElement('h2');
    resetModalText.id = 'reset-modal-text';
    resetModalText.textContent = 'Are you sure you want to reset your drawing?';

    resetReturnButton = createButton('modal-return-reset', 'Return to My Drawing');
    resetConfirmButton = createButton('modal-confirm-reset', 'Yes, Reset');

    const buttonGroup = createButtonGroup(resetReturnButton, resetConfirmButton);

    modalContent.appendChild(resetModalText);
    modalContent.appendChild(buttonGroup);
    resetModalEl.appendChild(modalContent);
    container.appendChild(resetModalEl);
}

export function showDrawResetModal() {
    resetModalEl.style.display = 'flex';
}

export function hideDrawResetModal() {
    resetModalEl.style.display = 'none';
}

// ============================================
// DELETE EMPTY MODAL
// ============================================

export function initDeleteEmptyModal(container) {
    deleteEmptyModalEl = createModal('delete-empty-modal');
    const modalContent = createModalContent();

    deleteEmptyText = document.createElement('h2');
    deleteEmptyText.id = 'delete-empty-text';

    deleteEmptyReturnButton = createButton('delete-empty-return', 'Return to Drawing');
    deleteEmptyContinueButton = createButton('delete-empty-continue', 'Continue Anyway');

    const buttonGroup = createButtonGroup(deleteEmptyReturnButton, deleteEmptyContinueButton);

    modalContent.appendChild(deleteEmptyText);
    modalContent.appendChild(buttonGroup);
    deleteEmptyModalEl.appendChild(modalContent);
    container.appendChild(deleteEmptyModalEl);
}

export function showDeleteEmptyModal(message) {
    deleteEmptyText.textContent = message || "You haven't made a drawing yet. If you proceed, this area will be deleted.";
    deleteEmptyModalEl.style.display = 'flex';
}

export function hideDeleteEmptyModal() {
    deleteEmptyModalEl.style.display = 'none';
}

// ============================================
// REGION SELECTOR MODAL
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

export function setOnRegionSelected(callback) {
    onRegionSelectedCallback = callback;
}

// ============================================
// FOOTER BUTTON FOR REGION SELECTOR
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
// MODAL ELEMENTS GETTER
// ============================================

export function getModalElements(modalType) {
    const modalMap = {
        continue: {
            continueButton: continueModalButton,
            returnButton: returnModalButton,
            returnToSummaryButton: returnToSummaryButton
        },
        reset: { resetReturnButton, resetConfirmButton },
        deleteEmpty: { deleteEmptyReturnButton, deleteEmptyContinueButton },
        regionSelector: { mainAreaSelect, subAreaSelect, regionConfirmBtn },
        onboarding: { onboardingStartButton }
    };
    return modalMap[modalType] || {};
}
