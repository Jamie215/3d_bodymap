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