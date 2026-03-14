// modal.js
import AppState from "../app/state.js";
import { setVisibleRegions } from "../utils/regionVisibility.js";

// Continue/Survey Modal
let continueModalEl, continueModalText, continueModalButton, returnModalButton, returnToSummaryButton, drawingPreview;

// Reset Modal
let resetModalEl, resetModalText, resetReturnButton, resetConfirmButton;

// Delete Empty Modal
let deleteEmptyModalEl, deleteEmptyText, deleteEmptyReturnButton, deleteEmptyContinueButton;

// Region Selector Modal
let regionModalEl, regionModalOverlay, regionConfirmBtn, selectAllCheckbox;
let checkedAreas = new Set();
let onRegionSelectedCallback = null;

// Onboarding Modal
let onboardingModalEl, onboardingModalOverlay, onboardingStartButton;
let onOnboardingCompleteCallback = null;

// LocalStorage key for tracking if onboarding has been shown
const ONBOARDING_SHOWN_KEY = 'painSurvey_onboardingShown';

/**
 * Region hierarchy for the modal
 * Main Area -> Sub Areas
 * 
 * IMPORTANT: These must align with cameraUtils.js dropdownRegions keys
 */
const REGION_HIERARCHY = {
    'Head': {
        subAreas: [],
        cameraRegion: 'Head'
    },
    'Neck': {
        subAreas: [], // Neck is treated as a single region
        cameraRegion: 'Neck'
    },
    'Torso': {
        subAreas: ['Chest', 'Abdomen', 'Upper Back', 'Mid Back', 'Lower Back', 'Pelvis'],
        cameraRegion: null // Uses sub-area directly
    },
    'Left Arm': {
        subAreas: ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand'],
        cameraRegion: null,
        prefix: 'Left'
    },
    'Right Arm': {
        subAreas: ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand'],
        cameraRegion: null,
        prefix: 'Right'
    },
    'Left Leg': {
        subAreas: ['Thigh', 'Knee', 'Lower Leg', 'Ankle', 'Foot'],
        cameraRegion: null,
        prefix: 'Left'
    },
    'Right Leg': {
        subAreas: ['Thigh', 'Knee', 'Lower Leg', 'Ankle', 'Foot'],
        cameraRegion: null,
        prefix: 'Right'
    }
};

/**
 * Maps sub-area selections to cameraUtils region names
 * 
 * Examples:
 *   mapToCameraRegion('Head', null) => 'Head'
 *   mapToCameraRegion('Torso', 'Chest') => 'Chest'
 *   mapToCameraRegion('Left Arm', 'Shoulder') => 'Left Shoulder'
 *   mapToCameraRegion('Left Leg', 'Foot') => 'Left Foot'
 */
function mapToCameraRegion(mainArea, subArea) {
    const config = REGION_HIERARCHY[mainArea];
    
    if (!config) return 'Entire Body';
    
    // If mainArea has a direct camera region (Head, Neck)
    if (config.cameraRegion) {
        return config.cameraRegion;
    }
    
    // Handle Torso - sub-areas map directly to cameraUtils keys
    if (mainArea === 'Torso') {
        return subArea || 'Chest';
    }
    
    // For arms and legs, combine prefix with sub-area
    // e.g., "Left" + "Shoulder" = "Left Shoulder"
    if (config.prefix && subArea) {
        return `${config.prefix} ${subArea}`;
    }
    
    // Fallback - shouldn't reach here normally
    return 'Entire Body';
}

/**
 * Reverse maps a camera region name back to main area and sub area
 * 
 * Examples:
 *   mapFromCameraRegion('Head') => { mainArea: 'Head', subArea: null }
 *   mapFromCameraRegion('Chest') => { mainArea: 'Torso', subArea: 'Chest' }
 *   mapFromCameraRegion('Left Shoulder') => { mainArea: 'Left Arm', subArea: 'Shoulder' }
 *   mapFromCameraRegion('Left Foot') => { mainArea: 'Left Leg', subArea: 'Foot' }
 */
