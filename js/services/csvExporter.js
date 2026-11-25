// csvExporter.js
//
// Builds the CSV files bundled into the response download. The design favours
// "long / tidy" tables where a field would otherwise explode into many sparse
// columns — most importantly the per-region coverage, which is emitted one row
// per (area, region) rather than one column per region.
//
// Files produced (see buildCsvFiles):
//   session.csv   one row: session metadata + general questionnaire
//   areas.csv     one row per area: summary + area questionnaire answers
//   coverage.csv  long: one row per (area, region) of drawn coverage
//
// Every file always has the SAME columns in the SAME order, whatever the study
// mode or the answers: the questionnaire columns are listed from the survey
// definitions, not from the answers that happen to be present. A question that
// was not shown (a conditional follow-up, or every question in drawing-only
// mode) is a blank cell, never a missing column. Blank is used rather than a
// text code like "N/A" so numeric columns stay numeric in R/pandas/Excel, which
// all read a blank cell as missing. `studyMode` says why a cell is blank.

import { areaSurveyJson } from '../data/areaSurvey.js';
import { generalSurveyJson } from '../data/generalSurvey.js';

// ============================================================================
// PRIMITIVES
// ============================================================================

/**
 * Escapes a single CSV field. Quotes the value when it contains a comma, quote,
 * or newline, doubling any embedded quotes. null/undefined become empty.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    let s;
    if (typeof value === 'boolean') s = value ? 'true' : 'false';
    else if (typeof value === 'number') s = Number.isFinite(value) ? String(value) : '';
    else s = String(value);

    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * Flattens a nested object/array into dotted keys with primitive values, e.g.
 * `{ medications: { Opioids: "Daily" } }` → `{ "medications.Opioids": "Daily" }`.
 * Arrays of primitives are joined with "; "; arrays of objects are indexed.
 *
 * @param {Object} obj
 * @param {string} [prefix]
 * @param {Object<string,string>} [out]
 * @returns {Object<string,string>}
 */
function flattenObject(obj, prefix = '', out = {}) {
    if (obj === null || obj === undefined) return out;

    if (Array.isArray(obj)) {
        const allPrimitive = obj.every(v => v === null || typeof v !== 'object');
        if (allPrimitive) {
            out[prefix] = obj.join('; ');
        } else {
            obj.forEach((v, i) => flattenObject(v, prefix ? `${prefix}.${i}` : String(i), out));
        }
        return out;
    }

    if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
            const key = prefix ? `${prefix}.${k}` : k;
            if (v !== null && typeof v === 'object') flattenObject(v, key, out);
            else out[key] = v;
        }
        return out;
    }

    out[prefix] = obj;
    return out;
}

/**
 * Renders rows (array of objects) as a CSV string with exactly the given
 * columns, in order. A column a row has no value for is a blank cell.
 *
 * @param {Object[]} rows
 * @param {string[]} columns
 * @returns {string}
 */
function toCsv(rows, columns) {
    const header = columns.map(escapeCsv).join(',');
    const body = rows.map(r => columns.map(c => escapeCsv(r[c])).join(','));
    return [header, ...body].join('\r\n');
}

// ============================================================================
// FIXED COLUMNS
// ============================================================================

/** Survey element types that hold no answer, so get no column. */
const NON_ANSWER_TYPES = new Set(['html', 'image']);

/**
 * Lists the CSV columns for a SurveyJS definition, in question order, using
 * the same dotted keys flattenObject() produces from the answers:
 *   - one column per question, named `<prefix><name>`
 *   - a matrix gets one column per row: `<prefix><name>.<row value>`
 *   - a question with an "Other" option or a comment box also gets
 *     `<prefix><name>-Comment`, where SurveyJS stores the typed text
 *     (the main column then holds the value `other`)
 *
 * @param {Object} surveyJson — a SurveyJS definition (pages → elements, panels nest)
 * @param {string} prefix     — column prefix, e.g. 'q.' or 'general.'
 * @returns {string[]}
 */
function surveyColumns(surveyJson, prefix) {
    const columns = [];

    const visit = (elements = []) => {
        for (const el of elements) {
            if (Array.isArray(el.elements)) { visit(el.elements); continue; } // panel
            if (NON_ANSWER_TYPES.has(el.type)) continue;

            if (el.type === 'matrix') {
                for (const row of el.rows || []) {
                    const rowValue = typeof row === 'object' ? row.value : row;
                    columns.push(`${prefix}${el.name}.${rowValue}`);
                }
                continue;
            }

            columns.push(`${prefix}${el.name}`);
            if (el.showOtherItem || el.hasOther || el.showCommentArea || el.hasComment) {
                columns.push(`${prefix}${el.name}-Comment`);
            }
        }
    };

    (surveyJson.pages || []).forEach(page => visit(page.elements));
    visit(surveyJson.elements);
    return columns;
}

