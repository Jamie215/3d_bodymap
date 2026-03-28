// modals/getModalElements.js
// Unified element getter — dispatches to each modal's getXxxElements().
// Extracted from modal.js so the barrel file stays pure re-exports.

import { getConfirmDrawingElements }  from './confirmDrawingModal.js';
import { getResetElements }           from './resetModal.js';
import { getDeleteEmptyElements }     from './deleteEmptyModal.js';
import { getDeleteAreaElements }      from './deleteAreaModal.js';
import { getRegionSelectorElements }  from './regionSelectorModal.js';
import { getOnboardingElements }      from './onboardingModal.js';

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