function mapFromCameraRegion(cameraRegion) {
    if (!cameraRegion || cameraRegion === 'Entire Body') {
        return { mainArea: null, subArea: null };
    }
    
    // Check each main area
    for (const [mainArea, config] of Object.entries(REGION_HIERARCHY)) {
        // Direct match (Head, Neck)
        if (config.cameraRegion === cameraRegion) {
            return { mainArea, subArea: null };
        }
        
        // Torso sub-areas map directly
        if (mainArea === 'Torso' && config.subAreas.includes(cameraRegion)) {
            return { mainArea: 'Torso', subArea: cameraRegion };
        }
        
        // For prefixed regions (Left/Right Arm/Leg)
        if (config.prefix && cameraRegion.startsWith(config.prefix + ' ')) {
            const subArea = cameraRegion.replace(config.prefix + ' ', '');
            if (config.subAreas.includes(subArea)) {
                return { mainArea, subArea };
            }
        }
    }
    
    return { mainArea: null, subArea: null };
}

/**
 * Resolves an array of checked main-area names into numeric _regionid values.
 * 
 * Chain: checked area → all camera region keys → vertex group names → numeric IDs
 * 
 * @param {string[]} areaNames - e.g. ['Head', 'Left Arm']
 * @returns {number[]} array of numeric region IDs
 */
function resolveRegionIds(areaNames) {
    const cameraUtils = AppState.cameraUtils;
    const regionToIdMap = AppState.regionToIdMap;
    if (!cameraUtils || !regionToIdMap) return [];

    const ids = [];

    for (const area of areaNames) {
        const config = REGION_HIERARCHY[area];
        if (!config) continue;

        // Collect all camera-region keys for this main area
        let cameraKeys = [];

        if (config.cameraRegion) {
            // Head, Neck — single key
            cameraKeys.push(config.cameraRegion);
        } else if (config.subAreas && config.subAreas.length > 0) {
            // Torso, Arms, Legs — expand all sub-areas
            for (const sub of config.subAreas) {
                cameraKeys.push(mapToCameraRegion(area, sub));
            }
        }

        // For each camera key, get vertex group names, then resolve to numeric IDs
        for (const key of cameraKeys) {
            const vertexGroupNames = cameraUtils.regionMap[key];
            if (!vertexGroupNames) continue;
            for (const name of vertexGroupNames) {
                const id = regionToIdMap[name];
                if (id !== undefined) {
                    ids.push(id);
                }
            }
        }
    }

    return ids;
}

// Helper to create modal structure
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
    // Add shared secondary button class for base styling
    button.classList.add('modal-btn-secondary');
    button.innerText = text;
    return button;
}

