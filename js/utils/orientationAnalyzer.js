// orientationAnalyzer.js
// Pure functions for classifying body regions into viewing directions.
//
// They take region names (and optionally a regionMap)
// and return angles, octants, or booleans.

// ============================================================================
// OCTANT CLASSIFICATION
// ============================================================================

/**
 * Classify a single vertex-group region name into one of eight viewing
 * directions (octants) based on its anatomical orientation suffix.
 *
 * Key insight — medial surfaces face the body midline, so the camera
 * must orbit to the *opposite* side to see them:
 *   Left medial  → view from right
 *   Right medial → view from left
 *
 * @param {string} regionName — e.g. "knee_anteromedial.L"
 * @returns {'front'|'front-right'|'right'|'back-right'|'back'|'back-left'|'left'|'front-left'}
 */
export function classifyRegionOctant(regionName) {
    const lower = regionName.toLowerCase();

    // Determine left/right from suffix
    const isLeft  = regionName.endsWith('.L');
    const isRight = regionName.endsWith('.R');

    // Determine medial vs lateral orientation
    const isMedial          = lower.includes('medial') && !lower.includes('anteromedial') && !lower.includes('posteromedial');
    const isAnteromedial    = lower.includes('anteromedial');
    const isPosteromedial   = lower.includes('posteromedial');
    const isLateral         = lower.includes('lateral') && !lower.includes('anterolateral') && !lower.includes('posterolateral');
    const isAnterolateral   = lower.includes('anterolateral');
    const isPosterolateral  = lower.includes('posterolateral');

    // Determine front/back based on anatomical naming conventions
    const isAnterior = lower.includes('anterior') || lower.includes('volar') ||
                       lower.includes('pubic') || lower.includes('chest') ||
                       lower.includes('abdomen') || lower.includes('face') ||
                       lower.includes('dorso');     // dorso on foot = top = front-facing
    const isPosterior = lower.includes('posterior') || lower.includes('plantar') ||
                        lower.includes('back') || lower.includes('buttock') ||
                        lower.includes('sacrum') || lower.includes('coccyx') ||
                        lower.includes('psis') || lower.includes('planto') ||
                        lower.includes('hand_dorsal') || lower.includes('segment_dorsal');

    // === MEDIAL REGIONS: View from OPPOSITE side ===
    if (isMedial) {
        if (isLeft)  return 'right';
        if (isRight) return 'left';
    }

    if (isAnteromedial) {
        if (isLeft)  return 'front-right';
        if (isRight) return 'front-left';
    }

    if (isPosteromedial) {
        if (isLeft)  return 'back-right';
        if (isRight) return 'back-left';
    }

    // === LATERAL REGIONS: View from SAME side ===
    if (isLateral) {
        if (isLeft)  return 'left';
        if (isRight) return 'right';
    }

    if (isAnterolateral) {
        if (isLeft)  return 'front-left';
        if (isRight) return 'front-right';
    }

    if (isPosterolateral) {
        if (isLeft)  return 'back-left';
        if (isRight) return 'back-right';
    }

    // === PURE ANTERIOR / POSTERIOR (no medial/lateral) ===
    if (isPosterior) {
        if (isLeft)  return 'back-left';
        if (isRight) return 'back-right';
        return 'back';
    }

    if (isAnterior) {
        if (isLeft)  return 'front-left';
        if (isRight) return 'front-right';
        return 'front';
    }

    // === DEFAULT: Neutral regions without clear orientation ===
    if (isLeft)  return 'front-left';
    if (isRight) return 'front-right';
    return 'front';
}

// ============================================================================
// DRAWING ORIENTATION ANALYSIS
// ============================================================================

/** Map from octant name to camera rotation angle (radians). */
const OCTANT_ANGLES = {
    'front':       0,
    'front-left':  Math.PI / 4,
    'left':        Math.PI / 2,
    'back-left':   Math.PI * 3 / 4,
    'back':        Math.PI,
    'back-right': -Math.PI * 3 / 4,
    'right':      -Math.PI / 2,
    'front-right':-Math.PI / 4
};

