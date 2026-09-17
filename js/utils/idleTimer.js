// idleTimer.js
// Inactivity watchdog for shared / provided-device use. After a period with no
// interaction it warns the participant, then — if there is still no response —
// resets the session and reloads the app. This ensures an abandoned session
// does not leave one participant's drawings or questionnaire answers on screen
// (and re-downloadable) for the next person on the same device.
//
// The final "Finish" click flushes data directly (see appController); this
// timer covers the case where the participant walks away mid-session.

import { endSession } from '../app/drawingInstanceManager.js';
import {
    showIdleWarningModal,
    hideIdleWarningModal,
    setIdleWarningCountdown,
    setOnIdleWarningContinue
} from '../components/modal.js';

// Tunable thresholds. Adjust here if the study wants a longer/shorter window.
const IDLE_LIMIT_MS = 10 * 60 * 1000; // no interaction before the warning shows
const WARNING_MS    = 60 * 1000;      // countdown shown before the reset fires
const POLL_MS       = 1000;           // how often idle time is checked

// Interactions that count as the participant still being present.
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

let lastActivity   = Date.now();
let warningActive  = false;
let warningDeadline = 0;
let pollId     = null;
let countdownId = null;

function onActivity() {
    // While the warning is up we require an explicit "Continue" click, so the
    // reset stays deterministic when nobody is actually there.
    if (!warningActive) lastActivity = Date.now();
}

function startWarning() {
    warningActive = true;
    warningDeadline = Date.now() + WARNING_MS;
    setIdleWarningCountdown(Math.ceil(WARNING_MS / 1000));
    showIdleWarningModal();

    countdownId = setInterval(() => {
        const remaining = warningDeadline - Date.now();
        if (remaining <= 0) {
            performReset();
            return;
        }
        setIdleWarningCountdown(Math.ceil(remaining / 1000));
    }, 1000);
}

function cancelWarning() {
    warningActive = false;
    if (countdownId) { clearInterval(countdownId); countdownId = null; }
    hideIdleWarningModal();
    lastActivity = Date.now();
}

function performReset() {
    if (countdownId) { clearInterval(countdownId); countdownId = null; }
    if (pollId)      { clearInterval(pollId);      pollId = null; }

    // Flush data, record the "idle" notice, and reload to a clean front page,
    // where the reloaded app shows the session-reset modal.
    endSession('idle');
}

function poll() {
    if (warningActive) return;
    if (Date.now() - lastActivity >= IDLE_LIMIT_MS) startWarning();
}

/**
 * Start the inactivity watchdog. Call once at startup, after the idle-warning
 * modal has been initialised.
 */
export function initIdleTimer() {
    ACTIVITY_EVENTS.forEach(type =>
        window.addEventListener(type, onActivity, { passive: true })
    );
    setOnIdleWarningContinue(cancelWarning);

    lastActivity = Date.now();
    pollId = setInterval(poll, POLL_MS);
}