function createButtonGroup(...buttons) {
    const group = document.createElement('div');
    group.classList.add('modal-button-group');
    // Add shared button group class
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
    
    // Build modal content
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
    
    // Get reference to start button
    onboardingStartButton = onboardingModalEl.querySelector('#onboarding-start-btn');
    
    // Setup event listener
    onboardingStartButton.addEventListener('click', () => {
        hideOnboardingModal();
        // Mark as shown in localStorage
        try {
            localStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
        } catch (e) {
            console.warn('Could not save onboarding state to localStorage:', e);
        }
        // Call callback if set
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
    
    // Trigger animation
    requestAnimationFrame(() => {
        onboardingModalOverlay.classList.add('visible');
    });
}

export function hideOnboardingModal() {
    if (!onboardingModalOverlay) return;
    
    onboardingModalOverlay.classList.remove('visible');
    
    // Remove after animation
    setTimeout(() => {
        onboardingModalOverlay.style.display = 'none';
    }, 300);
}

export function setOnOnboardingComplete(callback) {
    onOnboardingCompleteCallback = callback;
}

// ============================================
// CONTINUE/SURVEY MODAL (with 3 buttons)
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

    // Two buttons: Return to Home, Yes Proceed
    returnToSummaryButton = createButton('modal-return-summary', 'Return to Home');
    continueModalButton = createButton('modal-continue', 'Yes, Proceed');
    
    const buttonGroup = createButtonGroup(returnToSummaryButton, continueModalButton);

    modalContent.appendChild(returnModalButton);  // Close btn first (for positioning)
    modalContent.appendChild(continueModalText);
    modalContent.appendChild(drawingPreview);
    modalContent.appendChild(buttonGroup);
    continueModalEl.appendChild(modalContent);
    container.appendChild(continueModalEl);
}

export function showMoveToSurveyModal(text, canProceed, previewDataURL = null, showReturnToSummary = false) {
    continueModalText.textContent = text;
    
    // Show/hide "Yes, Proceed" based on whether user can proceed
    continueModalButton.style.display = canProceed ? 'flex' : 'none';
    
    // Show/hide the Return to Home button
    returnToSummaryButton.style.display = showReturnToSummary ? 'flex' : 'none';
    
    // Always show preview if we have a data URL
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
    
    // Build checkbox list from REGION_HIERARCHY (excluding Entire Body)
    const areaNames = Object.keys(REGION_HIERARCHY);
    const checkboxesHTML = areaNames.map(area => `
        <label class="region-checkbox-item">
            <input type="checkbox" name="body-region" value="${area}" />
            <span class="region-checkbox-label">${area}</span>
        </label>
    `).join('');

    // Build modal content
    regionModalEl.innerHTML = `
        <div class="region-modal-content modal-body">
            <h1 class="region-modal-icon modal-icon"><i class="fa-solid fa-location-dot"></i></h1>
            <h2 class="region-modal-title modal-title">Which Body Areas Do You Want to See?</h2>
            <p class="region-modal-instruction">Select the area(s) where you feel this pain or symptom. Everything else will be hidden so you can focus. Draw only one area at a time — you can add more after.</p>
            
            <div class="region-selectors">
                <label class="region-checkbox-item region-checkbox-select-all">
                    <input type="checkbox" id="region-select-all" />
                    <span class="region-checkbox-label">Select All (Full Body)</span>
                </label>

                <div class="region-checkbox-divider"></div>

                <div class="region-checkbox-grid">
                    ${checkboxesHTML}
                </div>
                
                <button id="region-confirm-btn" class="region-confirm-btn modal-btn-primary" disabled>
                    Confirm Selection
                </button>
            </div>
        </div>
    `;
    
    regionModalOverlay.appendChild(regionModalEl);
    container.appendChild(regionModalOverlay);
    
    // Get references
    regionConfirmBtn = regionModalEl.querySelector('#region-confirm-btn');
    selectAllCheckbox = regionModalEl.querySelector('#region-select-all');
    
    // Setup event listeners
    setupRegionModalEvents();
}

function setupRegionModalEvents() {
    const checkboxes = regionModalEl.querySelectorAll('input[name="body-region"]');
    const allAreaNames = Object.keys(REGION_HIERARCHY);

    // Individual checkbox changes
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                checkedAreas.add(cb.value);
            } else {
                checkedAreas.delete(cb.value);
            }

            // Sync "Select All" state
            selectAllCheckbox.checked = checkedAreas.size === allAreaNames.length;
            selectAllCheckbox.indeterminate = checkedAreas.size > 0 && checkedAreas.size < allAreaNames.length;

            // Enable confirm when at least one is checked
            regionConfirmBtn.disabled = checkedAreas.size === 0;
        });
    });

    // Select All toggle
    selectAllCheckbox.addEventListener('change', () => {
        const shouldCheck = selectAllCheckbox.checked;
        checkboxes.forEach(cb => {
            cb.checked = shouldCheck;
            if (shouldCheck) {
                checkedAreas.add(cb.value);
            } else {
                checkedAreas.delete(cb.value);
            }
        });
        selectAllCheckbox.indeterminate = false;
        regionConfirmBtn.disabled = checkedAreas.size === 0;
    });

    // Confirm button
    regionConfirmBtn.addEventListener('click', () => {
        confirmRegionSelection();
    });
}

