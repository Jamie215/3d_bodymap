// utils/cameraUtils.js
import AppState from "../app/state.js";

export default class CameraUtils {
    constructor(camera, controls, mesh) {
        this.camera = camera;
        this.controls = controls;
        this.mesh = mesh;
        
        // Focus state
        this.focusCenter = null;
        this.focusRadius = null;
        this.optimalDistance = null;
        this.focusedRegionName = null;
        
        // Flag for preventing recursion
        this.isUpdating = false;
        this.isAnimating = false;
        
        // Anti-clipping parameters
        this.clearanceBuffer = 1.1; // 10% clearance
        this.testRays = 8;
        
        // Region mapping
        this.regionMap = {
            'Head': ['head_ant_top.L','head_ant_top.R','head_ant_mid.L','head_ant_mid.R','head_ant_btm.L','head_ant_btm.R'],
            'Left Arm': ['arm_ant.L','forearm_ant_lateral.L'],
            'Left Hand': ['thumb_ant_proximal.L','thumb_ant_distal.L','littleFinger_ant_proximal.L','littleFinger_ant_distal.L'],
            'Right Arm': ['arm_ant.R','forearm_ant_lateral.R'],
            'Right Hand': ['thumb_ant_proximal.R','thumb_ant_distal.R','littleFinger_ant_proximal.R','littleFinger_ant_distal.R'],
            'Left Leg': ['thigh_ant_lateral.L','thigh_ant_intermediate.L','thigh_ant_medial.L', 'knee_ant_lateral.L','knee_ant_medial.L','leg_ant_lateral.L','leg_ant_medial.L'],
            'Left Foot': ['midFoot_ant_lateral.L','midFoot_ant_medial.L','bigToe_ant.L','indexToe_ant.L','middleToe_ant.L', 'ringToe_ant_lateral.L','ringToe_ant_medial.L','littleToe_ant.L','bigToe_post.L','indexToe_post.L','middleToe_post.L','ringToe_post_lateral.L','ringToe_post_medial.L','littleToe_post.L','footBridge_medial.L','footBridge_lateral.L','midFoot_post_medial.L','midFoot_post_lateral.L','heel_medial.L','heel_lateral.L'],
            'Right Leg': ['thigh_ant_lateral.R','thigh_ant_intermediate.R','thigh_ant_medial.R', 'knee_ant_lateral.R','knee_ant_medial.R','leg_ant_lateral.R','leg_ant_medial.R'],
            'Right Foot': ['midFoot_ant_lateral.R','midFoot_ant_medial.R','bigToe_ant.R','indexToe_ant.R','middleToe_ant.R','ringToe_ant_lateral.R','ringToe_ant_medial.R','littleToe_ant.R','bigToe_post.R','indexToe_post.R','middleToe_post.R','ringToe_post_lateral.R','ringToe_post_medial.R','littleToe_post.R','footBridge_medial.R','footBridge_lateral.R','midFoot_post_medial.R','midFoot_post_lateral.R','heel_medial.R','heel_lateral.R']
        };

        // Bind methods
        this.handleControlsChange = this.handleControlsChange.bind(this);
        
        // Setup listeners
        this.controls.addEventListener('change', this.handleControlsChange);
    }

    // Main method to focus on a region by name
    focusOnRegion(regionName) {
        if (!regionName || regionName === 'Entire Body') {
            this.resetView();
            return;
        }

        const regions = this.regionMap[regionName];
        if(!regions) {
            console.warn("Unknown region: ", regionName);
            return;
        }

        const { center, box } = this.calculateRegionBounds(regions);
        if (center && box) {
            const optimalDistance = this.setFocus(regionName, center, box);

            // Special handling for feet - for better viewing angle
            let direction;
            if (regionName.includes('Foot')) {
                // Position camera in front and above the foot
                direction = new THREE.Vector3(0,1,2).normalize();
            } else {
                direction = new THREE.Vector3(0,0,1);
            }
            const targetPosition = center.clone().addScaledVector(direction, optimalDistance);

            this.moveTo(targetPosition, center, 800);
        }
    }

