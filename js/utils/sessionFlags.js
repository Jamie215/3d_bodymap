// sessionFlags.js
// Helpers for "show this once per session" UI flags backed by sessionStorage.
// Centralises the try/catch needed for embedded-widget contexts where
// storage access may be restricted (cross-origin iframes, privacy modes, etc.).
//
// Session scope means: persists across page refresh, cleared when the tab
// closes. This matches the clinical use case — one patient, one tab,
// one form — and gives refresh resilience without permanently suppressing
// the walkthroughs for future patients on shared hardware.

/**
 * Check whether a sessionStorage flag is set.
 * Returns false on any error (storage disabled, quota exceeded, etc.)
 * so callers default to "not yet shown" — the safe failure mode for
 * first-walkthrough UI.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function hasShown(key) {
    try {
        return sessionStorage.getItem(key) === 'true';
    } catch (e) {
        return false;
    }
}

/**
 * Mark a sessionStorage flag as set. Silent failure on error —
 * worst case the user sees the walkthrough again on a future action
 * within this session, which is acceptable degradation.
 *
 * @param {string} key
 */
export function markShown(key) {
    try {
        sessionStorage.setItem(key, 'true');
    } catch (e) {
        console.warn(`Could not save flag "${key}" to sessionStorage:`, e);
    }
}

// ----------------------------------------------------------------------------
// Session-reset notice
// ----------------------------------------------------------------------------
// When a session is reset (on "Finish" or on the idle timeout) the app reloads
// to a clean front page. This flag is set just before that reload so the fresh
// page can show the participant a short "session ended" modal explaining what
// happened. It is deliberately written *after* any sessionStorage.clear() so it
// survives the reload, and is consumed (read once, then removed) on startup.

const SESSION_RESET_NOTICE_KEY = 'painSurvey_sessionResetNotice';

/**
 * Record why the session is ending, to be shown after the reload.
 * @param {'complete'|'idle'} reason
 */
export function setSessionResetNotice(reason) {
    try {
        sessionStorage.setItem(SESSION_RESET_NOTICE_KEY, reason);
    } catch (e) {
        // Storage blocked — the reset still happens, just without the notice.
    }
}

/**
 * Read and clear the session-reset notice.
 * @returns {'complete'|'idle'|null}
 */
export function consumeSessionResetNotice() {
    try {
        const reason = sessionStorage.getItem(SESSION_RESET_NOTICE_KEY);
        if (reason) sessionStorage.removeItem(SESSION_RESET_NOTICE_KEY);
        return reason;
    } catch (e) {
        return null;
    }
}