function confirmRegionSelection() {
    const allAreaNames = Object.keys(REGION_HIERARCHY);
    const isFullBody = checkedAreas.size === allAreaNames.length;

    if (isFullBody) {
        // All areas selected → show full body, no filter
        setVisibleRegions(null, null);
        if (AppState.cameraUtils) {
            AppState.cameraUtils.resetView();
        }
        // Report as 'Entire Body' to callback
        if (onRegionSelectedCallback) {
            onRegionSelectedCallback('Entire Body');
        }
    } else {
        // Partial selection → resolve to IDs, apply filter + camera fit
        const selectedAreas = [...checkedAreas];
        const regionIds = resolveRegionIds(selectedAreas);

        setVisibleRegions(regionIds, selectedAreas);

        if (AppState.cameraUtils) {
            AppState.cameraUtils.fitToVisibleRegions(regionIds);
        }

        // Report the checked areas to callback
        if (onRegionSelectedCallback) {
            const label = selectedAreas.join(', ');
            onRegionSelectedCallback(label);
        }
    }

    hideRegionSelectorModal();
}

function resetRegionSelections(preselectAreas = null) {
    if (!regionModalEl) return;

    const checkboxes = regionModalEl.querySelectorAll('input[name="body-region"]');
    const allAreaNames = Object.keys(REGION_HIERARCHY);

    checkedAreas.clear();

    if (preselectAreas && preselectAreas.length > 0) {
        // Pre-check the given areas
        checkboxes.forEach(cb => {
            const shouldCheck = preselectAreas.includes(cb.value);
            cb.checked = shouldCheck;
            if (shouldCheck) checkedAreas.add(cb.value);
        });
    } else {
        // Default: check all (full body)
        checkboxes.forEach(cb => {
            cb.checked = true;
            checkedAreas.add(cb.value);
        });
    }

    // Sync Select All state
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkedAreas.size === allAreaNames.length;
        selectAllCheckbox.indeterminate = checkedAreas.size > 0 && checkedAreas.size < allAreaNames.length;
    }

    if (regionConfirmBtn) {
        regionConfirmBtn.disabled = checkedAreas.size === 0;
    }
}

export function showRegionSelectorModal() {
    if (!regionModalOverlay) {
        console.warn('Region selector modal not initialized. Call initRegionSelectorModal first.');
        return;
    }
    
    regionModalOverlay.style.display = 'flex';
    
    // Trigger animation
    requestAnimationFrame(() => {
        regionModalOverlay.classList.add('visible');
    });
    
    // If there's an active visibility filter, pre-check only those areas.
    // Otherwise default to all checked (full body).
    if (AppState.visibleRegionIds) {
        // Reverse-resolve which main areas are currently visible
        const currentAreas = getCurrentlyVisibleAreas();
        resetRegionSelections(currentAreas.length > 0 ? currentAreas : null);
    } else {
        resetRegionSelections(null); // all checked
    }
}

/**
 * Determines which main area names are currently visible based on AppState.visibleRegionIds.
 * Used to pre-check the correct boxes when reopening the modal.
 */
function getCurrentlyVisibleAreas() {
    const visibleIds = AppState.visibleRegionIds;
    if (!visibleIds) return [];

    const cameraUtils = AppState.cameraUtils;
    const regionToIdMap = AppState.regionToIdMap;
    if (!cameraUtils || !regionToIdMap) return [];

    const visibleAreas = [];

    for (const [area, config] of Object.entries(REGION_HIERARCHY)) {
        // Get all camera keys for this area
        let cameraKeys = [];
        if (config.cameraRegion) {
            cameraKeys.push(config.cameraRegion);
        } else if (config.subAreas?.length > 0) {
            for (const sub of config.subAreas) {
                cameraKeys.push(mapToCameraRegion(area, sub));
            }
        }

        // Check if ANY region ID in this area is in the visible set
        let hasVisible = false;
        for (const key of cameraKeys) {
            const names = cameraUtils.regionMap[key];
            if (!names) continue;
            for (const name of names) {
                if (visibleIds.has(regionToIdMap[name])) {
                    hasVisible = true;
                    break;
                }
            }
            if (hasVisible) break;
        }

        if (hasVisible) visibleAreas.push(area);
    }

    return visibleAreas;
}

export function hideRegionSelectorModal() {
    if (!regionModalOverlay) return;
    
    regionModalOverlay.classList.remove('visible');
    
    // Remove after animation
    setTimeout(() => {
        regionModalOverlay.style.display = 'none';
    }, 300);
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
        regionSelector: { regionConfirmBtn, selectAllCheckbox },
        onboarding: { onboardingStartButton }
    };
    return modalMap[modalType] || {};
}