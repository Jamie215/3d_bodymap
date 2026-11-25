// coverageService.js
// Calculates body region coverage using 3D surface area as the base unit.
// Stateful singleton — initialized once after region mappings are loaded.

import * as THREE from 'three';
import AppState from '../app/state.js';
import { computePaintedArea } from '../utils/paintedArea.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Coverage metrics for a single fine-grained anatomical region.
 *
 * @typedef {Object} RegionCoverageEntry
 * @property {number} coloredArea       — 3D surface area actually painted (world units², ≈ m²)
 * @property {number} totalArea         — Total 3D surface area of the region
 * @property {number} percentage        — coloredArea / totalArea × 100
 * @property {number} bodyContribution  — coloredArea / totalBodyArea × 100
 */

/**
 * Coverage metrics for a body part (e.g. "Left Knee", "Chest").
 * Same shape as RegionCoverageEntry but aggregated across all
 * fine-grained regions belonging to the body part.
 *
 * @typedef {Object} BodyPartCoverageEntry
 * @property {number} coloredArea
 * @property {number} totalArea
 * @property {number} percentage
 * @property {number} bodyContribution
 */

/**
 * Complete coverage result returned by {@link CoverageCalculator#calculateCoverage}.
 *
 * @typedef {Object} CoverageResult
 * @property {Object<string, RegionCoverageEntry>}   regions    — Keyed by vertex group name
 * @property {Object<string, BodyPartCoverageEntry>}  bodyParts  — Keyed by body part name (e.g. "Left Knee")
 * @property {{ coloredArea: number, totalArea: number, percentage: number }} overall
 * @property {number} coloredFaceCount — Number of mesh faces with any painted pixel
 * @property {number} totalFaceCount   — Total mesh face count
 */

/**
 * Maps a fine-grained anatomical region name to its parent body part.
 * Body part keys align with REGION_HIERARCHY in modal.js.
 * 
 * Naming convention: region names follow `bodyPart_orientation.side`
 *   e.g. "knee_anterolateral.L" → Left Knee
 *        "back_upper.M"         → Upper Back
 *        "sacrum"               → Pelvis
 */
function classifyRegion(regionName) {
    if (!regionName || regionName === 'unassigned') return null;

    // Determine side from suffix (.L / .R / .M or none)
    const side = regionName.endsWith('.L') ? 'Left'
               : regionName.endsWith('.R') ? 'Right'
               : null;

    // Get the anatomical prefix (everything before the first underscore or dot)
    const prefix = regionName.split(/[_.]/)[0];

    // --- Head ---
    if (prefix === 'face' || prefix === 'head') return 'Head';

    // --- Neck ---
    if (prefix === 'neck') return 'Neck';

    // --- Torso sub-regions ---
    if (prefix === 'chest' || prefix === 'axilla') return 'Chest';
    if (prefix === 'abdomen') return 'Abdomen';

    // Back regions use two-part prefixes: back_upper, back_mid, back_lower
    if (regionName.startsWith('back_upper')) return 'Upper Back';
    if (regionName.startsWith('back_mid'))   return 'Mid Back';
    if (regionName.startsWith('back_lower')) return 'Lower Back';

    // Pelvis group: pelvis, hip, buttock, sacrum, coccyx, psis, pubicSymphysis, apexSacrum
    if (['pelvis', 'hip', 'buttock', 'sacrum', 'coccyx', 'psis', 'pubicSymphysis', 'apexSacrum'].includes(prefix)) {
        return 'Pelvis';
    }

    // --- Sided limb regions (require .L or .R) ---
    if (!side) return null;

    // Arms
    if (prefix === 'shoulder')  return `${side} Shoulder`;
    if (prefix === 'upperArm')  return `${side} Upper Arm`;
    if (prefix === 'elbow')     return `${side} Elbow`;
    if (prefix === 'forearm')   return `${side} Forearm`;
    if (prefix === 'wrist')     return `${side} Wrist`;

    // Hand: hand_*, thumb_*, *Finger_*
    if (prefix === 'hand' || prefix === 'thumb' ||
        prefix.endsWith('Finger')) {
        return `${side} Hand`;
    }

    // Legs
    if (prefix === 'thigh')    return `${side} Thigh`;
    if (prefix === 'knee')     return `${side} Knee`;
    if (prefix === 'lowerLeg') return `${side} Lower Leg`;
    if (prefix === 'ankle')    return `${side} Ankle`;

    // Foot: *Foot_*, heel_*, toe*_*
    if (prefix.endsWith('Foot') || prefix === 'heel' ||
        prefix.startsWith('toe')) {
        return `${side} Foot`;
    }

    return null;
}

