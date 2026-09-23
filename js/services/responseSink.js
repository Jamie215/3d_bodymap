// responseSink.js — Response persistence seam (LOCAL-SAVE variant)
//
// Encapsulates HOW a completed response is persisted, so the rest of the app is
// variant-agnostic: appController prepares the payload and hands it to the sink
// without knowing whether it is downloaded, submitted to a backend, etc.
//
// This is the *local-save* implementation: the response is saved by letting the
// participant download a ZIP bundle (JSON + images + CSV) and store it on a
// provided encrypted device. The database-submission branch (`main`) ships a
// different responseSink.js exposing the same four functions, so swapping the
// persistence strategy is a one-file change and is the only intended difference
// between the two variants.

import AppState from '../app/state.js';
import { downloadSubmissionZip } from './submissionService.js';

let endSessionFn = null;

/**
 * Wire the sink into the app. Called once at startup.
 *
 * @param {Object}   deps
 * @param {Object}   deps.summary     The summary view (exposes set*Callback).
 * @param {Function} deps.endSession  drawingInstanceManager.endSession — flushes
 *                                     in-memory data and returns to a clean page.
 */
export function initResponseSink({ summary, endSession }) {
    endSessionFn = endSession;

    // Save-to-device screen: the download is triggered by the button (not
    // automatically) and can be clicked again if the file is misplaced.
    summary.setDownloadCallback(async () => {
        if (!AppState.submissionPayload) return;
        try {
            await downloadSubmissionZip(AppState.submissionPayload);
        } catch (error) {
            console.error('Download failed:', error);
            alert('There was an error preparing your response for download. Please try again.');
        }
    });

    summary.setConfirmSavedCallback(() => {
        // The participant has confirmed the file is saved. End the session: flush
        // all in-memory data and reload to a clean front page, where a "session
        // complete" notice is shown (nothing left behind on a shared/provided
        // device).
        endSessionFn('complete');
    });
}

/**
 * Persist a completed submission payload. For the local-save variant this keeps
 * the payload in memory so the "Save to device" screen can offer it for download
 * — the download itself is user-triggered, not automatic.
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {Promise<void>}
 */
export async function persistResponse(payload) {
    AppState.submissionPayload = payload;
    AppState.downloadConfirmed = false;
}

/**
 * Roll back after a failed {@link persistResponse} so the participant can retry.
 */
export function rollbackResponse() {
    AppState.submissionPayload = null;
}

/**
 * Whether there is prepared-but-unsaved work that should warn on page unload.
 * Without a backend, closing before the file is saved would lose the session.
 *
 * @returns {boolean}
 */
export function hasUnsavedResponse() {
    return !!AppState.generalQuestionnaireResponse && !AppState.downloadConfirmed;
}
