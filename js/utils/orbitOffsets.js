// orbitOffsets.js
// Static lookup tables for camera orbit adjustments per body region.
//
// Returns positional offsets based on region names.  They have no camera,
// controls, or Three.js dependency.

// ============================================================================
// ELEVATION ANGLE
// ============================================================================

/**
 * Get vertical tilt for the camera orbit when viewing a specific region.
 * Feet and hands benefit from a slight downward look.
 *
 * @param {string} regionName — camera-level key (e.g. "Left Foot")
 * @returns {number} radians above horizontal (0 = level)
 */
export function getElevationAngle(regionName) {
    if (regionName.includes('Foot') || regionName.includes('Ankle')) {
        return Math.PI / 6;   // 30°
    }
    if (regionName.includes('Hand') || regionName.includes('Wrist')) {
        return Math.PI / 12;  // 15°
    }
    return 0;
}

// ============================================================================
// ORBIT CENTER OFFSET
// ============================================================================

/**
 * Per-region lateral (X), vertical (Y), and posterior (Z) offsets applied
 * to the camera orbit center.
 *
 * Arms hang down and away from the torso, so without these offsets the
 * body occludes the region during rotation.  Legs need smaller tweaks.
 *
 * Convention:
 *   lateral  — outward from body centerline (positive = left, negative = right)
 *   vertical — positive raises the orbit center
 *   posterior — negative Z = toward the back
 */
const OFFSET_TABLE = {
    'Upper Arm': { lateral:  0,     vertical:  0,     posterior: -0.15 },
    'Elbow':     { lateral: -0.07,  vertical: -0.05,  posterior: -0.17 },
    'Forearm':   { lateral: -0.07,  vertical: -0.05,  posterior: -0.24 },
    'Wrist':     { lateral: -0.07,  vertical: -0.12,  posterior: -0.37 },
    'Hand':      { lateral: -0.02,  vertical: -0.13,  posterior: -0.46 },
    'Thigh':     { lateral:  0.05,  vertical:  0,     posterior:  0    },
    'Knee':      { lateral:  0,     vertical:  0,     posterior:  0    },
    'Lower Leg': { lateral:  0,     vertical:  0,     posterior:  0    },
    'Ankle':     { lateral:  0,     vertical:  0,     posterior:  0    },
    'Foot':      { lateral:  0,     vertical: -0.05,  posterior:  0    }
};

/**
 * Get the orbit-center offset for a given camera-region name.
 *
 * Left limbs push the orbit center in the +X direction (outward left),
 * right limbs push it in the −X direction (outward right).
 *
 * @param {string} regionName — e.g. "Left Forearm", "Right Hand"
 * @returns {{ x: number, y: number, z: number }}
 */
export function getOrbitCenterOffset(regionName) {
    if (!regionName) return { x: 0, y: 0, z: 0 };

    const isLeft  = regionName.startsWith('Left');
    const isRight = regionName.startsWith('Right');
    const lateralSign = isLeft ? 1 : (isRight ? -1 : 0);

    for (const [regionType, offset] of Object.entries(OFFSET_TABLE)) {
        if (regionName.includes(regionType)) {
            return {
                x: offset.lateral * lateralSign,
                y: offset.vertical,
                z: offset.posterior
            };
        }
    }

    return { x: 0, y: 0, z: 0 };
}