    // Calcualte bounds for given region names
    calculateRegionBounds(regionNames) {
        if (!this.mesh) return {center:null, box:null};
        
        const geometry = this.mesh.geometry;
        const regionIDAttr = geometry.attributes._regionid;
        const positionAttr = geometry.attributes.position;

        if (!regionIDAttr) return {center:null, box:null};

        const footAreaRegionIds = new Set();
        for (let i=0; i<regionIDAttr.count; i++) {
            const y = positionAttr.getY(i);
            const x = positionAttr.getX(i);
            // Check if vertex is in right foot area (negative X, low Y)
            if (x < -0.1 && x > -0.3 && y < 0.3 && y > -0.01) {
                const regionId = regionIDAttr.getX(i);
                footAreaRegionIds.add(regionId);
            }
        }
        console.log('Region IDs found in right foot area:', Array.from(footAreaRegionIds).sort((a,b) => a-b));

        const targetRegionIds = new Set();
        for (const name of regionNames) {
            const id = AppState.regionToIdMap?.[name];
            console.log(`  "${name}" -> ID: ${id}`)
            if (id !== undefined) targetRegionIds.add(id);
        }
        console.log('Target region IDs:', Array.from(targetRegionIds).sort((a,b) => a-b));

        // Find which IDs are in foot area but not in our target list
        const missingIds = Array.from(footAreaRegionIds).filter(id => !targetRegionIds.has(id));
        if (missingIds.length > 0) {
            console.log('⚠️ Region IDs in foot area NOT in our mapping:', missingIds);
            console.log('These correspond to regions:', missingIds.map(id => AppState.idToRegionMap?.[id] || 'unknown'));
        }

        if (targetRegionIds.size === 0) return {center:null, box:null};

        const points = [];
        for (let i=0; i<regionIDAttr.count; i++) {
            const regionId = regionIDAttr.getX(i);
            if (targetRegionIds.has(regionId)) {
                const vertex = new THREE.Vector3(
                    positionAttr.getX(i),
                    positionAttr.getY(i),
                    positionAttr.getZ(i)
                );
                points.push(vertex);
            }
        }

        console.log('Found matching vertices:', points.length);

        if (points.length === 0) return {center:null, box:null};

        // Create box from local space points
        const localBox = new THREE.Box3();
        localBox.setFromPoints(points);
        
        // Transform the box to world space
        const box = localBox.clone();
        box.applyMatrix4(this.mesh.matrixWorld);
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        console.log('Local box:', {min: localBox.min, max: localBox.max});
        console.log('World box:', {min: box.min, max: box.max, center: center});


        return {center, box}
    }
    
    // Set focus state
    setFocus(regionName, center, boundingBox) {
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        this.focusedRegionName = regionName;
        this.focusCenter = center.clone();
        this.focusRadius = Math.max(size.x, size.y, size.z) / 2;
        
        // Calculate optimal distance for this region
        const fov = this.camera.fov * (Math.PI / 180);
        this.optimalDistance = (this.focusRadius * 2) / (2 * Math.tan(fov / 2)) * 1.3;
        
        // Set controls limits based on region
        this.controls.minDistance = this.focusRadius * 0.8;
        this.controls.maxDistance = this.optimalDistance * 3;
        
        return this.optimalDistance;
    }
    
    // Clear focus and reset to default view
    clearFocus() {
        this.focusCenter = null;
        this.focusRadius = null;
        this.optimalDistance = null;
        this.focusedRegionName = null;
        
        // Reset to default limits
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 5.0;
    }

