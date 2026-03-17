// utils/cameraUtils.js
// Comprehensive camera control for 3D body model navigation
import AppState from "../app/state.js";

export default class CameraUtils {
    constructor(camera, controls, mesh) {
        this.camera = camera;
        this.controls = controls;
        this.mesh = mesh;
        
        // Rotation angle (in radians) around the Y axis
        // 0 = front view, PI = back view, PI/2 = right, -PI/2 = left
        // Accessible via AppState.cameraUtils.rotationAngle
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
        
        // Region mapping: UI region names -> anatomical vertex group names
        // Built from region_id_mapping.json
        this.regionMap = this.buildRegionMap();

        // Bind methods
        this.handleControlsChange = this.handleControlsChange.bind(this);
        
        // Setup listeners
        this.controls.addEventListener('change', this.handleControlsChange);
    }

    // ==========================================
    // REGION MAP BUILDER
    // ==========================================
    
    buildRegionMap() {
        return {
            // Head & Face
            'Head': [
                'face_frontal.L', 'face_frontal.R', 'face_maxilla.L', 'face_maxilla.R',
                'face_mandible.L', 'face_mandible.R', 'head_lateral_temporal.L', 'head_lateral_temporal.R',
                'head_lateral_tmj.L', 'head_lateral_tmj.R', 'head_parietal.L', 'head_parietal.R',
                'head_inferior_occipital.L', 'head_inferior_occipital.R',
                'head_superior_occipital.L', 'head_superior_occipital.R'
            ],
            
            // Neck
            'Neck': [
                'neck_posterior.M', 'neck_posterolateral.L', 'neck_posterolateral.R',
                'neck_anterior.M', 'neck_anterolateral.L', 'neck_anterolateral.R',
                'neck_lateral.L', 'neck_lateral.R'
            ],
            
            // Torso - Front
            'Chest': [
                'chest_anterior.L', 'chest_anterior.R', 'chest_lateral.L', 'chest_lateral.R',
                'axilla.L', 'axilla.R'
            ],
            'Abdomen': [
                'abdomen_anterior.L', 'abdomen_anterior.R', 'abdomen_lateral.L', 'abdomen_lateral.R'
            ],
            'Pelvis': [
                'pelvis_anterior.L', 'pelvis_anterior.R', 'pubicSymphysis', 'hip.L', 'hip.R'
            ],
            
            // Torso - Back
            'Upper Back': [
                'back_upper.L', 'back_upper.R', 'back_upper.M'
            ],
            'Mid Back': [
                'back_mid.L', 'back_mid.R', 'back_mid.M'
            ],
            'Lower Back': [
                'back_lower.L', 'back_lower.R', 'back_lower.M', 'sacrum', 'apexSacrum', 'coccyx',
                'psis.L', 'psis.R', 'buttock.L', 'buttock.R'
            ],
            
            // Torso - Composite (all torso sub-regions combined)
            'Torso': [
                'chest_anterior.L', 'chest_anterior.R', 'chest_lateral.L', 'chest_lateral.R',
                'axilla.L', 'axilla.R',
                'abdomen_anterior.L', 'abdomen_anterior.R', 'abdomen_lateral.L', 'abdomen_lateral.R',
                'pelvis_anterior.L', 'pelvis_anterior.R', 'pubicSymphysis', 'hip.L', 'hip.R',
                'back_upper.L', 'back_upper.R', 'back_upper.M',
                'back_mid.L', 'back_mid.R', 'back_mid.M',
                'back_lower.L', 'back_lower.R', 'back_lower.M', 'sacrum', 'apexSacrum', 'coccyx',
                'psis.L', 'psis.R', 'buttock.L', 'buttock.R'
            ],
            
            // Left Shoulder
            'Left Shoulder': [
                'shoulder_anterior.L', 'shoulder_posterior.L', 'shoulder_superior.L', 'shoulder_lateral.L'
            ],
            
            // Left Upper Arm
            'Left Upper Arm': [
                'upperArm_anteromedial.L', 'upperArm_anterior.L', 'upperArm_anterolateral.L',
                'upperArm_lateral.L', 'upperArm_medial.L', 'upperArm_posterior.L',
                'upperArm_posterolateral.L', 'upperArm_posteromedial.L'
            ],
            
            // Left Elbow
            'Left Elbow': [
                'elbow_anterior.L', 'elbow_anterolateral.L', 'elbow_lateral.L',
                'elbow_posterolateral.L', 'elbow_posterior.L', 'elbow_posteromedial.L',
                'elbow_medial.L', 'elbow_anteromedial.L'
            ],
            
            // Left Forearm
            'Left Forearm': [
                'forearm_anterior.L', 'forearm_anterolateral.L', 'forearm_lateral.L',
                'forearm_posterolateral.L', 'forearm_posterior.L', 'forearm_posteromedial.L',
                'forearm_medial.L', 'forearm_anteromedial.L'
            ],
            
            // Left Wrist
            'Left Wrist': [
                'wrist_anterior.L', 'wrist_anterolateral.L', 'wrist_lateral.L',
                'wrist_posterolateral.L', 'wrist_posterior.L', 'wrist_posteromedial.L',
                'wrist_medial.L', 'wrist_anteromedial.L'
            ],
            
            // Left Hand
            'Left Hand': [
                'hand_volar_radial.L', 'hand_volar_ulnar.L', 'hand_dorsal_radial.L', 'hand_dorsal_ulnar.L',
                'thumb_proximalSegment_volar.L', 'thumb_proximalSegment_dorsal.L',
                'thumb_distalSegment_volar.L', 'thumb_distalSegment_dorsal.L',
                'indexFinger_proximalSegment_volar.L', 'indexFinger_proximalSegment_dorsal.L',
                'indexFinger_intermediateSegment_volar.L', 'indexFinger_intermediateSegment_dorsal.L',
                'indexFinger_distalSegment_volar.L', 'indexFinger_distalSegment_dorsal.L',
                'middleFinger_proximalSegment_volar.L', 'middleFinger_proximalSegment_dorsal.L',
                'middleFinger_intermediateSegment_volar.L', 'middleFinger_intermediateSegment_dorsal.L',
                'middleFinger_distalSegment_volar.L', 'middleFinger_distalSegment_dorsal.L',
                'ringFinger_proximalSegment_volar_radial.L', 'ringFinger_proximalSegment_volar_ulnar.L',
                'ringFinger_proximalSegment_dorsal_radial.L', 'ringFinger_proximalSegment_dorsal_ulnar.L',
                'ringFinger_intermediateSegment_volar_radial.L', 'ringFinger_intermediateSegment_volar_ulnar.L',
                'ringFinger_intermediateSegment_dorsal_radial.L', 'ringFinger_intermediateSegment_dorsal_ulnar.L',
                'ringFinger_distalSegment_volar_radial.L', 'ringFinger_distalSegment_volar_ulnar.L',
                'ringFinger_distalSegment_dorsal_radial.L', 'ringFinger_distalSegment_dorsal_ulnar.L',
                'littleFinger_proximalSegment_volar.L', 'littleFinger_proximalSegment_dorsal.L',
                'littleFinger_intermediateSegment_volar.L', 'littleFinger_intermediateSegment_dorsal.L',
                'littleFinger_distalSegment_volar.L', 'littleFinger_distalSegment_dorsal.L'
            ],
            
            // Left Hand (Front) - palm/volar side
            'Left Hand (Front)': [
                'hand_volar_radial.L', 'hand_volar_ulnar.L',
                'thumb_proximalSegment_volar.L', 'thumb_distalSegment_volar.L',
                'indexFinger_proximalSegment_volar.L', 'indexFinger_intermediateSegment_volar.L', 'indexFinger_distalSegment_volar.L',
                'middleFinger_proximalSegment_volar.L', 'middleFinger_intermediateSegment_volar.L', 'middleFinger_distalSegment_volar.L',
                'ringFinger_proximalSegment_volar_radial.L', 'ringFinger_proximalSegment_volar_ulnar.L',
                'ringFinger_intermediateSegment_volar_radial.L', 'ringFinger_intermediateSegment_volar_ulnar.L',
                'ringFinger_distalSegment_volar_radial.L', 'ringFinger_distalSegment_volar_ulnar.L',
                'littleFinger_proximalSegment_volar.L', 'littleFinger_intermediateSegment_volar.L', 'littleFinger_distalSegment_volar.L'
            ],
            
            // Left Hand (Back) - dorsal side
            'Left Hand (Back)': [
                'hand_dorsal_radial.L', 'hand_dorsal_ulnar.L',
                'thumb_proximalSegment_dorsal.L', 'thumb_distalSegment_dorsal.L',
                'indexFinger_proximalSegment_dorsal.L', 'indexFinger_intermediateSegment_dorsal.L', 'indexFinger_distalSegment_dorsal.L',
                'middleFinger_proximalSegment_dorsal.L', 'middleFinger_intermediateSegment_dorsal.L', 'middleFinger_distalSegment_dorsal.L',
                'ringFinger_proximalSegment_dorsal_radial.L', 'ringFinger_proximalSegment_dorsal_ulnar.L',
                'ringFinger_intermediateSegment_dorsal_radial.L', 'ringFinger_intermediateSegment_dorsal_ulnar.L',
                'ringFinger_distalSegment_dorsal_radial.L', 'ringFinger_distalSegment_dorsal_ulnar.L',
                'littleFinger_proximalSegment_dorsal.L', 'littleFinger_intermediateSegment_dorsal.L', 'littleFinger_distalSegment_dorsal.L'
            ],
            
            // Right Shoulder
            'Right Shoulder': [
                'shoulder_anterior.R', 'shoulder_posterior.R', 'shoulder_superior.R', 'shoulder_lateral.R'
            ],
            
            // Right Upper Arm
            'Right Upper Arm': [
                'upperArm_anterior.R', 'upperArm_anteromedial.R', 'upperArm_medial.R',
                'upperArm_lateral.R', 'upperArm_anterolateral.R', 'upperArm_posterior.R',
                'upperArm_posterolateral.R', 'upperArm_posteromedial.R'
            ],
            
            // Right Elbow
            'Right Elbow': [
                'elbow_anterior.R', 'elbow_anterolateral.R', 'elbow_lateral.R',
                'elbow_posterolateral.R', 'elbow_posterior.R', 'elbow_posteromedial.R',
                'elbow_medial.R', 'elbow_anteromedial.R'
            ],
            
            // Right Forearm
            'Right Forearm': [
                'forearm_anterior.R', 'forearm_anterolateral.R', 'forearm_lateral.R',
                'forearm_posterolateral.R', 'forearm_posterior.R', 'forearm_posteromedial.R',
                'forearm_medial.R', 'forearm_anteromedial.R'
            ],
            
            // Right Wrist
            'Right Wrist': [
                'wrist_anterior.R', 'wrist_anterolateral.R', 'wrist_lateral.R',
                'wrist_posterolateral.R', 'wrist_posterior.R', 'wrist_posteromedial.R',
                'wrist_medial.R', 'wrist_anteromedial.R'
            ],
            
            // Right Hand
            'Right Hand': [
                'hand_volar_radial.R', 'hand_volar_ulnar.R', 'hand_dorsal_radial.R', 'hand_dorsal_ulnar.R',
                'thumb_proximalSegment_volar.R', 'thumb_proximalSegment_dorsal.R',
                'thumb_distalSegment_volar.R', 'thumb_distalSegment_dorsal.R',
                'indexFinger_proximalSegment_volar.R', 'indexFinger_proximalSegment_dorsal.R',
                'indexFinger_intermediateSegment_volar.R', 'indexFinger_intermediateSegment_dorsal.R',
                'indexFinger_distalSegment_volar.R', 'indexFinger_distalSegment_dorsal.R',
                'middleFinger_proximalSegment_volar.R', 'middleFinger_proximalSegment_dorsal.R',
                'middleFinger_intermediateSegment_volar.R', 'middleFinger_intermediateSegment_dorsal.R',
                'middleFinger_distalSegment_volar.R', 'middleFinger_distalSegment_dorsal.R',
                'ringFinger_proximalSegment_volar_radial.R', 'ringFinger_proximalSegment_volar_ulnar.R',
                'ringFinger_proximalSegment_dorsal_radial.R', 'ringFinger_proximalSegment_dorsal_ulnar.R',
                'ringFinger_intermediateSegment_volar_radial.R', 'ringFinger_intermediateSegment_volar_ulnar.R',
                'ringFinger_intermediateSegment_dorsal_radial.R', 'ringFinger_intermediateSegment_dorsal_ulnar.R',
                'ringFinger_distalSegment_volar_radial.R', 'ringFinger_distalSegment_volar_ulnar.R',
                'ringFinger_distalSegment_dorsal_radial.R', 'ringFinger_distalSegment_dorsal_ulnar.R',
                'littleFinger_proximalSegment_volar.R', 'littleFinger_proximalSegment_dorsal.R',
                'littleFinger_intermediateSegment_volar.R', 'littleFinger_intermediateSegment_dorsal.R',
                'littleFinger_distalSegment_volar.R', 'littleFinger_distalSegment_dorsal.R'
            ],
            
            // Right Hand (Front) - palm/volar side
            'Right Hand (Front)': [
                'hand_volar_radial.R', 'hand_volar_ulnar.R',
                'thumb_proximalSegment_volar.R', 'thumb_distalSegment_volar.R',
                'indexFinger_proximalSegment_volar.R', 'indexFinger_intermediateSegment_volar.R', 'indexFinger_distalSegment_volar.R',
                'middleFinger_proximalSegment_volar.R', 'middleFinger_intermediateSegment_volar.R', 'middleFinger_distalSegment_volar.R',
                'ringFinger_proximalSegment_volar_radial.R', 'ringFinger_proximalSegment_volar_ulnar.R',
                'ringFinger_intermediateSegment_volar_radial.R', 'ringFinger_intermediateSegment_volar_ulnar.R',
                'ringFinger_distalSegment_volar_radial.R', 'ringFinger_distalSegment_volar_ulnar.R',
                'littleFinger_proximalSegment_volar.R', 'littleFinger_intermediateSegment_volar.R', 'littleFinger_distalSegment_volar.R'
            ],
            
            // Right Hand (Back) - dorsal side
            'Right Hand (Back)': [
                'hand_dorsal_radial.R', 'hand_dorsal_ulnar.R',
                'thumb_proximalSegment_dorsal.R', 'thumb_distalSegment_dorsal.R',
                'indexFinger_proximalSegment_dorsal.R', 'indexFinger_intermediateSegment_dorsal.R', 'indexFinger_distalSegment_dorsal.R',
                'middleFinger_proximalSegment_dorsal.R', 'middleFinger_intermediateSegment_dorsal.R', 'middleFinger_distalSegment_dorsal.R',
                'ringFinger_proximalSegment_dorsal_radial.R', 'ringFinger_proximalSegment_dorsal_ulnar.R',
                'ringFinger_intermediateSegment_dorsal_radial.R', 'ringFinger_intermediateSegment_dorsal_ulnar.R',
                'ringFinger_distalSegment_dorsal_radial.R', 'ringFinger_distalSegment_dorsal_ulnar.R',
                'littleFinger_proximalSegment_dorsal.R', 'littleFinger_intermediateSegment_dorsal.R', 'littleFinger_distalSegment_dorsal.R'
            ],
            
            // Left Thigh
            'Left Thigh': [
                'thigh_anterior_groin.L', 'thigh_anteromedial.L', 'thigh_anterior.L',
                'thigh_anterolateral.L', 'thigh_lateral.L', 'thigh_perinium.L',
                'thigh_medial.L', 'thigh_posteromedial.L', 'thigh_posterior.L', 'thigh_posterolateral.L'
            ],
            
            // Left Knee
            'Left Knee': [
                'knee_anterior.L', 'knee_anteromedial.L', 'knee_anterolateral.L', 'knee_lateral.L',
                'knee_medial.L', 'knee_posteromedial.L', 'knee_posterior.L', 'knee_posterolateral.L'
            ],
            
            // Left Calf
            'Left Calf': [
                'lowerLeg_anteromedial.L', 'lowerLeg_anterolateral.L',
                'lowerLeg_posterolateral.L', 'lowerLeg_posteromedial.L',
                'lowerLeg_medial.L', 'lowerLeg_anterior.L', 'lowerLeg_lateral.L', 'lowerLeg_posterior.L'
            ],
            
            // Left Ankle
            'Left Ankle': [
                'ankle_anteromedial.L', 'ankle_anterolateral.L',
                'ankle_posteromedial.L', 'ankle_posterolateral.L',
                'ankle_anterior.L', 'ankle_medial.L', 'ankle_lateral.L', 'ankle_posterior.L'
            ],
            
            // Left Foot
            'Left Foot': [
                'heel_lateral.L', 'heel_medial.L',
                'midFoot_dorsomedial.L', 'midFoot_dorsolateral.L',
                'midFoot_plantomedial.L', 'midFoot_plantolateral.L',
                'foreFoot_plantolateral.L', 'foreFoot_plantomedial.L',
                'foreFoot_dorsomedial.L', 'foreFoot_dorsolateral.L',
                'toe1_dorsal.L', 'toe1_plantar.L', 'toe2_dorsal.L', 'toe2_plantar.L',
                'toe3_dorsal.L', 'toe3_plantar.L',
                'toe4_dorsolateral.L', 'toe4_dorsomedial.L', 'toe4_plantolateral.L', 'toe4_plantomedial.L',
                'toe5_dorsal.L', 'toe5_plantar.L'
            ],
            
            // Right Thigh
            'Right Thigh': [
                'thigh_anterior_groin.R', 'thigh_anteromedial.R', 'thigh_anterior.R',
                'thigh_anterolateral.R', 'thigh_lateral.R', 'thigh_perinium.R',
                'thigh_medial.R', 'thigh_posteromedial.R', 'thigh_posterior.R', 'thigh_posterolateral.R'
            ],
            
            // Right Knee
            'Right Knee': [
                'knee_anterior.R', 'knee_anteromedial.R', 'knee_anterolateral.R', 'knee_lateral.R',
                'knee_medial.R', 'knee_posteromedial.R', 'knee_posterior.R', 'knee_posterolateral.R'
            ],
            
            // Right Calf
            'Right Calf': [
                'lowerLeg_anteromedial.R', 'lowerLeg_anterolateral.R',
                'lowerLeg_posterolateral.R', 'lowerLeg_posteromedial.R',
                'lowerLeg_medial.R', 'lowerLeg_anterior.R', 'lowerLeg_lateral.R', 'lowerLeg_posterior.R'
            ],
            
            // Right Ankle
            'Right Ankle': [
                'ankle_anteromedial.R', 'ankle_anterolateral.R',
                'ankle_posteromedial.R', 'ankle_posterolateral.R',
                'ankle_anterior.R', 'ankle_medial.R', 'ankle_lateral.R', 'ankle_posterior.R'
            ],
            
            // Right Foot
            'Right Foot': [
                'heel_lateral.R', 'heel_medial.R',
                'midFoot_dorsomedial.R', 'midFoot_dorsolateral.R',
                'midFoot_plantomedial.R', 'midFoot_plantolateral.R',
                'foreFoot_plantolateral.R', 'foreFoot_plantomedial.R',
                'foreFoot_dorsomedial.R', 'foreFoot_dorsolateral.R',
                'toe1_dorsal.R', 'toe1_plantar.R', 'toe2_dorsal.R', 'toe2_plantar.R',
                'toe3_dorsal.R', 'toe3_plantar.R',
                'toe4_dorsolateral.R', 'toe4_dorsomedial.R', 'toe4_plantomedial.R', 'toe4_plantolateral.R',
                'toe5_dorsal.R', 'toe5_plantar.R'
            ],
        };
    }

