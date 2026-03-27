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
 * Attaches to: onAfterRenderQuestion for question name "intensityScale"
 */
export function applyRatingLayout(_survey, options) {
    if (options.question.name !== 'intensityScale') return;

    const questionEl = options.htmlElement;
    const ratingContent = questionEl.querySelector('.sd-question__content');
    if (!ratingContent) return;

    // Guard: skip if we already wrapped this element (e.g. after a viewport relayout)
    if (ratingContent.querySelector('.rating-layout-row')) return;

    const ratingRow = ratingContent.querySelector('.sd-rating');
    if (!ratingRow) return;

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