// modal.js
// Barrel file — re-exports every modal module so existing import paths
// (e.g. `from '../components/modal.js'`) continue to work unchanged.
// Pure re-exports only — no logic lives here.

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

// ---- Unified element getter ----
export { getModalElements } from './modals/getModalElements.js';