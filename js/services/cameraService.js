// cameraService.js
// Camera control for 3D body model navigation.
// This class retains: region focusing, rotation mechanics,
// camera animation, control-limit management, and backface detection.

import * as THREE from 'three';
import AppState from '../app/state.js';
import { buildRegionMap } from '../utils/regionMapBuilder.js';
import {
    analyzeDrawingOrientation,
    isBackFacingRegion,
    findDominantBodyPart
} from '../utils/orientationAnalyzer.js';
import { getElevationAngle, getOrbitCenterOffset } from '../utils/orbitOffsets.js';

export default class CameraUtils {
    constructor(camera, controls, mesh) {
        this.camera = camera;
        this.controls = controls;
        this.mesh = mesh;

        // Rotation angle (radians) around Y axis
        // 0 = front, PI = back, PI/2 = right, -PI/2 = left
        this.rotationAngle = 0;

        // Focus state
        this.focusCenter = null;
        this.focusRadius = null;
        this.optimalDistance = null;
        this.focusedRegionName = null;

        // Animation state
        this.isAnimating = false;

        // Default camera settings for full body view
        this.defaultDistance = 1.4;
        this.defaultPivot = new THREE.Vector3(0, 1, 0);

        // Rotation settings
        this.rotationIncrement = Math.PI / 4; // 45 degrees

        // Region mapping: camera-level keys → vertex group names
        // Populated by initRegionMap()
        this.regionMap = {};

        // Bind and attach controls listener
        this.handleControlsChange = this.handleControlsChange.bind(this);
        this.controls.addEventListener('change', this.handleControlsChange);
    }

    // ==========================================
    // REGION MAP INITIALISATION
    // ==========================================

    /**
     * Build the regionMap from loaded vertex group names.
     * Call once, after initializeRegionMappings() has populated
     * AppState.idToRegionMap.
     *
     * @param {string[]} regionNames — all vertex group names
     */
    initRegionMap(regionNames) {
        this.regionMap = buildRegionMap(regionNames);
    }

    // ==========================================
    // REGION FOCUSING
    // ==========================================

    focusOnRegion(regionName, preserveRotation = true) {
        if (!regionName || regionName === 'Entire Body') {
            return this.resetView();
        }

        const regions = this.regionMap[regionName];
        if (!regions) {
            console.warn('Unknown region:', regionName);
            return;
        }

        const { center, box } = this.calculateRegionBounds(regions);
        if (center && box) {
            const isBackRegion = isBackFacingRegion(regionName, this.regionMap);
            const currentlyViewingBack = Math.abs(this.rotationAngle) > Math.PI / 2;

            this.setFocus(regionName, center, box, preserveRotation);

            if (!preserveRotation) {
                this.rotationAngle = isBackRegion ? Math.PI : 0;
            } else {
                if (isBackRegion && !currentlyViewingBack) {
                    this.rotationAngle = Math.PI;
                } else if (!isBackRegion && currentlyViewingBack) {
                    this.rotationAngle = 0;
                }
            }

            return this.applyRotation(false);
        } else {
            console.warn('Could not calculate bounds for region:', regionName);
        }
    }

    calculateRegionBounds(regionNames) {
        if (!this.mesh) return { center: null, box: null };

        const geometry = this.mesh.geometry;
        const regionIDAttr = geometry.attributes._regionid;
        const positionAttr = geometry.attributes.position;

        if (!regionIDAttr) return { center: null, box: null };

        const targetRegionIds = new Set();
        for (const name of regionNames) {
            const id = AppState.regionToIdMap?.[name];
            if (id !== undefined) targetRegionIds.add(id);
        }

        if (targetRegionIds.size === 0) return { center: null, box: null };

        const points = [];
        for (let i = 0; i < regionIDAttr.count; i++) {
            if (targetRegionIds.has(regionIDAttr.getX(i))) {
                points.push(new THREE.Vector3(
                    positionAttr.getX(i),
                    positionAttr.getY(i),
                    positionAttr.getZ(i)
                ));
            }
        }

        if (points.length === 0) return { center: null, box: null };

        const localBox = new THREE.Box3().setFromPoints(points);
        const box = localBox.clone().applyMatrix4(this.mesh.matrixWorld);
        const center = new THREE.Vector3();
        box.getCenter(center);

        return { center, box };
    }

    setFocus(regionName, center, boundingBox, preserveRotation = false) {
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        if (!preserveRotation) {
            this.rotationAngle = 0;
        }

        this.focusedRegionName = regionName;
        this.focusCenter = center.clone();
        this.focusRadius = Math.max(size.x, size.y, size.z) / 2;

        const fov = this.camera.fov * (Math.PI / 180);
        const maxDimension = Math.max(size.x, size.y, size.z);
        this.optimalDistance = (maxDimension / 2) / Math.tan(fov / 2) * 2.0;
        this.optimalDistance = Math.max(this.optimalDistance, 0.25);

        this.controls.minDistance = Math.max(0.05, this.focusRadius * 0.3);
        this.controls.maxDistance = this.optimalDistance * 5;
        this.controls.target.copy(center);

        return this.optimalDistance;
    }

