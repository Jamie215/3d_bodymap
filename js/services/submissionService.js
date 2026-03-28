// submissionService.js

import AppState from '../app/state.js';
import texturePool from './texturePool.js';
import coverageCalculator from './coverageService.js';

// Dependencies injected via initSubmissionService()
let renderer = null;
let scene    = null;
let camera   = null;
let controls = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Call once at startup to provide external dependencies.
 *
 * @param {Object} deps
 * @param {THREE.WebGLRenderer} deps.renderer
 * @param {THREE.Scene}          deps.scene
 * @param {THREE.Camera}         deps.camera
 * @param {OrbitControls}        deps.controls
 */
export function initSubmissionService(deps) {
    renderer = deps.renderer;
    scene    = deps.scene;
    camera   = deps.camera;
    controls = deps.controls;
}

// ============================================================================
// COMBINED TEXTURE
// ============================================================================

/**
 * Composites every drawing instance onto a single canvas, making each
 * instance's white pixels transparent so layers stack visually.
 *
 * Used by the summary view (to show all areas at once) and by
 * the submission flow (snapshot capture).
 *
 * @returns {HTMLCanvasElement}
 */
export function createCombinedTexture() {
    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = texturePool.width;
    combinedCanvas.height = texturePool.height;
    const ctx = combinedCanvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    AppState.drawingInstances.forEach(instance => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = instance.canvas.width;
        tempCanvas.height = instance.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.drawImage(instance.canvas, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 255) {
                pixels[i + 3] = 0;
            }
        }

        tempCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
    });

    return combinedCanvas;
}

// ============================================================================
// MULTI-VIEW SNAPSHOTS
// ============================================================================

/**
 * Renders front / back / left / right snapshots of the model wearing
 * the supplied combined-texture canvas.
 *
 * Temporarily resizes the renderer and repositions the camera, then
 * restores everything to its original state before returning.
 *
 * @param {HTMLCanvasElement} combinedCanvas
 * @returns {Promise<Object>} { front, back, left, right } base-64 PNGs
 */
export async function captureMultiViewSnapshots(combinedCanvas) {
    const tempTexture = new THREE.CanvasTexture(combinedCanvas);
    tempTexture.needsUpdate = true;

    const originalMap = AppState.skinMesh.material.map;
    AppState.skinMesh.material.map = tempTexture;
    AppState.skinMesh.material.needsUpdate = true;

    const originalSize = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio = renderer.getPixelRatio();
    const originalCameraPosition = camera.position.clone();
    const originalCameraTarget = controls.target.clone();

    const previewWidth = 400;
    const previewHeight = 400;
    renderer.setSize(previewWidth, previewHeight, false);
    renderer.setPixelRatio(1);

    // Calculate framing distance from model bounds
    const bbox = new THREE.Box3().setFromObject(AppState.skinMesh);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.3;

    const viewAngles = [
        ['front', new THREE.Vector3(0, 0, dist)],
        ['back',  new THREE.Vector3(0, 0, -dist)],
        ['right', new THREE.Vector3(dist, 0, 0)],
        ['left',  new THREE.Vector3(-dist, 0, 0)],
    ];

    const snapshots = {};

    for (const [label, offset] of viewAngles) {
        camera.position.copy(center).add(offset);
        camera.position.y = center.y;
        controls.target.copy(center);
        controls.update();
        camera.updateProjectionMatrix();

        renderer.render(scene, camera);
        snapshots[label] = renderer.domElement.toDataURL('image/png');
    }

    // Restore everything
    camera.position.copy(originalCameraPosition);
    controls.target.copy(originalCameraTarget);
    controls.update();
    renderer.setSize(originalSize.x, originalSize.y, false);
    renderer.setPixelRatio(originalPixelRatio);

    AppState.skinMesh.material.map = originalMap;
    AppState.skinMesh.material.needsUpdate = true;
    renderer.render(scene, camera);

    tempTexture.dispose();

    return snapshots;
}

// ============================================================================
// SUBMISSION DATA ASSEMBLY
// ============================================================================

/**
 * Assembles the complete submission payload:
 *   - Per-area drawing data, questionnaire responses, and coverage metrics
 *   - Combined multi-view snapshots
 *   - General questionnaire responses
 *   - Session timing and device metadata
 *
 * @returns {Promise<Object>}
 */
export async function prepareSubmissionData() {
    const combinedCanvas = createCombinedTexture();
    const snapshot = await captureMultiViewSnapshots(combinedCanvas);

    const areas = AppState.drawingInstances.map((instance, index) => {
        const coverage = coverageCalculator.calculateCoverage(instance);

        return {
            areaNumber: index + 1,
            areaId: instance.id,
            drawingImageData: instance.uvDrawingData,
            questionnaireResponses: instance.questionnaireData,
            drawnRegions: Array.from(instance.drawnRegionNames || []),
            coverage: coverage ? {
                overallPercentage: coverage.overall.percentage,
                coloredArea: coverage.overall.coloredArea,
                regionBreakdown: coverage.regions,
                bodyPartBreakdown: coverage.bodyParts
            } : null
        };
    });

    return {
        startTime: window.sessionStartTime || new Date().toISOString(),
        completionTime: new Date().toISOString(),
        durationSeconds: window.sessionStartTime
            ? Math.round((Date.now() - new Date(window.sessionStartTime).getTime()) / 1000)
            : null,
        modelType: AppState.currentModelName,
        combinedDrawing: snapshot,
        totalAreas: areas.length,
        areas,
        generalQuestionnaire: AppState.generalQuestionnaireResponse,
        deviceInfo: {
            deviceType: getDeviceType(),
            operatingSystem: getOS(),
            browser: getBrowser(),
            userAgent: navigator.userAgent
        }
    };
}

// ============================================================================
// DEVICE DETECTION HELPERS
// ============================================================================

function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'Mobile';
    return 'Desktop';
}

function getOS() {
    const ua = navigator.userAgent;
    if (/windows phone/i.test(ua)) return 'Windows Phone';
    if (/android/i.test(ua)) return 'Android';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'iOS';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Win/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown';
}

function getBrowser() {
    const ua = navigator.userAgent;
    if (/Edg/.test(ua)) return 'Edge';
    if (/Chrome/.test(ua) && !/Edg/.test(ua)) return 'Chrome';
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari';
    if (/Firefox/.test(ua)) return 'Firefox';
    if (/MSIE|Trident/.test(ua)) return 'Internet Explorer';
    return 'Unknown';
}