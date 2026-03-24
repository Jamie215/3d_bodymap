// modal.js
// Barrel file — re-exports every modal module so existing import paths
// (e.g. `from '../components/modal.js'`) continue to work unchanged.

// ---- Onboarding ----
export {
    initOnboardingModal,
    showOnboardingModal,
    hideOnboardingModal,
    hasOnboardingBeenShown,
    setOnOnboardingComplete
} from './modals/onboardingModal.js';

// ---- Confirm Drawing ("Done Drawing" modal) ----
export {
    initDrawContinueModal,
    showMoveToSurveyModal,
    hideDrawContinueModal
} from './modals/confirmDrawingModal.js';

// ---- Reset Drawing ----
export {
    initDrawResetModal,
    showDrawResetModal,
    hideDrawResetModal
} from './modals/resetModal.js';

// ---- Delete Empty Drawing ----
export {
    initDeleteEmptyModal,
    showDeleteEmptyModal,
    hideDeleteEmptyModal
} from './modals/deleteEmptyModal.js';

// ---- Delete Area ----
export {
    initDeleteAreaModal,
    showDeleteAreaModal,
    hideDeleteAreaModal
} from './modals/deleteAreaModal.js';

// ---- Region Selector ----
export {
    initRegionSelectorModal,
    showRegionSelectorModal,
    hideRegionSelectorModal,
    setOnRegionSelected,
    createRegionSelectorFooterButton
} from './modals/regionSelectorModal.js';

// ---- Unified element getter (used by appController, drawingControls) ----
import { getConfirmDrawingElements }  from './modals/confirmDrawingModal.js';
import { getResetElements }           from './modals/resetModal.js';
import { getDeleteEmptyElements }     from './modals/deleteEmptyModal.js';
import { getDeleteAreaElements }      from './modals/deleteAreaModal.js';
import { getRegionSelectorElements }  from './modals/regionSelectorModal.js';
import { getOnboardingElements }      from './modals/onboardingModal.js';

/**
 * Retrieve DOM references for a specific modal's interactive elements.
 *
 * @param {'continue'|'reset'|'deleteEmpty'|'deleteArea'|'regionSelector'|'onboarding'} modalType
 * @returns {Object}
 */
export function getModalElements(modalType) {
    const modalMap = {
        continue:       getConfirmDrawingElements,
        reset:          getResetElements,
        deleteEmpty:    getDeleteEmptyElements,
        deleteArea:     getDeleteAreaElements,
        regionSelector: getRegionSelectorElements,
        onboarding:     getOnboardingElements
    };

    const getter = modalMap[modalType];
    return getter ? getter() : {};
}