class CoverageCalculator {
    constructor() {
        this.regionTotalAreas = {};      // Total 3D surface area per fine-grained region
        this.bodyPartTotalAreas = {};    // Total 3D surface area per body part
        this.regionToBodyPart = {};      // region name → body part key lookup
        this.faceAreas = [];             // Area of each triangle
        this.faceToRegion = [];          // Region name for each triangle
        this.pixelMap = null;            // Texture pixel → triangle lookup (uvRasterizer.buildPixelFaceMap)
        this.totalBodyArea = 0;
        this.initialized = false;
    }

    /**
     * Initialize coverage data from mesh geometry.
     * Call AFTER initializeRegionMappings() and buildGlobalUVMap().
     * 
     * Builds both fine-grained region areas and body part groupings
     * so that calculateCoverage() can return both levels in a single pass.
     */
    initialize(mesh) {
        if (!mesh || !mesh.geometry) {
            console.error('CoverageCalculator: Invalid mesh');
            return false;
        }

        const geometry = mesh.geometry;
        const indexAttr = geometry.index;
        const positionAttr = geometry.attributes.position;

        if (!indexAttr || !positionAttr) {
            console.error('CoverageCalculator: Missing geometry attributes');
            return false;
        }

        if (!AppState.idToRegionMap || !AppState.faceRegionMap || !AppState.pixelMap) {
            console.error('CoverageCalculator: Region mappings not loaded');
            return false;
        }
        this.pixelMap = AppState.pixelMap;

        mesh.updateMatrixWorld(true);
        const matrixWorld = mesh.matrixWorld;
        const faceCount = indexAttr.count / 3;

        this.faceAreas = new Array(faceCount);
        this.faceToRegion = new Array(faceCount);
        this.regionTotalAreas = {};
        this.bodyPartTotalAreas = {};
        this.regionToBodyPart = {};
        this.totalBodyArea = 0;

        // Reusable vectors
        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();
        const ab = new THREE.Vector3();
        const ac = new THREE.Vector3();

        for (let faceIdx = 0; faceIdx < faceCount; faceIdx++) {
            const a = indexAttr.getX(faceIdx * 3);
            const b = indexAttr.getX(faceIdx * 3 + 1);
            const c = indexAttr.getX(faceIdx * 3 + 2);

            // Get vertex positions
            vA.set(positionAttr.getX(a), positionAttr.getY(a), positionAttr.getZ(a));
            vB.set(positionAttr.getX(b), positionAttr.getY(b), positionAttr.getZ(b));
            vC.set(positionAttr.getX(c), positionAttr.getY(c), positionAttr.getZ(c));

            // Transform to world space
            vA.applyMatrix4(matrixWorld);
            vB.applyMatrix4(matrixWorld);
            vC.applyMatrix4(matrixWorld);

            // Triangle area = |AB × AC| / 2
            ab.subVectors(vB, vA);
            ac.subVectors(vC, vA);
            const area = ab.cross(ac).length() * 0.5;

            this.faceAreas[faceIdx] = area;
            this.totalBodyArea += area;

            // Use the region already computed by buildGlobalUVMap
            const regionName = AppState.faceRegionMap.get(faceIdx);
            this.faceToRegion[faceIdx] = regionName;

            if (regionName) {
                this.regionTotalAreas[regionName] = (this.regionTotalAreas[regionName] || 0) + area;

                // Build body part lookup and totals on first encounter of each region
                if (!(regionName in this.regionToBodyPart)) {
                    this.regionToBodyPart[regionName] = classifyRegion(regionName);
                }

                const bodyPart = this.regionToBodyPart[regionName];
                if (bodyPart) {
                    this.bodyPartTotalAreas[bodyPart] = (this.bodyPartTotalAreas[bodyPart] || 0) + area;
                }
            }
        }

        this.initialized = true;
        return true;
    }