    // ==========================================
    // REGION FOCUSING
    // ==========================================

    // Main method to focus on a region by name
    focusOnRegion(regionName, preserveRotation = true) {
        if (!regionName || regionName === 'Entire Body') {
            this.resetView();
            return;
        }

        const regions = this.regionMap[regionName];
        if (!regions) {
            console.warn("Unknown region:", regionName);
            return;
        }

        const { center, box } = this.calculateRegionBounds(regions);
        if (center && box) {
            // Capture current viewing state BEFORE setFocus (which may reset angle)
            const isBackRegion = this.isBackFacingRegion(regionName);
            const currentlyViewingBack = Math.abs(this.rotationAngle) > Math.PI / 2;
            
            // Pass preserveRotation to setFocus so it knows whether to reset the angle
            this.setFocus(regionName, center, box, preserveRotation);
            
            if (!preserveRotation) {
                // Force set angle based on region type
                this.rotationAngle = isBackRegion ? Math.PI : 0;
            } else {
                // If switching between front/back region types, adjust angle
                if (isBackRegion && !currentlyViewingBack) {
                    // Switching to a back region from front view - flip to back
                    this.rotationAngle = Math.PI;
                } else if (!isBackRegion && currentlyViewingBack) {
                    // Switching to a front region from back view - flip to front
                    this.rotationAngle = 0;
                }
                // Otherwise preserve current angle (already preserved by setFocus)
            }
            
            // Apply the rotation to position camera correctly
            this.applyRotation(false); // false = animate
        } else {
            console.warn("Could not calculate bounds for region:", regionName);
        }
    }
    
