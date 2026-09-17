// responseSink.js — Response persistence seam (DATABASE-SUBMISSION variant)
//
// Encapsulates HOW a completed response is persisted, so the rest of the app is
// variant-agnostic: appController prepares the payload and hands it to the sink
// without knowing whether it is downloaded, submitted to a backend, etc.
//
// This is the *database-submission* implementation. The backend is not wired yet
// (pending PI decision), so persistResponse is an integration-point stub: it
// prepares/logs the payload where the real API call will go. The local-save
// branch ships a different responseSink.js exposing the same four functions —
// swapping the persistence strategy is a one-file change and is the only
// intended divergence between the two variants.

/**
 * Wire the sink into the app. Called once at startup.
 *
 * The database variant has no participant-facing save screen, so there are no
 * summary callbacks to wire. The signature matches the local-save sink so
 * appController stays identical across variants.
 *
 * @param {Object}   _deps
 * @param {Object}   _deps.summary     The summary view (unused here).
 * @param {Function} _deps.endSession  drawingInstanceManager.endSession (unused here).
 */
export function initResponseSink(_deps) {
    // No-op: the database variant submits programmatically after the
    // questionnaire completes (see persistResponse) — there is no download or
    // confirm-saved screen to wire up.
}

/**
 * Persist a completed submission payload by submitting it to the backend.
 *
 * Integration point: the backend is not connected yet, so for now the payload is
 * prepared and logged. When a backend is available, replace the body with the
 * platform's API call and let a rejected promise propagate so the caller's
 * catch block can surface the error and roll back.
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {Promise<void>}
 */
export async function persistResponse(payload) {
    console.log('Submission data prepared:', payload);

    // ── Integration point ──────────────────────────────────────────────
    // Replace with your platform's API call, e.g.:
    //   const response = await apiService.submit(payload);
    //   if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
    //
    // For now, no backend is connected — the payload is logged above and the
    // flow continues as if the submission succeeded.
    // ────────────────────────────────────────────────────────────────────
}

/**
 * Roll back after a failed {@link persistResponse}. Nothing is kept locally in
 * the database variant, so there is nothing to undo.
 */
export function rollbackResponse() {
    // No-op: no local state to clear.
}

/**
 * Whether there is prepared-but-unsaved work that should warn on page unload.
 * The database variant submits to the backend, so there is nothing held locally
 * to lose — always false.
 *
 * @returns {boolean}
 */
export function hasUnsavedResponse() {
    return false;
}
