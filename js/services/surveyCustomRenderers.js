// surveyCustomRenderers.js
// Self-contained SurveyJS onAfterRenderQuestion callbacks extracted
// from surveyManager.js.  Each function receives (survey, options) and
// can be passed directly to surveyInstance.onAfterRenderQuestion.add().

// ============================================================================
// AREA SURVEY — Intensity Rating Layout
// ============================================================================

/**
 * Wrap the intensity-scale rating widget in a row layout with
 * "No pain" / "Worst pain" labels on either side.
 *
 * SurveyJS auto-switches the rating widget between a 0–10 button scale
 * and a dropdown based on viewport width. Two corollaries handled here:
 *
 *   1. The widget swap happens via an *internal Knockout binding* —
 *      it does NOT fire onAfterRenderQuestion, so a one-shot layout
 *      pass would leave a stale wrapper alongside the new widget after
 *      e.g. a tablet rotation. We attach a MutationObserver to the
 *      content node to re-apply layout on any child-list change.
 *   2. The flanking "No pain / Worst pain" labels only make semantic
 *      sense around the button row. In dropdown mode they read as
 *      orphaned text, so the wrap step is skipped.
 *
 * Attaches to: onAfterRenderQuestion for question name "intensityScale"
 */
export function applyRatingLayout(_survey, options) {
    if (options.question.name !== 'intensityScale') return;

    const questionEl = options.htmlElement;
    const ratingContent = questionEl.querySelector('.sd-question__content');
    if (!ratingContent) return;

    // Initial layout pass for whichever mode SurveyJS rendered first.
    relayoutIntensityScale(ratingContent);

    // Set up the observer once per content node. The flag is stored
    // on the DOM node itself — when the question is destroyed and
    // re-rendered (e.g. survey navigation), a fresh node has no flag
    // and gets its own observer. The old observer is GC'd with its node.
    if (ratingContent.__intensityObserverAttached) return;
    ratingContent.__intensityObserverAttached = true;

    const observer = new MutationObserver(() => {
        // Disconnect-during-mutate: our own DOM ops (teardown + wrap)
        // would otherwise re-trigger this callback. Re-observe after.
        observer.disconnect();
        relayoutIntensityScale(ratingContent);
        observer.observe(ratingContent, { childList: true });
    });
    observer.observe(ratingContent, { childList: true });
}

/**
 * Idempotent layout pass for the intensity-scale rating question.
 * Removes any pre-existing wrapper (whose contents may have been
 * orphaned by a Knockout swap), then re-wraps the current rating —
 * but only when SurveyJS rendered the button-scale variant.
 */
function relayoutIntensityScale(ratingContent) {
    // Teardown — discard any wrapper from a previous mode. If Knockout
    // already removed the old .sd-rating from inside it, the wrapper
    // is empty (labels only); if not, the stale rating goes with it.
    // Either way, the wrapper is gone and the current widget (placed
    // by Knockout at its tracked location) is now exposed.
    const existingWrapper = ratingContent.querySelector('.rating-layout-row');
    if (existingWrapper) {
        existingWrapper.remove();
    }

    const ratingRow = ratingContent.querySelector('.sd-rating');
    if (!ratingRow) return;

    // Dropdown mode detection: SurveyJS renders .sd-rating__item children
    // only for the button-scale variant. If none exist, leave the
    // dropdown alone — no flanking labels.
    const isButtonScale = !!ratingRow.querySelector('.sd-rating__item');
    if (!isButtonScale) return;

    const layoutRow = document.createElement('div');
    layoutRow.classList.add('rating-layout-row');

    const minLabel = document.createElement('div');
    minLabel.innerHTML = 'No pain<br>or symptom';
    minLabel.classList.add('rating-layout-label');

    const maxLabel = document.createElement('div');
    maxLabel.innerHTML = 'Worst pain<br>or symptom<br>imaginable';
    maxLabel.classList.add('rating-layout-label');

    ratingContent.removeChild(ratingRow);
    layoutRow.appendChild(minLabel);
    layoutRow.appendChild(ratingRow);
    layoutRow.appendChild(maxLabel);
    ratingContent.appendChild(layoutRow);
}

// ============================================================================
// GENERAL SURVEY — Medication Description Injection
// ============================================================================

/** Per-row example text shown beneath each medication category. */
const MEDICATION_DESCRIPTIONS = {
    'over-the-counter':               'e.g.,: Advil (ibuprofen), Aleve (naproxen), Aspirin (ASA), Motrin (ibuprofen), Tylenol (acetaminophen)',
    'non-steroidal-anti-inflammatory': 'e.g.,: Arthrotec, Celecoxib, Celebrex, Voltaren',
    'muscle-relaxant':                 'e.g.,: Flexeril, Robaxacet, Robaxin',
    'narcotic-pain-medication':        'e.g.,: Demerol, MS Contin, Morphine, Oxycontin, Percocet, Talwin, Tylenol 3',
    'anti-depressant':                 'e.g.,: Celexa, Cipralex, Cymbalta, Elavil, Paxil, Prozac, Wellbutrin, Zoloft',
    'neuroleptics':                    'e.g.,: Lyrica, Neurontin, Gabapentin, Rivotril, Tegretol',
    'cannabis':                        'e.g.,: Smoked, Inhaled, Edible, Oil, Cream',
};

/**
 * Inject descriptive sub-text below each row of the medication matrix
 * question so users can see example medications.
 *
 * Attaches to: onAfterRenderQuestion for question name "medicationTable"
 * (type === 'matrix')
 */
export function injectMedicationDescriptions(_survey, options) {
    if (options.question.name !== 'medicationTable' || options.question.getType() !== 'matrix') return;

    setTimeout(() => {
        const tbody = options.htmlElement.querySelector('tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr.sd-table__row');

        options.question.visibleRows.forEach((questionRow, index) => {
            const fullName = questionRow.fullName;
            const rowValue = fullName ? fullName.split('_').pop() : null;
            const domRow   = rows[index];

            if (rowValue && MEDICATION_DESCRIPTIONS[rowValue] && domRow) {
                const textCell = domRow.querySelector('td.sd-table__cell--row-text');
                if (textCell && !textCell.querySelector('.medication-description')) {
                    const desc = document.createElement('div');
                    desc.className = 'medication-description';
                    desc.textContent = MEDICATION_DESCRIPTIONS[rowValue];
                    textCell.appendChild(desc);
                }
            }
        });
    }, 100);
}