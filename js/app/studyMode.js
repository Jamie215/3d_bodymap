// studyMode.js
// Which version of the form this session runs. The participant picks it on the
// first screen (see modeChoiceModal.js), before onboarding.
//
//   'full'          Draw an area, answer that area's questionnaire, repeat,
//                   then answer the general questionnaire and save.
//   'drawing-only'  Draw the areas and save. No questionnaires are shown.
//
// The choice is locked for the session: once set it cannot be changed, so one
// participant's record is always entirely one mode (never a mix of areas with
// and without questionnaires).
//
// It is kept in sessionStorage so an accidental page refresh does not ask
// again — the same scope as the onboarding flag. Ending a session clears
// sessionStorage (see endSession in drawingInstanceManager.js), so the next
// participant chooses afresh.

export const STUDY_MODES = Object.freeze({
    FULL: 'full',
    DRAWING_ONLY: 'drawing-only'
});

const STORAGE_KEY = 'painSurvey_studyMode';

function isValidMode(mode) {
    return Object.values(STUDY_MODES).includes(mode);
}

function readStoredMode() {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        return isValidMode(stored) ? stored : null;
    } catch (e) {
        return null; // storage blocked — the participant is simply asked again
    }
}

/** @type {'full'|'drawing-only'|null} null until the participant chooses */
let currentMode = readStoredMode();

/** Whether the participant has chosen a mode for this session yet. */
export function hasStudyMode() {
    return currentMode !== null;
}

/**
 * The mode for this session.
 * @returns {'full'|'drawing-only'|null}
 */
export function getStudyMode() {
    return currentMode;
}

/** True when this session skips every questionnaire. */
export function isDrawingOnly() {
    return currentMode === STUDY_MODES.DRAWING_ONLY;
}

/**
 * Record the participant's choice. Can only be done once per session.
 *
 * @param {'full'|'drawing-only'} mode
 * @throws {Error} if the mode is unknown or a mode was already chosen
 */
export function setStudyMode(mode) {
    if (!isValidMode(mode)) {
        throw new Error(`Unknown study mode: ${mode}`);
    }
    if (currentMode !== null) {
        throw new Error(`Study mode is already set to "${currentMode}" for this session`);
    }
    currentMode = mode;
    try {
        sessionStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
        // Storage blocked — the choice still holds for this page; a refresh
        // would ask again, which is the safe fallback.
    }
}
