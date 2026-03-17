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
let regionModalEl, regionModalOverlay, mainAreaSelect, subAreaSelect, regionConfirmBtn;
let selectedMainArea = null;
let selectedSubArea = null;
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
 * hideOthers: if true, selecting this area hides non-limb body parts
 * IMPORTANT: These must align with cameraUtils.js dropdownRegions keys
 */
const REGION_HIERARCHY = {
    'Head': {
        subAreas: [],
        cameraRegion: 'Head',
        hideOthers: false
    },
    'Neck': {
        subAreas: [],
        cameraRegion: 'Neck',
        hideOthers: false
    },
    'Torso': {
        subAreas: ['Chest', 'Abdomen', 'Upper Back', 'Mid Back', 'Lower Back', 'Pelvis'],
        cameraRegion: null,
        hideOthers: false
    },
    'Left Arm': {
        subAreas: ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand (Front)', 'Hand (Back)'],
        cameraRegion: null,
        prefix: 'Left',
        hideOthers: true,
        displayName: 'Arm (Left)'
    },
    'Right Arm': {
        subAreas: ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand (Front)', 'Hand (Back)'],
        cameraRegion: null,
        prefix: 'Right',
        hideOthers: true,
        displayName: 'Arm (Right)'
    },
    'Left Leg': {
        subAreas: ['Thigh', 'Knee', 'Calf', 'Ankle', 'Foot'],
        cameraRegion: null,
        prefix: 'Left',
        hideOthers: true,
        displayName: 'Leg (Left)'
    },
    'Right Leg': {
        subAreas: ['Thigh', 'Knee', 'Calf', 'Ankle', 'Foot'],
        cameraRegion: null,
        prefix: 'Right',
        hideOthers: true,
        displayName: 'Leg (Right)'
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
        return subArea || 'Torso';
    }
    
    // For arms and legs, combine prefix with sub-area
    // e.g., "Left" + "Shoulder" = "Left Shoulder"
    // e.g., "Left" + "Hand (Front)" = "Left Hand (Front)"
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
        if (mainArea === 'Torso') {
            // Handle composite 'Torso' (no sub-area)
            if (cameraRegion === 'Torso') {
                return { mainArea: 'Torso', subArea: null };
            }
            if (config.subAreas.includes(cameraRegion)) {
                return { mainArea: 'Torso', subArea: cameraRegion };
            }
        }
        
        // For prefixed regions (Left/Right Arm/Leg)
        if (config.prefix && cameraRegion.startsWith(config.prefix + ' ')) {
            const subArea = cameraRegion.replace(config.prefix + ' ', '');
            if (config.subAreas.includes(subArea)) {
                return { mainArea, subArea };
            }
            // Handle legacy "Left Hand" → default to "Hand (Front)"
            if (subArea === 'Hand') {
                return { mainArea, subArea: 'Hand (Front)' };
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
    
    // Build modal content with dropdowns
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
    
    // Get references to elements
    mainAreaSelect = regionModalEl.querySelector('#main-area-select');
    subAreaSelect = regionModalEl.querySelector('#sub-area-select');
    regionConfirmBtn = regionModalEl.querySelector('#region-confirm-btn');
    
    // Setup event listeners
    setupRegionModalEvents();
}

function setupRegionModalEvents() {
    const subGroup = regionModalEl.querySelector('#sub-area-group');
    
    // Main area selection
    mainAreaSelect.addEventListener('change', (e) => {
        selectedMainArea = e.target.value;
        selectedSubArea = null;
        
        if (selectedMainArea === 'Entire Body') {
            // Entire Body — no sub-areas, enable confirm
            subGroup.style.display = 'none';
            regionConfirmBtn.disabled = false;
        } else if (selectedMainArea && REGION_HIERARCHY[selectedMainArea]) {
            const config = REGION_HIERARCHY[selectedMainArea];
            
            // Show sub-area dropdown only if there are sub-areas
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
            
            // Enable confirm when main area is selected (sub-area is optional)
            regionConfirmBtn.disabled = false;
        } else {
            subGroup.style.display = 'none';
            regionConfirmBtn.disabled = true;
        }
    });
    
    // Sub-area selection
    subAreaSelect.addEventListener('change', (e) => {
        selectedSubArea = e.target.value || null;
    });
    
    // Confirm button
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
        // ── LIMBS (Arms / Legs): hide other body parts, keep entire limb visible ──
        // Resolve ALL region IDs for the entire limb
        const limbIds = resolveRegionIds([selectedMainArea]);
        setVisibleRegions(limbIds, [selectedMainArea]);
        
        if (selectedSubArea) {
            // Focus on the specific sub-area within the limb
            const cameraRegion = mapToCameraRegion(selectedMainArea, selectedSubArea);
            if (AppState.cameraUtils) {
                AppState.cameraUtils.focusOnRegion(cameraRegion, false);
            }
            if (onRegionSelectedCallback) {
                onRegionSelectedCallback(`${selectedMainArea} - ${selectedSubArea}`);
            }
        } else {
            // No sub-area: fit camera to entire limb
            if (AppState.cameraUtils) {
                AppState.cameraUtils.fitToVisibleRegions(limbIds);
            }
            if (onRegionSelectedCallback) {
                onRegionSelectedCallback(selectedMainArea);
            }
        }
    } else {
        // ── HEAD / NECK / TORSO: focus camera only, no visibility filter ──
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
    
    // Trigger animation
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
        regionSelector: { mainAreaSelect, subAreaSelect, regionConfirmBtn },
        onboarding: { onboardingStartButton }
    };
    return modalMap[modalType] || {};
}