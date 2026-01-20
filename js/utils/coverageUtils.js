// utils/coverageUtils.js
// Calculates body region coverage using 3D surface area as the base unit

import AppState from '../app/state.js';

class CoverageCalculator {
    constructor() {
        this.regionTotalAreas = {};   // Total 3D surface area per region
        this.faceAreas = [];          // Area of each triangle
        this.faceToRegion = [];       // Region name for each triangle
        this.totalBodyArea = 0;
        this.initialized = false;
    }

    /**
     * Initialize coverage data from mesh geometry
     * Call AFTER initializeRegionMappings() and buildGlobalUVMap()
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

        if (!AppState.idToRegionMap || !AppState.faceRegionMap) {
            console.error('CoverageCalculator: Region mappings not loaded');
            return false;
        }

        mesh.updateMatrixWorld(true);
        const matrixWorld = mesh.matrixWorld;
        const faceCount = indexAttr.count / 3;

        this.faceAreas = new Array(faceCount);
        this.faceToRegion = new Array(faceCount);
        this.regionTotalAreas = {};
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
            }
        }

        this.initialized = true;
        // console.log(`CoverageCalculator: ${faceCount} faces, ${Object.keys(this.regionTotalAreas).length} regions, total: ${this.totalBodyArea.toFixed(4)} units²`);
        return true;
    }

    /**
     * Calculate coverage for a drawing instance
     */
    calculateCoverage(instance) {
        if (!this.initialized) {
            console.warn('CoverageCalculator not initialized');
            return null;
        }

        const coloredFaces = instance.coloredFaces || new Set();
        const regionColoredAreas = {};
        let totalColoredArea = 0;

        for (const faceIdx of coloredFaces) {
            const area = this.faceAreas[faceIdx];
            const region = this.faceToRegion[faceIdx];
            
            if (area && region) {
                regionColoredAreas[region] = (regionColoredAreas[region] || 0) + area;
                totalColoredArea += area;
            }
        }

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

        return {
            regions: regionCoverage,
            overall: {
                coloredArea: totalColoredArea,
                totalArea: this.totalBodyArea,
                percentage: (totalColoredArea / this.totalBodyArea) * 100
            },
            coloredFaceCount: coloredFaces.size,
            totalFaceCount: this.faceAreas.length
        };
    }

    /**
     * Calculate coverage grouped by body part (e.g., "Left Arm", "Head")
     */
    calculateBodyPartCoverage(instance, bodyPartMap) {
        const fineCoverage = this.calculateCoverage(instance);
        if (!fineCoverage) return null;

        const bodyPartCoverage = {};

        for (const [bodyPart, fineRegions] of Object.entries(bodyPartMap)) {
            let totalArea = 0;
            let coloredArea = 0;

            for (const fineRegion of fineRegions) {
                if (this.regionTotalAreas[fineRegion]) {
                    totalArea += this.regionTotalAreas[fineRegion];
                }
                if (fineCoverage.regions[fineRegion]) {
                    coloredArea += fineCoverage.regions[fineRegion].coloredArea;
                }
            }

            if (totalArea > 0) {
                bodyPartCoverage[bodyPart] = {
                    coloredArea,
                    totalArea,
                    percentage: (coloredArea / totalArea) * 100,
                    bodyContribution: (coloredArea / this.totalBodyArea) * 100
                };
            }
        }

        return {
            bodyParts: bodyPartCoverage,
            overall: fineCoverage.overall,
            fineGrained: fineCoverage.regions
        };
    }

    getFaceArea(faceIndex) {
        return this.faceAreas[faceIndex] || 0;
    }

    getFaceRegion(faceIndex) {
        return this.faceToRegion[faceIndex] || null;
    }

    getAllRegionAreas() {
        return { ...this.regionTotalAreas };
    }

    /**
     * Debug: Log coverage breakdown to console
     */
    logCoverage(instance) {
        if (!this.initialized) {
            console.warn('CoverageCalculator not initialized');
            return;
        }

        const coverage = this.calculateCoverage(instance);
        if (!coverage) return;

        // Sort regions by coverage percentage (highest first)
        const sortedRegions = Object.entries(coverage.regions)
            .sort((a, b) => b[1].percentage - a[1].percentage);

        console.group('📊 Coverage Breakdown');
        console.log(`Overall: ${coverage.overall.percentage.toFixed(2)}% of body (${coverage.coloredFaceCount} faces)`);
        console.log('─'.repeat(50));
        
        if (sortedRegions.length === 0) {
            console.log('No regions colored yet');
        } else {
            console.table(
                sortedRegions.reduce((acc, [region, data]) => {
                    acc[region] = {
                        'Region %': data.percentage.toFixed(1) + '%',
                        'Body %': data.bodyContribution.toFixed(2) + '%',
                        'Area': data.coloredArea.toFixed(4)
                    };
                    return acc;
                }, {})
            );
        }
        console.groupEnd();
    }
}

const coverageCalculator = new CoverageCalculator();
export default coverageCalculator;