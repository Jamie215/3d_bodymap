// regionMapBuilder.js
// Auto-generates the camera regionMap from vertex group names in region_id_mapping.json.
// Replaces the ~300-line hardcoded buildRegionMap() in CameraUtils.
//
// Classification rules follow the Blender vertex group naming convention:
//   {bodyPart}_{orientation}.{side}
//   e.g. "knee_anterolateral.L" → Left Knee, Left Knee (Front)
//
// Composite keys produced:
//   "Torso"            = Chest ∪ Abdomen ∪ Pelvis ∪ Upper/Mid/Lower Back
//   "{Side} Hand"      = Hand (Front) ∪ Hand (Back)
//   "{Side} Knee"      = Knee (Front) ∪ Knee (Back)  (medial/lateral shared)

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Build the complete regionMap from an array of vertex group names.
 *
 * @param {string[]} regionNames — every name from region_id_mapping.json
 *                                  (the "unassigned" entry is skipped automatically)
 * @returns {Object<string, string[]>} camera-key → vertex-group-names
 */
export function buildRegionMap(regionNames) {
    const map = {};

    for (const name of regionNames) {
        if (name === 'unassigned') continue;

        const keys = classifyToKeys(name);
        for (const key of keys) {
            if (!map[key]) map[key] = [];
            map[key].push(name);
        }
    }

    return map;
}

// ============================================================================
// CLASSIFICATION ENGINE
// ============================================================================

/**
 * Classify a single vertex group name into one or more camera-region keys.
 *
 * A region may appear under multiple keys — for example:
 *   "knee_medial.L" → ["Left Knee", "Left Knee (Front)", "Left Knee (Back)"]
 *   "hand_volar_radial.L" → ["Left Hand", "Left Hand (Front)"]
 *   "chest_anterior.L" → ["Chest", "Torso"]
 */
function classifyToKeys(name) {
    const side = getSide(name);

    // ---- Head ----
    if (name.startsWith('face_') || name.startsWith('head_')) {
        return ['Head'];
    }

    // ---- Neck (unsided camera key) ----
    if (name.startsWith('neck_')) {
        return ['Neck'];
    }

    // ---- Torso sub-regions (unsided camera keys + Torso composite) ----
    if (name.startsWith('chest_') || name.startsWith('axilla')) {
        return ['Chest', 'Torso'];
    }
    if (name.startsWith('abdomen_')) {
        return ['Abdomen', 'Torso'];
    }
    if (name.startsWith('back_upper')) {
        return ['Upper Back', 'Torso'];
    }
    if (name.startsWith('back_mid')) {
        return ['Mid Back', 'Torso'];
    }
    // Lower Back group: back_lower + sacrum, apexSacrum, coccyx, psis, buttock
    if (
        name.startsWith('back_lower') ||
        name === 'sacrum' || name === 'apexSacrum' || name === 'coccyx' ||
        name.startsWith('psis') || name.startsWith('buttock')
    ) {
        return ['Lower Back', 'Torso'];
    }
    // Pelvis group: pelvis_*, pubicSymphysis, hip.*
    if (name.startsWith('pelvis_') || name === 'pubicSymphysis' || name.startsWith('hip')) {
        return ['Pelvis', 'Torso'];
    }

    // ---- Sided limb regions (require .L or .R) ----
    if (!side) return [];

    // Shoulder
    if (name.startsWith('shoulder_')) {
        return [`${side} Shoulder`];
    }

    // Upper Arm
    if (name.startsWith('upperArm_')) {
        return [`${side} Upper Arm`];
    }

    // Elbow
    if (name.startsWith('elbow_')) {
        return [`${side} Elbow`];
    }

    // Forearm
    if (name.startsWith('forearm_')) {
        return [`${side} Forearm`];
    }

    // Wrist
    if (name.startsWith('wrist_')) {
        return [`${side} Wrist`];
    }

    // Hand (hand_*, thumb_*, *Finger_*)
    if (name.startsWith('hand_') || name.startsWith('thumb_') || name.includes('Finger_')) {
        const keys = [`${side} Hand`];
        if (name.includes('volar')) {
            keys.push(`${side} Hand (Front)`);
        } else if (name.includes('dorsal')) {
            keys.push(`${side} Hand (Back)`);
        }
        return keys;
    }

    // Thigh (including thigh_perinium)
    if (name.startsWith('thigh_')) {
        return [`${side} Thigh`];
    }

    // Knee — sub-classify into Front / Back
    // medial and lateral are visible from both front and back
    if (name.startsWith('knee_')) {
        const keys = [`${side} Knee`];
        const orientation = name.split('_')[1].split('.')[0];

        const FRONT = ['anterior', 'anteromedial', 'anterolateral', 'medial', 'lateral'];
        const BACK  = ['posterior', 'posteromedial', 'posterolateral', 'medial', 'lateral'];

        if (FRONT.includes(orientation)) keys.push(`${side} Knee (Front)`);
        if (BACK.includes(orientation))  keys.push(`${side} Knee (Back)`);
        return keys;
    }

    // Lower Leg → camera key "Calf"
    if (name.startsWith('lowerLeg_')) {
        return [`${side} Calf`];
    }

    // Ankle
    if (name.startsWith('ankle_')) {
        return [`${side} Ankle`];
    }

    // Foot (heel, midFoot, foreFoot, toes)
    if (name.startsWith('heel_') || name.includes('Foot_') || name.startsWith('toe')) {
        return [`${side} Foot`];
    }

    // Unclassified — log so it's easy to spot new regions that need rules
    console.warn(`regionMapBuilder: unclassified vertex group "${name}"`);
    return [];
}

// ============================================================================
// HELPERS
// ============================================================================

function getSide(name) {
    if (name.endsWith('.L')) return 'Left';
    if (name.endsWith('.R')) return 'Right';
    return null;
}