    clearFocus() {
        this.focusCenter = null;
        this.focusRadius = null;
        this.optimalDistance = null;
        this.focusedRegionName = null;

        this.controls.minDistance = 0.3;
        this.controls.maxDistance = 5.0;
    }

    resetRotation() {
        this.rotationAngle = 0;
    }

    resetView() {
        this.clearFocus();
        this.rotationAngle = 0;

        const dropdown = document.querySelector('.region-dropdown');
        if (dropdown) dropdown.value = 'Entire Body';

        const targetPosition = new THREE.Vector3(0, 1, this.defaultDistance);
        this.controls.target.copy(this.defaultPivot);
        return this.animateCamera(targetPosition, this.defaultPivot.clone(), 600);
    }

    fitToVisibleRegions(visibleRegionIds) {
        if (!visibleRegionIds || visibleRegionIds.length === 0) {
            return this.resetView();
        }

        if (!this.mesh) return;

        const geometry = this.mesh.geometry;
        const positionAttr = geometry.attributes.position;
        const regionIDAttr = geometry.attributes._regionid;

        if (!regionIDAttr) return;

        const idSet = new Set(visibleRegionIds);
        const points = [];
        for (let i = 0; i < regionIDAttr.count; i++) {
            if (idSet.has(regionIDAttr.getX(i))) {
                points.push(new THREE.Vector3(
                    positionAttr.getX(i),
                    positionAttr.getY(i),
                    positionAttr.getZ(i)
                ));
            }
        }

        if (points.length === 0) return this.resetView();

        const localBox = new THREE.Box3().setFromPoints(points);
        const box = localBox.clone().applyMatrix4(this.mesh.matrixWorld);

        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);

        const fov = this.camera.fov * (Math.PI / 180);
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = (maxDim / 2) / Math.tan(fov / 2) * 1;
        const finalDistance = Math.max(distance, 0.5);

        this.rotationAngle = 0;

        this.focusedRegionName = null;
        this.focusCenter = center.clone();
        this.focusRadius = maxDim / 2;
        this.optimalDistance = finalDistance;

        this.controls.minDistance = Math.max(0.05, this.focusRadius * 0.3);
        this.controls.maxDistance = finalDistance * 5;
        this.controls.target.copy(center);

        const targetPosition = new THREE.Vector3(
            center.x,
            center.y,
            center.z + finalDistance
        );

