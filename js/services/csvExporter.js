// csvExporter.js
//
// Builds the CSV files bundled into the response download. The design favours
// "long / tidy" tables where a field would otherwise explode into many sparse
// columns — most importantly the per-region coverage, which is emitted one row
// per (area, region) rather than one column per region.
//
// Files produced (see buildCsvFiles):
//   session.csv   one row: session metadata, device info, general questionnaire
//   areas.csv     one row per area: summary + area questionnaire answers
//   coverage.csv  long: one row per (area, region) of drawn coverage

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
export function escapeCsv(value) {
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
export function flattenObject(obj, prefix = '', out = {}) {
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
 * Renders rows (array of objects) as a CSV string. Columns default to the union
 * of keys across all rows, in first-seen order.
 *
 * @param {Object[]} rows
 * @param {string[]} [columns]
 * @returns {string}
 */
export function toCsv(rows, columns) {
    const cols = columns || (() => {
        const seen = [];
        const set = new Set();
        rows.forEach(r => Object.keys(r).forEach(k => { if (!set.has(k)) { set.add(k); seen.push(k); } }));
        return seen;
    })();

    const header = cols.map(escapeCsv).join(',');
    const body = rows.map(r => cols.map(c => escapeCsv(r[c])).join(','));
    return [header, ...body].join('\r\n');
}

// ============================================================================
// TABLE BUILDERS
// ============================================================================

/**
 * session.csv — a single row of session-level fields, device info, and the
 * (flattened) general questionnaire answers, prefixed `general.`.
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {string}
 */
export function buildSessionCsv(payload) {
    const row = {
        sessionId: payload.sessionId,
        schemaVersion: payload.schemaVersion,
        startTime: payload.startTime,
        completionTime: payload.completionTime,
        durationSeconds: payload.durationSeconds,
        modelType: payload.modelType,
        totalAreas: payload.totalAreas,
        deviceType: payload.deviceInfo?.deviceType,
        operatingSystem: payload.deviceInfo?.operatingSystem,
        browser: payload.deviceInfo?.browser
    };

    const general = flattenObject(payload.generalQuestionnaire || {});
    for (const [k, v] of Object.entries(general)) row[`general.${k}`] = v;

    return toCsv([row]);
}

/**
 * areas.csv — one row per area: identifiers, coverage summary, and the
 * (flattened) area questionnaire answers. Columns are the union across areas so
 * conditional questions line up (blank where not answered).
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {string}
 */
export function buildAreasCsv(payload) {
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

    return toCsv(rows);
}

/**
 * coverage.csv — long format: one row per (area, region) of drawn coverage.
 * This is the region-by-region table (avoids one sparse column per region).
 *
 * @param {import('./submissionService.js').SubmissionPayload} payload
 * @returns {string}
 */
export function buildCoverageCsv(payload) {
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
    return toCsv(rows, ['sessionId', 'areaNumber', 'region', 'coloredArea', 'percentage', 'bodyContribution']);
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