    /**
     * Calculate coverage for a drawing instance from what is actually painted.
     *
     * Uses the instance's painted mask (one entry per texture pixel), so brush
     * size, the edges of the brush and erasing are all reflected. Each
     * triangle contributes its real 3D area × the share of its pixels that are
     * painted. Percentages are always area ÷ area.
     *
     * Returns fine-grained region coverage AND body part coverage in a single pass.
     * 
     * @param {DrawingInstance} instance
     * @returns {CoverageResult|null}
     */
    calculateCoverage(instance) {
        if (!this.initialized) {
            console.warn('CoverageCalculator not initialized');
            return null;
        }

        const { regionAreas: regionColoredAreas, totalArea: totalColoredArea, paintedFaceCount } =
            this._paintedArea(instance);

        const bodyPartColoredAreas = {};
        for (const [region, area] of Object.entries(regionColoredAreas)) {
            const bodyPart = this.regionToBodyPart[region];
            if (bodyPart) {
                bodyPartColoredAreas[bodyPart] = (bodyPartColoredAreas[bodyPart] || 0) + area;
            }
        }

        // Build fine-grained region coverage
        const regionCoverage = {};
        for (const [region, coloredArea] of Object.entries(regionColoredAreas)) {
            const totalArea = this.regionTotalAreas[region] || 1;
            regionCoverage[region] = {
                coloredArea,
                totalArea,
                percentage: (coloredArea / totalArea) * 100,
                bodyContribution: (coloredArea / this.totalBodyArea) * 100
            };
        }

        // Build body part coverage
        const bodyPartCoverage = {};
        for (const [bodyPart, coloredArea] of Object.entries(bodyPartColoredAreas)) {
            const totalArea = this.bodyPartTotalAreas[bodyPart] || 1;
            bodyPartCoverage[bodyPart] = {
                coloredArea,
                totalArea,
                percentage: (coloredArea / totalArea) * 100,
                bodyContribution: (coloredArea / this.totalBodyArea) * 100
            };
        }

        return {
            regions: regionCoverage,
            bodyParts: bodyPartCoverage,
            overall: {
                coloredArea: totalColoredArea,
                totalArea: this.totalBodyArea,
                percentage: (totalColoredArea / this.totalBodyArea) * 100
            },
            coloredFaceCount: paintedFaceCount,
            totalFaceCount: this.faceAreas.length
        };
    }

    /**
     * Names of the regions that have any painted area in this instance
     * (the `drawnRegions` list). Same source as calculateCoverage, so a region
     * is listed here exactly when it appears in the coverage breakdown.
     *
     * @param {DrawingInstance} instance
     * @returns {Set<string>}
     */
    getDrawnRegions(instance) {
        if (!this.initialized) return new Set();
        return new Set(Object.keys(this._paintedArea(instance).regionAreas));
    }

    /** @private */
    _paintedArea(instance) {
        if (!instance?.paintedMask) {
            return { regionAreas: {}, totalArea: 0, paintedFaceCount: 0 };
        }
        return computePaintedArea(instance.paintedMask, this.pixelMap, this.faceAreas, this.faceToRegion);
    }
}

const coverageCalculator = new CoverageCalculator();
export default coverageCalculator;