        return this.animateCamera(targetPosition, center, 500);
    }

    // ==========================================
    // ROTATION CONTROLS
    // ==========================================

    rotateLeft() {
        if (this.isAnimating) return;
        this.rotationAngle -= this.rotationIncrement;
        this.normalizeAngle();
        return this.applyRotation(true);
    }

    rotateRight() {
        if (this.isAnimating) return;
        this.rotationAngle += this.rotationIncrement;
        this.normalizeAngle();
        return this.applyRotation(true);
    }

    rotate(direction) {
        if (direction === 'left') return this.rotateLeft();
        else if (direction === 'right') return this.rotateRight();
    }

    rotateTo(viewName) {
        if (this.isAnimating) return;

        const angles = {
            'Front': 0,
            'Front-Right': Math.PI / 4,
            'Right': Math.PI / 2,
            'Back-Right': Math.PI * 3 / 4,
            'Back': Math.PI,
            'Back-Left': -Math.PI * 3 / 4,
            'Left': -Math.PI / 2,
            'Front-Left': -Math.PI / 4
        };

        if (angles[viewName] !== undefined) {
            this.rotationAngle = angles[viewName];
            return this.applyRotation(true);
        }
    }

    reorientCamera(direction) {
        return this.rotateTo(direction);
    }

    normalizeAngle() {
        while (this.rotationAngle > Math.PI) this.rotationAngle -= Math.PI * 2;
        while (this.rotationAngle < -Math.PI) this.rotationAngle += Math.PI * 2;
    }

    applyRotation(animate = true) {
        const center = this.focusCenter ? this.focusCenter.clone() : this.defaultPivot.clone();
        const distance = (this.optimalDistance || this.defaultDistance);

        const elevationAngle = getElevationAngle(this.focusedRegionName || '');
        const centerOffset = getOrbitCenterOffset(this.focusedRegionName || '');
        center.x += centerOffset.x;
        center.y += centerOffset.y;
        center.z += centerOffset.z;

        const horizontalDist = distance * Math.cos(elevationAngle);
        const verticalOffset = distance * Math.sin(elevationAngle);

        const x = Math.sin(this.rotationAngle) * horizontalDist;
        const z = Math.cos(this.rotationAngle) * horizontalDist;
        const y = verticalOffset;

        const targetPosition = new THREE.Vector3(
            center.x + x,
            center.y + y,
            center.z + z
        );

        // Aggressive near clipping for upper arm / elbow front view to hide torso
        const isFrontView = Math.abs(this.rotationAngle) < Math.PI / 4;
        if ((this.focusedRegionName?.includes('Upper Arm') || this.focusedRegionName?.includes('Elbow')) && isFrontView) {
            this.camera.near = distance * 0.1;
            this.camera.updateProjectionMatrix();
        }

        return this.animateCamera(targetPosition, center, animate ? 400 : 600);
    }

    // ==========================================
    // CAMERA ANIMATION
    // ==========================================

    animateCamera(targetPosition, targetLookAt, duration = 500) {
        return new Promise((resolve) => {
            if (this.isAnimating) {
                resolve();
                return;
            }

            const startPosition = this.camera.position.clone();
            const startTarget = this.controls.target.clone();
            const startTime = Date.now();

            this.isAnimating = true;

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const t = 0.5 - Math.cos(progress * Math.PI) / 2;

                this.camera.position.lerpVectors(startPosition, targetPosition, t);
                this.controls.target.lerpVectors(startTarget, targetLookAt, t);
                this.camera.lookAt(this.controls.target);
                this.controls.update();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.isAnimating = false;
                    this.camera.position.copy(targetPosition);
                    this.controls.target.copy(targetLookAt);
                    this.camera.lookAt(this.controls.target);
                    this.controls.update();
                    resolve();
                }
            };

            animate();
        });
    }

    moveTo(position, lookAt, duration = 800) {
        return this.animateCamera(position, lookAt, duration);
    }

    // ==========================================
    // FOCUS ON DRAWING
    // ==========================================

    focusOnDrawing(drawnRegionNames) {
        if (!drawnRegionNames || drawnRegionNames.size === 0) {
            return this.resetView();
        }

        const dominantBodyPart = findDominantBodyPart(drawnRegionNames, this.regionMap);
        if (!dominantBodyPart) {
            return this.resetView();
        }

        console.log('Dominant body part:', dominantBodyPart);

        const orientation = analyzeDrawingOrientation(drawnRegionNames);

        const regions = this.regionMap[dominantBodyPart];
        if (!regions) {
            return this.resetView();
        }

        const { center, box } = this.calculateRegionBounds(regions);
        if (!center || !box) {
            return this.resetView();
        }

        this.setFocus(dominantBodyPart, center, box);
        this.rotationAngle = orientation.angle;

        return this.applyRotation(true);
    }

    // ==========================================
    // BACKFACE DETECTION
    // ==========================================

    isSurfaceFacingCamera(point, normal) {
        const toCamera = new THREE.Vector3().subVectors(this.camera.position, point).normalize();
        return normal.dot(toCamera) > 0;
    }

    isDrawableHit(intersect) {
        if (!intersect || !intersect.face) return false;

        const normalMatrix = new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld);
        const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize();

        return this.isSurfaceFacingCamera(intersect.point, worldNormal);
    }

    // ==========================================
    // CONTROLS EVENT HANDLING
    // ==========================================

    handleControlsChange() {
        if (this.isAnimating) return;

        const center = this.focusCenter || this.controls.target;
        const distance = this.camera.position.distanceTo(center);

        this.camera.near = Math.max(0.001, distance * 0.01);
        this.camera.far = Math.max(distance * 10, 100);
        this.camera.updateProjectionMatrix();
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    getFocusState() {
        return {
            isFocused: !!this.focusCenter,
            regionName: this.focusedRegionName,
            center: this.focusCenter?.clone(),
            radius: this.focusRadius,
            optimalDistance: this.optimalDistance,
            currentAngle: this.rotationAngle,
            currentAngleDegrees: (this.rotationAngle * 180 / Math.PI).toFixed(1),
            viewName: this.getCurrentViewName(),
            isBackView: Math.abs(this.rotationAngle) > Math.PI / 2
        };
    }

    getCurrentViewName() {
        const angle = this.rotationAngle;
        const tolerance = Math.PI / 8;

        if (Math.abs(angle) < tolerance) return 'Front';
        if (Math.abs(angle - Math.PI / 4) < tolerance) return 'Front-Right';
        if (Math.abs(angle - Math.PI / 2) < tolerance) return 'Right';
        if (Math.abs(angle - Math.PI * 3 / 4) < tolerance) return 'Back-Right';
        if (Math.abs(Math.abs(angle) - Math.PI) < tolerance) return 'Back';
        if (Math.abs(angle + Math.PI * 3 / 4) < tolerance) return 'Back-Left';
        if (Math.abs(angle + Math.PI / 2) < tolerance) return 'Left';
        if (Math.abs(angle + Math.PI / 4) < tolerance) return 'Front-Left';

        return 'Custom';
    }

    dispose() {
        this.controls.removeEventListener('change', this.handleControlsChange);
    }
}