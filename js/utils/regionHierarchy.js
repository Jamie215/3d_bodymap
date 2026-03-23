// regionHierarchy.js
// Pure data and mapping logic for body region hierarchy.
// No DOM dependencies — used by modal.js for the region selector UI
// and available to any module that needs region ↔ camera mappings.

import AppState from '../app/state.js';

/**
 * Region hierarchy for the region selector modal.
 * Main Area → Sub Areas
 *
 * hideOthers: if true, selecting this area hides non-limb body parts
 * IMPORTANT: Sub-area camera keys must align with cameraUtils.js regionMap keys
 */
export const REGION_HIERARCHY = {
    'Head': {
        subAreas: [],
        cameraRegion: 'Head',
        hideOthers: false
    },
    'Neck': {
        subAreas: [],
        cameraRegion: 'Neck',
        hideOthers: false
    },
    'Torso': {
        subAreas: ['Chest', 'Abdomen', 'Upper Back', 'Mid Back', 'Lower Back', 'Pelvis'],
        cameraRegion: null,
        hideOthers: false
    },
    'Left Arm': {
        subAreas: ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand (Front)', 'Hand (Back)'],
        cameraRegion: null,
        prefix: 'Left',
        hideOthers: true,
        displayName: 'Arm (Left)'
    },
    'Right Arm': {
        subAreas: ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand (Front)', 'Hand (Back)'],
        cameraRegion: null,
        prefix: 'Right',
        hideOthers: true,
        displayName: 'Arm (Right)'
    },
    'Left Leg': {
        subAreas: ['Thigh', 'Knee (Front)', 'Knee (Back)', 'Calf', 'Ankle', 'Foot'],
        cameraRegion: null,
        prefix: 'Left',
        hideOthers: true,
        displayName: 'Leg (Left)'
    },
    'Right Leg': {
        subAreas: ['Thigh', 'Knee (Front)', 'Knee (Back)', 'Calf', 'Ankle', 'Foot'],
        cameraRegion: null,
        prefix: 'Right',
        hideOthers: true,
        displayName: 'Leg (Right)'
    }
};

/**
 * Maps a main area + optional sub-area selection to a cameraUtils region key.
 *
 * Examples:
 *   mapToCameraRegion('Head', null)              → 'Head'
 *   mapToCameraRegion('Torso', 'Chest')          → 'Chest'
 *   mapToCameraRegion('Left Arm', 'Shoulder')    → 'Left Shoulder'
 *   mapToCameraRegion('Left Leg', 'Foot')        → 'Left Foot'
 */
export function mapToCameraRegion(mainArea, subArea) {
    const config = REGION_HIERARCHY[mainArea];

    if (!config) return 'Entire Body';

    // Direct camera region (Head, Neck)
    if (config.cameraRegion) {
        return config.cameraRegion;
    }

    // Torso sub-areas map directly to cameraUtils keys
    if (mainArea === 'Torso') {
        return subArea || 'Torso';
    }

    // Arms and legs: combine prefix with sub-area
    if (config.prefix && subArea) {
        return `${config.prefix} ${subArea}`;
    }

    return 'Entire Body';
}

/**
 * Reverse maps a camera region name back to { mainArea, subArea }.
 *
 * Examples:
 *   mapFromCameraRegion('Head')            → { mainArea: 'Head', subArea: null }
 *   mapFromCameraRegion('Chest')           → { mainArea: 'Torso', subArea: 'Chest' }
 *   mapFromCameraRegion('Left Shoulder')   → { mainArea: 'Left Arm', subArea: 'Shoulder' }
 *   mapFromCameraRegion('Left Foot')       → { mainArea: 'Left Leg', subArea: 'Foot' }
 */
export function mapFromCameraRegion(cameraRegion) {
    if (!cameraRegion || cameraRegion === 'Entire Body') {
        return { mainArea: null, subArea: null };
    }

    // Direct match for main area names (e.g., "Left Leg" stored by fitToVisibleRegions)
    if (REGION_HIERARCHY[cameraRegion]) {
        return { mainArea: cameraRegion, subArea: null };
    }

    for (const [mainArea, config] of Object.entries(REGION_HIERARCHY)) {
        // Direct match (Head, Neck)
        if (config.cameraRegion === cameraRegion) {
            return { mainArea, subArea: null };
        }

        // Torso sub-areas map directly
        if (mainArea === 'Torso') {
            if (cameraRegion === 'Torso') {
                return { mainArea: 'Torso', subArea: null };
            }
            if (config.subAreas.includes(cameraRegion)) {
                return { mainArea: 'Torso', subArea: cameraRegion };
            }
        }

        // Prefixed regions (Left/Right Arm/Leg)
        if (config.prefix && cameraRegion.startsWith(config.prefix + ' ')) {
            const subArea = cameraRegion.replace(config.prefix + ' ', '');
            if (config.subAreas.includes(subArea)) {
                return { mainArea, subArea };
            }
            // Legacy fallbacks
            if (subArea === 'Hand') {
                return { mainArea, subArea: 'Hand (Front)' };
            }
            if (subArea === 'Knee') {
                return { mainArea, subArea: 'Knee (Front)' };
            }
        }
    }

    return { mainArea: null, subArea: null };
}

/**
 * Resolves an array of checked main-area names into numeric _regionid values.
 *
 * Chain: checked area → all camera region keys → vertex group names → numeric IDs
 *
 * @param {string[]} areaNames — e.g. ['Head', 'Left Arm']
 * @returns {number[]} array of numeric region IDs
 */
export function resolveRegionIds(areaNames) {
    const cameraUtils = AppState.cameraUtils;
    const regionToIdMap = AppState.regionToIdMap;
    if (!cameraUtils || !regionToIdMap) return [];

    const ids = [];

    for (const area of areaNames) {
        const config = REGION_HIERARCHY[area];
        if (!config) continue;

        // Collect all camera-region keys for this main area
        const cameraKeys = [];

        if (config.cameraRegion) {
            cameraKeys.push(config.cameraRegion);
        } else if (config.subAreas && config.subAreas.length > 0) {
            for (const sub of config.subAreas) {
                cameraKeys.push(mapToCameraRegion(area, sub));
            }
        }

        // For each camera key, get vertex group names, then resolve to numeric IDs
        for (const key of cameraKeys) {
            const vertexGroupNames = cameraUtils.regionMap[key];
            if (!vertexGroupNames) continue;
            for (const name of vertexGroupNames) {
                const id = regionToIdMap[name];
                if (id !== undefined) {
                    ids.push(id);
                }
            }
        }
    }

    return ids;
}
