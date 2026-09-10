// backendService.js — the single seam between the app and the data backend.
//
// The app collects a SubmissionPayload (assembled by submissionService.js) and
// hands it to submitSubmission(). Everything about *where* and *how* the data is
// stored lives behind this one function, so the backend can be swapped without
// touching the rest of the app.
//
// ── The contract (this is the stable, vendor-neutral part) ──────────────────
//
//   Transport : HTTP POST to a same-origin endpoint, SUBMIT_ENDPOINT below.
//   Request   : Content-Type: application/json
//               body = JSON.stringify(SubmissionPayload)
//                      (see the SubmissionPayload typedef in submissionService.js)
//   Success   : any 2xx response. Response body is ignored by the app.
//   Failure   : any non-2xx, a thrown network error, or a timeout.
//
// The reference implementation of this contract is the Cloudflare Pages
// Function at functions/api/submit.js (stores images in R2, metadata in D1).
// Any backend that honours the contract above — a Supabase Edge Function, a
// Node/Flask server, a Lambda behind API Gateway, etc. — can replace it with no
// change to the client, as long as it answers at SUBMIT_ENDPOINT. If a future
// backend must be reached a different way (e.g. a vendor SDK), this file is the
// only place that changes.
//
// See DATABASE.md → "Swapping the backend" for the full walkthrough.

/** Same-origin endpoint that receives the submission. */
const SUBMIT_ENDPOINT = '/api/submit';

/** Abort the request if the backend hasn't responded within this many ms. */
const SUBMIT_TIMEOUT_MS = 30_000;

/**
 * Send a completed submission to the backend.
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {Promise<{ok: boolean, status: number|null, error?: Error}>}
 *          `ok` is true only on a 2xx response. Never throws — transport
 *          failures are reported via the returned object so callers can show a
 *          retry prompt without a try/catch.
 */
export async function submitSubmission(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
        const response = await fetch(SUBMIT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                error: new Error(`Backend responded ${response.status}`),
            };
        }

        return { ok: true, status: response.status };
    } catch (error) {
        // Network failure, timeout/abort, or DNS error — no HTTP status.
        return { ok: false, status: null, error };
    } finally {
        clearTimeout(timeout);
    }
}