    // Check if a region is on the back of the body
    isBackFacingRegion(regionName) {
        const backKeywords = [
            'Back', 'back', 'posterior', 'Posterior', 
            'buttock', 'Buttock', 'sacrum', 'coccyx',
            'heel', 'Heel', 'plantar', 'Plantar',
            'Hand (Back)'
        ];
        
        // Check region name
        for (const keyword of backKeywords) {
            if (regionName.includes(keyword)) {
                return true;
            }
        }
        
        // Check if the regions in the map contain posterior/dorsal indicators
        const regions = this.regionMap[regionName];
        if (regions) {
            const posteriorCount = regions.filter(r => 
                r.includes('posterior') || r.includes('back_') || 
                r.includes('buttock') || r.includes('plantar') ||
                r.includes('heel') || r.includes('sacrum') || r.includes('coccyx') ||
                r.includes('hand_dorsal') || r.includes('_dorsal')
            ).length;
            
            // If more than half the regions are posterior/dorsal, it's a back region
            return posteriorCount > regions.length / 2;
        }
        
        return false;
    }

    // Calculate bounding box for given region names
    calculateRegionBounds(regionNames) {
        if (!this.mesh) return { center: null, box: null };
        
        const geometry = this.mesh.geometry;
        const regionIDAttr = geometry.attributes._regionid;
        const positionAttr = geometry.attributes.position;

        if (!regionIDAttr) return { center: null, box: null };

        // Get region IDs for the target regions
        const targetRegionIds = new Set();
        
        for (const name of regionNames) {
            const id = AppState.regionToIdMap?.[name];
            if (id !== undefined) {
                targetRegionIds.add(id);
            }
        }
        
        if (targetRegionIds.size === 0) {
            return { center: null, box: null };
        }

        // Collect vertices belonging to target regions
        const points = [];
        for (let i = 0; i < regionIDAttr.count; i++) {
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

        if (points.length === 0) {
            return { center: null, box: null };
        }

        // Create bounding box and transform to world space
        const localBox = new THREE.Box3().setFromPoints(points);
        const box = localBox.clone().applyMatrix4(this.mesh.matrixWorld);
        
        const center = new THREE.Vector3();
        box.getCenter(center);

        return { center, box };
    }
    
    // Set focus state for a region
    setFocus(regionName, center, boundingBox, preserveRotation = false) {
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        if (!preserveRotation) {
            this.rotationAngle = 0;
        }
        
        this.focusedRegionName = regionName;
        this.focusCenter = center.clone();
        this.focusRadius = Math.max(size.x, size.y, size.z) / 2;
        
        // Calculate optimal viewing distance based on region size and camera FOV
        const fov = this.camera.fov * (Math.PI / 180);
        const aspectRatio = this.camera.aspect;
        
        // Use the larger dimension to ensure the region fits in view
        const maxDimension = Math.max(size.x, size.y, size.z);
        this.optimalDistance = (maxDimension / 2) / Math.tan(fov / 2) * 2.0;
        
        // Ensure minimum distance to prevent clipping
        this.optimalDistance = Math.max(this.optimalDistance, 0.25);
        
        // Update controls limits
        this.controls.minDistance = Math.max(0.05, this.focusRadius * 0.3);
        this.controls.maxDistance = this.optimalDistance * 5;
        
        // Update controls target to the region center
        this.controls.target.copy(center);
        
        return this.optimalDistance;
    }
    
    // Get initial viewing angle for a region
    getInitialAngle(regionName) {
        // Back regions - start from behind (PI radians = 180 degrees)
        if (regionName.includes('Back') || regionName.includes('back')) {
            return Math.PI;
        }
        
        // Posterior regions
        if (regionName.includes('posterior') || regionName.includes('Posterior')) {
            return Math.PI;
        }
        
        // Default front view (0 radians)
        return 0;
    }
    
    // Get elevation angle for a region (for feet, hands, etc.)
    getElevationAngle(regionName) {
        // Feet and ankles - view from above
        if (regionName.includes('Foot') || regionName.includes('Ankle')) {
            return Math.PI / 6; // 30 degrees from horizontal
        }
        
        // Hands and wrists - slight elevation
        if (regionName.includes('Hand') || regionName.includes('Wrist')) {
            return Math.PI / 12; // 15 degrees
        }
        
        // Default - no elevation
        return 0;
    }
    
    // Clear focus state (but preserve rotation angle in AppState)
    clearFocus() {
        this.focusCenter = null;
        this.focusRadius = null;
        this.optimalDistance = null;
        this.focusedRegionName = null;
        // Note: We intentionally do NOT reset currentAngle here
        // so the rotation persists when switching regions
        
        // Reset control limits
        this.controls.minDistance = 0.3;
        this.controls.maxDistance = 5.0;
    }
    
    // Reset rotation angle to front view
    resetRotation() {
        this.rotationAngle = 0;
    }

    // Reset to default full body view
    resetView() {
        this.clearFocus();
        
        // Reset rotation to front view
        this.rotationAngle = 0;

        // Reset dropdown if it exists
        const dropdown = document.querySelector('.region-dropdown');
        if (dropdown) {
            dropdown.value = 'Entire Body';
        }

        // Animate to default view
        const targetPosition = new THREE.Vector3(0, 1, this.defaultDistance);
        this.controls.target.copy(this.defaultPivot);
        return this.animateCamera(targetPosition, this.defaultPivot.clone(), 600);
    }

    // Fit camera to frame all visible regions (used with region visibility filter)
    fitToVisibleRegions(visibleRegionIds) {
        if (!visibleRegionIds || visibleRegionIds.length === 0) {
            return this.resetView();
        }

        if (!this.mesh) return;

        const geometry = this.mesh.geometry;
        const positionAttr = geometry.attributes.position;
        const regionIDAttr = geometry.attributes._regionid;

        if (!regionIDAttr) return;

        // Build a set for fast lookup
        const idSet = new Set(visibleRegionIds);

        // Collect all vertices belonging to any visible region
        const points = [];
        for (let i = 0; i < regionIDAttr.count; i++) {
            const regionId = regionIDAttr.getX(i);
            if (idSet.has(regionId)) {
                points.push(new THREE.Vector3(
                    positionAttr.getX(i),
                    positionAttr.getY(i),
                    positionAttr.getZ(i)
                ));
            }
        }

        if (points.length === 0) return this.resetView();

        // Combined bounding box in world space
        const localBox = new THREE.Box3().setFromPoints(points);
        const box = localBox.clone().applyMatrix4(this.mesh.matrixWorld);

        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);

        // Calculate distance to fit the bounding box in view
        const fov = this.camera.fov * (Math.PI / 180);
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = (maxDim / 2) / Math.tan(fov / 2) * 1;
        const finalDistance = Math.max(distance, 0.5);

        // Reset rotation to front view for the new selection
        this.rotationAngle = 0;

        // Store focus state so rotation controls orbit around this center
        this.focusedRegionName = null;
        this.focusCenter = center.clone();
        this.focusRadius = maxDim / 2;
        this.optimalDistance = finalDistance;

        // Update controls limits
        this.controls.minDistance = Math.max(0.05, this.focusRadius * 0.3);
        this.controls.maxDistance = finalDistance * 5;
        this.controls.target.copy(center);

        // Position camera in front of the center
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

    // Rotate left (counter-clockwise when viewed from above)
    rotateLeft() {
        if (this.isAnimating) return;
        this.rotationAngle -= this.rotationIncrement;
        this.normalizeAngle();
        this.applyRotation(true);
    }

    // Rotate right (clockwise when viewed from above)
    rotateRight() {
        if (this.isAnimating) return;
        this.rotationAngle += this.rotationIncrement;
        this.normalizeAngle();
        this.applyRotation(true);
    }

    // Rotate by direction name
    rotate(direction) {
        if (direction === 'left') {
            this.rotateLeft();
        } else if (direction === 'right') {
            this.rotateRight();
        }
    }

    // Rotate to a specific named view
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
            this.applyRotation(true);
        }
    }

    // Legacy method for compatibility
    reorientCamera(direction) {
        this.rotateTo(direction);
    }

    // Normalize angle to [-PI, PI]
    normalizeAngle() {
        while (this.rotationAngle > Math.PI) this.rotationAngle -= Math.PI * 2;
        while (this.rotationAngle < -Math.PI) this.rotationAngle += Math.PI * 2;
    }

    // Apply the current rotation angle - camera orbits around focus center
    applyRotation(animate = true) {
        const center = this.focusCenter ? this.focusCenter.clone() : this.defaultPivot.clone();
        const distance = (this.optimalDistance || this.defaultDistance);
        
        // Get elevation angle for special regions
        const elevationAngle = this.getElevationAngle(this.focusedRegionName || '');
        
        // Apply lateral + posterior + vertical offset to the orbit center for arm regions
        // Arms stretch diagonally and hang down, so we adjust all three axes
        const centerOffset = this.getOrbitCenterOffset(this.focusedRegionName || '');
        center.x += centerOffset.x;
        center.y += centerOffset.y;
        center.z += centerOffset.z;
        
        // Calculate camera position on a sphere around the (adjusted) center
        // Y-axis rotation (horizontal orbit)
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
        
        // Aggressive near clipping for upper arm front view to hide torso
        const isFrontView = Math.abs(this.rotationAngle) < Math.PI / 4;
        if ((this.focusedRegionName?.includes('Upper Arm') || this.focusedRegionName?.includes('Elbow') )&& isFrontView) {
            this.camera.near = distance * 0.1;
            this.camera.updateProjectionMatrix();
        }
        
        // Update controls target to always look at the adjusted center
        return this.animateCamera(targetPosition, center, animate ? 400 : 600);
    }
    
    // Get lateral (X), vertical (Y), and posterior (Z) offset for extremity regions
    getOrbitCenterOffset(regionName) {
        if (!regionName) return { x: 0, y: 0, z: 0 };
        
        // Determine if left or right (affects lateral direction)
        const isLeft = regionName.startsWith('Left');
        const isRight = regionName.startsWith('Right');
        
        // Lateral direction: +X for left (outward), -X for right (outward)
        const lateralSign = isLeft ? 1 : (isRight ? -1 : 0);
        
        // Define offsets per region type { lateral, vertical, posterior }
        // - Lateral: outward from body centerline
        // - Vertical: positive = raise orbit center for better viewing angle
        // - Posterior: negative Z = toward back
        const offsets = {
            'Upper Arm': { lateral: 0, vertical: 0, posterior: -0.15 },
            'Elbow':     { lateral: -0.07, vertical: -0.05, posterior: -0.17 },
            'Forearm':   { lateral: -0.07, vertical: -0.05, posterior: -0.24 },
            'Wrist':     { lateral: -0.07, vertical: -0.12, posterior: -0.37 },
            'Hand':      { lateral: -0.02, vertical: -0.13, posterior: -0.46 },
            'Thigh':     { lateral: 0.05, vertical: 0, posterior: 0 },
            'Knee':      { lateral: 0, vertical: 0, posterior: 0},
            'Lower Leg': { lateral: 0, vertical: 0, posterior: 0 },
            'Ankle':     { lateral: 0, vertical: 0, posterior: 0 },
            'Foot':      { lateral: 0, vertical: -0.05, posterior: 0 }
        };
        
        // Find matching region type
        for (const [regionType, offset] of Object.entries(offsets)) {
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

    // ==========================================
    // CAMERA ANIMATION
    // ==========================================

    // Smooth camera animation with spherical interpolation for rotation
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
                
                // Ease in-out curve
                const t = 0.5 - Math.cos(progress * Math.PI) / 2;
                
                // Interpolate position and target
                this.camera.position.lerpVectors(startPosition, targetPosition, t);
                this.controls.target.lerpVectors(startTarget, targetLookAt, t);
                
                // Make sure camera looks at target
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
    
    // Public method to move camera
    moveTo(position, lookAt, duration = 800) {
        this.animateCamera(position, lookAt, duration);
    }

    // ==========================================
    // BACKFACE DETECTION (Prevent drawing inside)
    // ==========================================
    
    /**
     * Check if a point on the mesh surface is facing the camera (drawable)
     * Returns true if the surface is facing the camera, false if it's a backface
     */
    isSurfaceFacingCamera(point, normal) {
        // Vector from point to camera
        const toCamera = new THREE.Vector3().subVectors(this.camera.position, point).normalize();
        
        // Dot product: positive = facing camera, negative = facing away
        const dot = normal.dot(toCamera);
        
        return dot > 0;
    }
    
    /**
     * Check if a raycast hit is on a front-facing surface
     * Use this in your drawing code to prevent drawing on backfaces
     */
    isDrawableHit(intersect) {
        if (!intersect || !intersect.face) return false;
        
        // Get the face normal in world space
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld);
        const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        
        return this.isSurfaceFacingCamera(intersect.point, worldNormal);
    }

    // ==========================================
    // CONTROLS EVENT HANDLING
    // ==========================================

    handleControlsChange() {
        // Only update during manual user interaction, not during animations
        if (this.isAnimating) return;
        
        const center = this.focusCenter || this.controls.target;
        const distance = this.camera.position.distanceTo(center);
        
        // Update near/far planes for proper rendering
        this.camera.near = Math.max(0.001, distance * 0.01);
        this.camera.far = Math.max(distance * 10, 100);
        this.camera.updateProjectionMatrix();
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    // Get current focus state
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
    
    // Get current view direction name (approximate)
    getCurrentViewName() {
        const angle = this.rotationAngle;
        const tolerance = Math.PI / 8; // 22.5 degrees
        
        if (Math.abs(angle) < tolerance) return 'Front';
        if (Math.abs(angle - Math.PI/4) < tolerance) return 'Front-Right';
        if (Math.abs(angle - Math.PI/2) < tolerance) return 'Right';
        if (Math.abs(angle - Math.PI*3/4) < tolerance) return 'Back-Right';
        if (Math.abs(Math.abs(angle) - Math.PI) < tolerance) return 'Back';
        if (Math.abs(angle + Math.PI*3/4) < tolerance) return 'Back-Left';
        if (Math.abs(angle + Math.PI/2) < tolerance) return 'Left';
        if (Math.abs(angle + Math.PI/4) < tolerance) return 'Front-Left';
        
        return 'Custom';
    }

    // Find dominant body part from drawn regions
    findDominantBodyPart(drawnRegionNames) {
        if (!drawnRegionNames || drawnRegionNames.size === 0) return null;

        const bodyPartCounts = {};

        for (const specificRegion of drawnRegionNames) {
            for (const [bodyPart, regions] of Object.entries(this.regionMap)) {
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

    // Classify a single region into an octant (8-way direction)
    classifyRegionOctant(regionName) {
        const lower = regionName.toLowerCase();
        
        // Determine left/right from suffix
        const isLeft = regionName.endsWith('.L');
        const isRight = regionName.endsWith('.R');
        
        // Determine medial vs lateral orientation
        // Medial = facing toward body midline (inner surface)
        // Lateral = facing away from body midline (outer surface)
        const isMedial = lower.includes('medial') && !lower.includes('anteromedial') && !lower.includes('posteromedial');
        const isAnteromedial = lower.includes('anteromedial');
        const isPosteromedial = lower.includes('posteromedial');
        const isLateral = lower.includes('lateral') && !lower.includes('anterolateral') && !lower.includes('posterolateral');
        const isAnterolateral = lower.includes('anterolateral');
        const isPosterolateral = lower.includes('posterolateral');
        
        // Determine front/back based on anatomical naming conventions
        const isAnterior = lower.includes('anterior') || lower.includes('volar') || 
                          lower.includes('pubic') || lower.includes('chest') ||
                          lower.includes('abdomen') || lower.includes('face') ||
                          lower.includes('dorso');  // dorso on foot = top = front-facing
        const isPosterior = lower.includes('posterior') || lower.includes('plantar') || 
                           lower.includes('back') || lower.includes('buttock') ||
                           lower.includes('sacrum') || lower.includes('coccyx') ||
                           lower.includes('psis') || lower.includes('planto') ||
                           lower.includes('hand_dorsal') || lower.includes('segment_dorsal');
        
        // === MEDIAL REGIONS: View from OPPOSITE side ===
        // Left body part's medial surface faces right → view from right
        // Right body part's medial surface faces left → view from left
        
        if (isMedial) {
            // Pure medial regions -> view from opposite side
            if (isLeft) return 'right';      // Left medial faces right
            if (isRight) return 'left';      // Right medial faces left
        }
        
        if (isAnteromedial) {
            // Anteromedial -> diagonal front view from opposite side
            if (isLeft) return 'front-right';   // Left anteromedial → view from front-right
            if (isRight) return 'front-left';   // Right anteromedial → view from front-left
        }
        
        if (isPosteromedial) {
            // Posteromedial -> diagonal back view from opposite side
            if (isLeft) return 'back-right';    // Left posteromedial → view from back-right
            if (isRight) return 'back-left';    // Right posteromedial → view from back-left
        }
        
        // === LATERAL REGIONS: View from SAME side ===
        // Left body part's lateral surface faces left → view from left
        // Right body part's lateral surface faces right → view from right
        
        if (isLateral) {
            // Pure lateral regions -> side view from same side
            if (isLeft) return 'left';
            if (isRight) return 'right';
        }
        
        if (isAnterolateral) {
            // Anterolateral -> diagonal front-side view from same side
            if (isLeft) return 'front-left';
            if (isRight) return 'front-right';
        }
        
        if (isPosterolateral) {
            // Posterolateral -> diagonal back-side view from same side
            if (isLeft) return 'back-left';
            if (isRight) return 'back-right';
        }
        
        // === PURE ANTERIOR/POSTERIOR (no medial/lateral) ===
        if (isPosterior) {
            if (isLeft) return 'back-left';
            if (isRight) return 'back-right';
            return 'back';
        }
        
        if (isAnterior) {
            if (isLeft) return 'front-left';
            if (isRight) return 'front-right';
            return 'front';
        }
        
        // === DEFAULT: Neutral regions without clear orientation ===
        // For regions like 'groin', 'perinium', etc. - default to same-side view
        if (isLeft) return 'front-left';
        if (isRight) return 'front-right';
        return 'front';
    }

    // Analyze drawing orientation with 45-degree granularity
    analyzeDrawingOrientation(drawnRegionNames) {
        if (!drawnRegionNames || drawnRegionNames.size === 0) {
            return { angle: 0, octant: 'front', confidence: 0 };
        }

        // Count regions in each octant
        const octantCounts = {
            'front': 0,
            'front-right': 0,
            'right': 0,
            'back-right': 0,
            'back': 0,
            'back-left': 0,
            'left': 0,
            'front-left': 0
        };

        for (const regionName of drawnRegionNames) {
            const octant = this.classifyRegionOctant(regionName);
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

        // Map octant to rotation angle
        // Positive angles rotate camera to the left (sees right side of body)
        // Negative angles rotate camera to the right (sees left side of body)
        const octantAngles = {
            'front': 0,
            'front-left': Math.PI / 4,        // 45° - camera moves right to see left-front
            'left': Math.PI / 2,              // 90° - camera moves right to see left side
            'back-left': Math.PI * 3 / 4,     // 135°
            'back': Math.PI,                  // 180°
            'back-right': -Math.PI * 3 / 4,   // -135°
            'right': -Math.PI / 2,            // -90° - camera moves left to see right side
            'front-right': -Math.PI / 4       // -45°
        };

        const totalRegions = drawnRegionNames.size;
        
        return {
            angle: octantAngles[dominantOctant],
            octant: dominantOctant,
            confidence: totalRegions > 0 ? maxCount / totalRegions : 0
        };
    }

    // Focus camera on a drawing based on drawn regions
    focusOnDrawing(drawnRegionNames) {
        if (!drawnRegionNames || drawnRegionNames.size === 0) {
            return this.resetView();
        }

        const dominantBodyPart = this.findDominantBodyPart(drawnRegionNames);
        if (!dominantBodyPart) {
            return this.resetView();
        }

        console.log("Dominant body part:", dominantBodyPart);

        const orientation = this.analyzeDrawingOrientation(drawnRegionNames);
        // console.log("Drawing orientation:", orientation.octant, "angle:", (orientation.angle * 180 / Math.PI).toFixed(0) + "°");
        
        const regions = this.regionMap[dominantBodyPart];
        if (!regions) {
            return this.resetView();
        }

        const { center, box } = this.calculateRegionBounds(regions);
        if (!center || !box) {
            return this.resetView();
        }

        this.setFocus(dominantBodyPart, center, box);

        // Set rotation angle directly from orientation analysis
        this.rotationAngle = orientation.angle;

        return this.applyRotation(true);
    }
    
    // Cleanup
    dispose() {
        this.controls.removeEventListener('change', this.handleControlsChange);
    }
}