/**
 * Analyze a set of drawn vertex-group names and determine the best
 * camera viewing angle with 45-degree (octant) granularity.
 *
 * @param {Set<string>} drawnRegionNames
 * @returns {{ angle: number, octant: string, confidence: number }}
 */
export function analyzeDrawingOrientation(drawnRegionNames) {
    if (!drawnRegionNames || drawnRegionNames.size === 0) {
        return { angle: 0, octant: 'front', confidence: 0 };
    }

    // Count regions in each octant
    const octantCounts = {
        'front': 0, 'front-right': 0, 'right': 0, 'back-right': 0,
        'back': 0,  'back-left': 0,   'left': 0,  'front-left': 0
    };

    for (const regionName of drawnRegionNames) {
        const octant = classifyRegionOctant(regionName);
        octantCounts[octant]++;
    }

    // Find dominant octant
    let maxCount = 0;
    let dominantOctant = 'front';
    for (const [octant, count] of Object.entries(octantCounts)) {
        if (count > maxCount) {
            maxCount = count;
            dominantOctant = octant;
        }
    }

    const totalRegions = drawnRegionNames.size;

    return {
        angle:      OCTANT_ANGLES[dominantOctant],
        octant:     dominantOctant,
        confidence: totalRegions > 0 ? maxCount / totalRegions : 0
    };
}

// ============================================================================
// REGION DIRECTION HELPERS
// ============================================================================

/**
 * Check whether a camera-region name represents the back of the body.
 *
 * @param {string} regionName — camera-level key (e.g. "Upper Back", "Left Calf")
 * @param {Object<string, string[]>} regionMap — cameraUtils.regionMap
 * @returns {boolean}
 */
export function isBackFacingRegion(regionName, regionMap) {
    const backKeywords = [
        'Back', 'back', 'posterior', 'Posterior',
        'buttock', 'Buttock', 'sacrum', 'coccyx',
        'heel', 'Heel', 'plantar', 'Plantar',
        'Hand (Back)', 'Calf'
    ];

    // Check region name directly
    for (const keyword of backKeywords) {
        if (regionName.includes(keyword)) {
            return true;
        }
    }

    // Check vertex-group names inside the regionMap entry
    const regions = regionMap?.[regionName];
    if (regions) {
        const posteriorCount = regions.filter(r =>
            r.includes('posterior') || r.includes('back_') ||
            r.includes('buttock')   || r.includes('plantar') ||
            r.includes('heel')      || r.includes('sacrum') || r.includes('coccyx') ||
            r.includes('hand_dorsal') || r.includes('_dorsal')
        ).length;

        return posteriorCount > regions.length / 2;
    }

    return false;
}

/**
 * Find the dominant camera-region key that contains the most drawn
 * vertex-group names.
 *
 * @param {Set<string>} drawnRegionNames
 * @param {Object<string, string[]>} regionMap
 * @returns {string|null}
 */
export function findDominantBodyPart(drawnRegionNames, regionMap) {
    if (!drawnRegionNames || drawnRegionNames.size === 0) return null;

    const bodyPartCounts = {};

    for (const specificRegion of drawnRegionNames) {
        for (const [bodyPart, regions] of Object.entries(regionMap)) {
            if (regions.includes(specificRegion)) {
                bodyPartCounts[bodyPart] = (bodyPartCounts[bodyPart] || 0) + 1;
                break;
            }
        }
    }

    let maxCount = 0;
    let dominantBodyPart = null;

    for (const [bodyPart, count] of Object.entries(bodyPartCounts)) {
        if (count > maxCount) {
            maxCount = count;
            dominantBodyPart = bodyPart;
        }
    }

    return dominantBodyPart;
}

/**
 * Get the initial viewing angle for a region (front vs back).
 *
 * @param {string} regionName
 * @returns {number} radians — 0 for front, PI for back
 */
export function getInitialAngle(regionName) {
    if (regionName.includes('Back') || regionName.includes('back')) {
        return Math.PI;
    }
    if (regionName.includes('posterior') || regionName.includes('Posterior')) {
        return Math.PI;
    }
    return 0;
}