    // Reset camera to default view
    resetView() {
        this.clearFocus();

        // Reset dropdown if it exists
        const dropdown = document.querySelector('.region-dropdown');
        if (dropdown) {
            dropdown.value = 'Entire Body';
        }

        // Reset to default view
        const pivot = new THREE.Vector3(0,1,0);
        this.controls.target.copy(pivot);
        this.camera.position.set(0,1,1.75);
        this.camera.lookAt(pivot);
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    // Reorient camera to view from different angle (Front/Back/Left/Right)
    reorientCamera(direction) {
        if (this.focusCenter) {
            this.rotateView(direction);
            return;
        }

        // Simple reorientation
        const pivot = this.controls.target.clone();
        const radius = AppState.viewRadius || 1;
        const currDist = this.camera.position.distanceTo(pivot);

        const safeDist = Math.max(currDist, this.controls.minDistance || 0.5, radius*0.5);

        // Get world rotation
        const root = AppState.modelRoot || AppState.model || this.mesh;
        const qWorld = new THREE.Quaternion();
        if (root) root.getWorldQuaternion(qWorld);

        const dirMap = {
            Front: new THREE.Vector3(0,0,1),
            Back: new THREE.Vector3(0,0,-1),
            Left: new THREE.Vector3(1,0,0),
            Right: new THREE.Vector3(-1,0,0)
        };

        const dir = dirMap[direction].clone().applyQuaternion(qWorld).normalize();

        // Move camera
        this.camera.position.copy(pivot).addScaledVector(dir, safeDist);
        this.camera.lookAt(pivot);

        // Update near/far planes
        const suggestedNear = Math.max(0.01, radius/200);
        const suggestedFar = Math.max(safeDist+radius*4, this.camera.far);
        if (this.camera.near !== suggestedNear || this.camera.far !== suggestedFar) {
            this.camera.near = suggestedNear;
            this.camera.far = suggestedFar;
            this.camera.updateProjectionMatrix();
        }
        this.controls.update();
    }

    // Smart rotaion that maintains focus and optimal distance
    rotateView(direction) {
        const center = this.focusCenter || this.controls.target;
        const currentDistance = this.camera.position.distanceTo(center);

        let targetDistance = currentDistance;
        if (this.optimalDistance) {
            targetDistance = Math.min(currentDistance, this.optimalDistance);
        }

        // Special handling for feet view - add elevation to the camera position
        let dir;
        if (this.focusedRegionName && this.focusedRegionName.includes('Foot')) {
            const dirMap = {
                Front: new THREE.Vector3(0, 1, 2),
                Back: new THREE.Vector3(0, 1, -2),
                Left: new THREE.Vector3(2, 1, 0),
                Right: new THREE.Vector3(-2, 1, 0)
            };
            dir = dirMap[direction].normalize();
        } else {
            const dirMap = {
                Front: new THREE.Vector3(0, 0, 1),
                Back: new THREE.Vector3(0, 0, -1),
                Left: new THREE.Vector3(1, 0, 0),
                Right: new THREE.Vector3(-1, 0, 0)
            };
            dir = dirMap[direction].normalize();
        }
        
        const targetPosition = center.clone().addScaledVector(dir, targetDistance);
        const optimalPosition = this.findOptimalPosition(targetPosition, center);
        this.animateCamera(optimalPosition, center, 500);
    }

    // Check if camera would clip at position
    wouldClipAtPosition(position) {
        const center = this.focusCenter || this.controls.target;
        const distanceToCenter = position.distanceTo(center);

        // 1. Check if we're too close for the near plane
        const minSafeDistance = this.camera.near * 2; // Give some buffer
        if (distanceToCenter < minSafeDistance) {
            return true;
        }

        // 2. Only use bounding sphere check when NOT focused on a region
        if (!this.focusCenter) {
            // For full body view, use bounding sphere
            if (!this.mesh.geometry.boundingSphere) {
                this.mesh.geometry.computeBoundingSphere();
            }
            const sphere = this.mesh.geometry.boundingSphere.clone();
            sphere.center.applyMatrix4(this.mesh.matrixWorld);
            
            const distToMeshCenter = position.distanceTo(sphere.center);
            if (distToMeshCenter < sphere.radius * 0.7) { // Reduced from 0.9 to 0.7
                return true;
            }
        }

        // 3. Raycast check - Cast ray to check for collisions
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3().subVectors(center, position).normalize();
        raycaster.set(position, direction);

        const intersects = raycaster.intersectObject(this.mesh, true);
        if (intersects.length > 0) {
            const distToIntersection = position.distanceTo(intersects[0].point);
            const distToTarget = position.distanceTo(center);

            if (distToIntersection < distToTarget*0.8) {
                return true;
            }
        }
        return false;
    }

    // Find optimal non-clipping position
    findOptimalPosition(targetPosition, fromCenter) {
        const direction = new THREE.Vector3().subVectors(targetPosition, fromCenter).normalize();
        let testPosition = targetPosition.clone();
        let distance = targetPosition.distanceTo(fromCenter);

        if (this.wouldClipAtPosition(testPosition)) {
            let minDist = this.controls.minDistance;
            let maxDist = Math.max(distance*2, this.optimalDistance || 2);

            // Binary search for optimal distance
            for (let i=0; i<10; i++) {
                const midDist = (minDist + maxDist) / 2;
                testPosition = fromCenter.clone().addScaledVector(direction, midDist);

                if (this.wouldClipAtPosition(testPosition)) {
                    minDist = midDist;
                } else {
                    maxDist = midDist;
                }
            }

            distance = maxDist * this.clearanceBuffer;
            testPosition = fromCenter.clone().addScaledVector(direction, distance);
        }

        return testPosition;
    }

    // Maintain optimal view (prevent clipping)
    handleControlsChange() {
        if (this.isUpdating) return;
        this.maintainOptimalView();
    }

    maintainOptimalView() {
        if (this.isUpdating || this.isAnimating) return;
        this.isUpdating = true;

        const center = this.focusCenter || this.controls.target;
        const currentPos = this.camera.position.clone();

        const optimalPos = this.findOptimalPosition(currentPos, center);
        if(!currentPos.equals(optimalPos)) {
            this.camera.position.copy(optimalPos);
            this.controls.update();
        }

        // Update near/far planes
        const distance = this.camera.position.distanceTo(center);
        this.camera.near = Math.max(0.01, distance*0.01);
        this.camera.far = Math.max(distance*10, 100);
        this.camera.updateProjectionMatrix();
        requestAnimationFrame(() => {
            this.isUpdating = false;
        });
    }
    
    // Animate camera movement
    animateCamera(targetPosition, targetLookAt, duration = 500) {
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
            this.controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                this.camera.position.copy(targetPosition);
                this.controls.target.copy(targetLookAt);
                this.controls.update();
                this.maintainOptimalView();
            }
        };
        
        animate();
    }
    
    // Public method to move camera
    moveTo(position, lookAt, duration = 800) {
        this.animateCamera(position, lookAt, duration);
    }

    // Get current focus state
    getFocusState() {
        return {
            isFocused: !!this.focusCenter,
            regionName: this.focusedRegionName,
            center: this.focusCenter?.clone(),
            radius: this.focusRadius,
            optimalDistance: this.optimalDistance
        };
    }
    
    dispose() {
        this.controls.removeEventListener('change', this.handleControlsChange);
    }
}