const SESSION_COLUMNS = [
    'sessionId', 'schemaVersion', 'studyMode', 'startTime', 'completionTime',
    'durationSeconds', 'modelType', 'totalAreas',
    ...surveyColumns(generalSurveyJson, 'general.')
];

const AREA_COLUMNS = [
    'sessionId', 'areaNumber', 'areaId', 'drawnRegions', 'overallPercentage', 'coloredArea',
    ...surveyColumns(areaSurveyJson, 'q.')
];

const COVERAGE_COLUMNS = ['sessionId', 'areaNumber', 'region', 'coloredArea', 'percentage', 'bodyContribution'];

/**
 * The fixed columns, plus any key found in the rows that the fixed list does
 * not know about. That should never happen, but if a survey definition and the
 * stored answers ever drift apart, the answer is kept (as an extra column at
 * the end) rather than silently dropped.
 *
 * @param {string[]} fixed
 * @param {Object[]} rows
 * @returns {string[]}
 */
function columnsFor(fixed, rows) {
    const known = new Set(fixed);
    const extra = [];
    rows.forEach(r => Object.keys(r).forEach(k => {
        if (!known.has(k)) { known.add(k); extra.push(k); }
    }));
    if (extra.length) console.warn('CSV export: answers with no matching survey question:', extra);
    return [...fixed, ...extra];
}

// ============================================================================
// TABLE BUILDERS
// ============================================================================

/**
 * session.csv — a single row of session-level fields and the (flattened) general
 * questionnaire answers, prefixed `general.`.
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {string}
 */
function buildSessionCsv(payload) {
    const row = {
        sessionId: payload.sessionId,
        schemaVersion: payload.schemaVersion,
        studyMode: payload.studyMode,
        startTime: payload.startTime,
        completionTime: payload.completionTime,
        durationSeconds: payload.durationSeconds,
        modelType: payload.modelType,
        totalAreas: payload.totalAreas
    };

    const general = flattenObject(payload.generalQuestionnaire || {});
    for (const [k, v] of Object.entries(general)) row[`general.${k}`] = v;

    return toCsv([row], columnsFor(SESSION_COLUMNS, [row]));
}

/**
 * areas.csv — one row per area: identifiers, coverage summary, and the
 * (flattened) area questionnaire answers. Columns are fixed (see AREA_COLUMNS),
 * so conditional questions line up across areas and sessions (blank where not
 * shown).
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {string}
 */
function buildAreasCsv(payload) {
    const rows = (payload.areas || []).map((area) => {
        const row = {
            sessionId: payload.sessionId,
            areaNumber: area.areaNumber,
            areaId: area.areaId,
            drawnRegions: Array.isArray(area.drawnRegions) ? area.drawnRegions.join('; ') : '',
            overallPercentage: area.coverage?.overallPercentage,
            coloredArea: area.coverage?.coloredArea
        };
        const answers = flattenObject(area.questionnaireResponses || {});
        for (const [k, v] of Object.entries(answers)) row[`q.${k}`] = v;
        return row;
    });

    return toCsv(rows, columnsFor(AREA_COLUMNS, rows));
}

/**
 * coverage.csv — long format: one row per (area, region) of drawn coverage.
 * This is the region-by-region table (avoids one sparse column per region).
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {string}
 */
function buildCoverageCsv(payload) {
    const rows = [];
    for (const area of payload.areas || []) {
        const regions = area.coverage?.regionBreakdown || {};
        for (const [region, entry] of Object.entries(regions)) {
            rows.push({
                sessionId: payload.sessionId,
                areaNumber: area.areaNumber,
                region,
                coloredArea: entry?.coloredArea,
                percentage: entry?.percentage,
                bodyContribution: entry?.bodyContribution
            });
        }
    }

    // Stable columns even when there is no drawn coverage at all.
    return toCsv(rows, COVERAGE_COLUMNS);
}

/**
 * Builds every CSV file for the download bundle.
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {Object<string,string>} filename → CSV text
 */
export function buildCsvFiles(payload) {
    return {
        'session.csv': buildSessionCsv(payload),
        'areas.csv': buildAreasCsv(payload),
        'coverage.csv': buildCoverageCsv(payload)
    };
}
