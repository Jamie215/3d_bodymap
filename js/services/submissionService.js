// submissionService.js

import * as THREE from 'three';
import AppState from '../app/state.js';
import texturePool from './texturePool.js';
import coverageCalculator from './coverageService.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Front/back/left/right base-64 PNG snapshots of the combined drawing.
 *
 * @typedef {Object} MultiViewSnapshots
 * @property {string} front — base-64 PNG data URL
 * @property {string} back
 * @property {string} left
 * @property {string} right
 */

/**
 * Coverage data attached to a single submitted area.
 *
 * @typedef {Object} AreaCoverageData
 * @property {number} overallPercentage                                — % of total body surface area
 * @property {number} coloredArea                                      — Absolute area in world units²
 * @property {Object<string, import('./coverageService.js').RegionCoverageEntry>}   regionBreakdown
 * @property {Object<string, import('./coverageService.js').BodyPartCoverageEntry>} bodyPartBreakdown
 */

/**
 * A single pain/symptom area in the submission payload.
 *
 * @typedef {Object} SubmissionArea
 * @property {number}              areaNumber              — 1-based area index
 * @property {string}              areaId                  — e.g. "drawing-1"
 * @property {string|null}         drawingImageData        — Base-64 PNG of the UV canvas (raw drawing)
 * @property {string|null}         areaImage               — Base-64 PNG: the drawing composited on the body UV atlas (single legible image)
 * @property {Object|null}         questionnaireResponses  — Area survey answers
 * @property {string[]}            drawnRegions            — Vertex group names with drawn content
 * @property {AreaCoverageData|null} coverage
 */

/**
 * Browser and device metadata.
 *
 * @typedef {Object} DeviceInfo
 * @property {'Desktop'|'Tablet'|'Mobile'}  deviceType
 * @property {string}                        operatingSystem
 * @property {string}                        browser
 * (raw userAgent intentionally not captured — see REB #5 in prepareSubmissionData)
 */

/**
 * The complete data payload assembled by {@link prepareSubmissionData}.
 *
 * There is no backend: this object is serialized to JSON and downloaded to the
 * participant's machine by {@link downloadSubmission}, so it can be stored on the
 * provided encrypted device. (A future EmPOWER integration could POST the same
 * object instead.)
 *
 * @typedef {Object} SubmissionPayload
 * @property {string}               schemaVersion         — Payload format version (see SCHEMA_VERSION)
 * @property {string}               sessionId             — Random, non-identifying session id
 * @property {string}               startTime             — ISO 8601 session start
 * @property {string}               completionTime        — ISO 8601 submission time
 * @property {number|null}          durationSeconds        — Wall-clock session duration
 * @property {string}               modelType              — e.g. "Type 1"
 * @property {MultiViewSnapshots}   combinedDrawing        — 4-angle model snapshots
 * @property {number}               totalAreas             — Number of pain/symptom areas
 * @property {SubmissionArea[]}     areas                  — Per-area data
 * @property {Object|null}          generalQuestionnaire   — General survey answers
 * @property {DeviceInfo}           deviceInfo
 */

/**
 * Version of the {@link SubmissionPayload} shape. Bump this whenever the fields
 * change, so downloaded files remain parseable at analysis time.
 */
export const SCHEMA_VERSION = '1.0';

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
 * @returns {HTMLCanvasElement|null} null if compositing fails
 */
export function createCombinedTexture() {
    try {
        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = texturePool.width;
        combinedCanvas.height = texturePool.height;
        const ctx = combinedCanvas.getContext('2d');

        if (!ctx) {
            console.error('createCombinedTexture: failed to get 2D context');
            return null;
        }

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
    } catch (error) {
        console.error('createCombinedTexture: failed to composite drawing instances', error);
        return null;
    }
}

/**
 * Composites a single area's drawing on top of the body's UV atlas (the model's
 * ambient-occlusion map) so the painted region is legible on its own, in one
 * image, with anatomical reference — the raw UV drawing on a white background is
 * hard to interpret.
 *
 * The drawing texture (a CanvasTexture) is uploaded with flipY=true while the AO
 * map uses flipY=false, so on the 3D body they are vertically mirrored relative
 * to each other in UV space; the AO is therefore drawn vertically flipped so it
 * lines up with the drawing here.
 *
 * @param {import('../app/drawingInstanceManager.js').DrawingInstance} instance
 * @returns {string|null} base-64 PNG data URL, or null on failure
 */
export function createAreaMeshComposite(instance) {
    try {
        const src = instance?.canvas;
        if (!src) return null;

        const w = src.width;
        const h = src.height;
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const ctx = out.getContext('2d');
        if (!ctx) return null;

        // Body UV atlas backdrop (flip vertically to match the drawing's flipY).
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        const aoImage = AppState.skinMesh?.material?.aoMap?.image;
        if (aoImage) {
            try {
                ctx.save();
                ctx.translate(0, h);
                ctx.scale(1, -1);
                ctx.drawImage(aoImage, 0, 0, w, h);
                ctx.restore();
            } catch (e) {
                // Keep the white background if the AO image can't be drawn.
            }
        }

        // Overlay the drawing, making its white pixels transparent so only the
        // painted region shows over the mesh.
        const tmp = document.createElement('canvas');
        tmp.width = w;
        tmp.height = h;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(src, 0, 0);
        const imageData = tctx.getImageData(0, 0, w, h);
        const px = imageData.data;
        for (let i = 0; i < px.length; i += 4) {
            if (px[i] === 255 && px[i + 1] === 255 && px[i + 2] === 255) {
                px[i + 3] = 0;
            }
        }
        tctx.putImageData(imageData, 0, 0);
        ctx.drawImage(tmp, 0, 0);

        return out.toDataURL('image/png');
    } catch (error) {
        console.error('createAreaMeshComposite failed', error);
        return null;
    }
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
 * @returns {Promise<MultiViewSnapshots>}
 */
export async function captureMultiViewSnapshots(combinedCanvas) {
    if (!AppState.skinMesh) {
        console.error('captureMultiViewSnapshots: no skin mesh available');
        return null;
    }

    const tempTexture = new THREE.CanvasTexture(combinedCanvas);
    tempTexture.needsUpdate = true;

    // Save original state — must be restored even on error
    const originalMap            = AppState.skinMesh.material.map;
    const originalSize           = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio     = renderer.getPixelRatio();
    const originalCameraPosition = camera.position.clone();
    const originalCameraTarget   = controls.target.clone();

    try {
        AppState.skinMesh.material.map = tempTexture;
        AppState.skinMesh.material.needsUpdate = true;

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

        return snapshots;
    } catch (error) {
        console.error('captureMultiViewSnapshots: snapshot capture failed', error);
        return null;
    } finally {
        // Always restore renderer/camera state
        camera.position.copy(originalCameraPosition);
        controls.target.copy(originalCameraTarget);
        controls.update();
        renderer.setSize(originalSize.x, originalSize.y, false);
        renderer.setPixelRatio(originalPixelRatio);

        AppState.skinMesh.material.map = originalMap;
        AppState.skinMesh.material.needsUpdate = true;
        renderer.render(scene, camera);

        tempTexture.dispose();
    }
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
 * @returns {Promise<SubmissionPayload>}
 * @throws {Error} if texture compositing or snapshot capture fails
 */
export async function prepareSubmissionData() {
    const combinedCanvas = createCombinedTexture();
    if (!combinedCanvas) {
        throw new Error('Failed to create combined drawing texture');
    }

    const snapshot = await captureMultiViewSnapshots(combinedCanvas);
    if (!snapshot) {
        throw new Error('Failed to capture multi-view snapshots');
    }

    const areas = AppState.drawingInstances.map((instance, index) => {
        const coverage = coverageCalculator.calculateCoverage(instance);

        return {
            areaNumber: index + 1,
            areaId: instance.id,
            drawingImageData: instance.uvDrawingData,
            // The area's drawing composited on the body UV atlas — one legible
            // image with anatomical reference (null if compositing fails).
            areaImage: createAreaMeshComposite(instance),
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

    const startTime = AppState.sessionStartTime || new Date().toISOString();

    return {
        schemaVersion: SCHEMA_VERSION,
        sessionId: AppState.sessionId,
        startTime,
        completionTime: new Date().toISOString(),
        durationSeconds: AppState.sessionStartTime
            ? Math.round((Date.now() - new Date(AppState.sessionStartTime).getTime()) / 1000)
            : null,
        modelType: AppState.currentModelName,
        combinedDrawing: snapshot,
        totalAreas: areas.length,
        areas,
        generalQuestionnaire: AppState.generalQuestionnaireResponse,
        deviceInfo: {
            deviceType: getDeviceType(),
            operatingSystem: getOS(),
            browser: getBrowser()
            // REB #5 (data minimization): the raw navigator.userAgent string
            // is not captured. The full UA contributes to browser
            // fingerprinting / re-identification, and the coarse fields above
            // (Desktop / Windows / Chrome) are all that is needed. Re-enable
            // only if a specific analysis justifies it.
            // userAgent: navigator.userAgent
        }
    };
}

// ============================================================================
// LOCAL DOWNLOAD (no backend)
// ============================================================================

/**
 * Builds a no-identifier base name for a downloaded session, e.g.
 * `pain-assessment_2026-09-15T1430_a1b2c3d4`. The timestamp is local wall-clock
 * (colons stripped so it's filesystem-safe); the id is the random,
 * non-identifying session id. Callers append their own extension.
 *
 * @param {SubmissionPayload} payload
 * @returns {string}
 */
export function buildSubmissionBaseName(payload) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `T${pad(now.getHours())}${pad(now.getMinutes())}`;
    const idPart = String(payload?.sessionId || 'session').slice(0, 8);
    return `pain-assessment_${stamp}_${idPart}`;
}

/**
 * Triggers a browser download of a Blob, entirely client-side (no network).
 *
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        // Revoke on the next tick so the download has a chance to start first.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

/**
 * Extracts the base-64 body of a `data:` URL (e.g. a PNG snapshot). Returns null
 * if the value is missing or not a base-64 data URL.
 *
 * @param {string|null|undefined} dataUrl
 * @returns {string|null}
 */
function dataUrlToBase64(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    const comma = dataUrl.indexOf(',');
    if (!dataUrl.startsWith('data:') || !/;base64/i.test(dataUrl.slice(0, comma)) || comma === -1) {
        return null;
    }
    return dataUrl.slice(comma + 1);
}

/**
 * Serializes the submission payload to a single JSON file and downloads it.
 * The snapshot images ride along as base-64 inside the JSON, so the file is
 * self-contained. Entirely client-side — no network request.
 *
 * Retained as a fallback / simple export; the app's default is the richer
 * {@link downloadSubmissionZip}.
 *
 * @param {SubmissionPayload} payload
 * @returns {string} the filename that was offered for download
 */
export function downloadSubmission(payload) {
    const filename = `${buildSubmissionBaseName(payload)}.json`;
    const json = JSON.stringify(payload, null, 2);
    triggerBlobDownload(new Blob([json], { type: 'application/json' }), filename);
    return filename;
}

/**
 * Bundles the submission as a `.zip` and downloads it, so the participant can
 * store one file on the provided encrypted device. The archive contains:
 *
 *   <base>/
 *     metadata.json                — full payload, with the base-64 image blobs
 *                                    replaced by the paths of the extracted files
 *     snapshots/{front,back,left,right}.png
 *     areas/area-<n>.png           — per-area UV drawing (when present)
 *
 * (A CSV export will be added to the same archive later.)
 *
 * Entirely client-side — no network request. Uses the vendored global `JSZip`.
 *
 * @param {SubmissionPayload} payload
 * @returns {Promise<string>} the filename that was offered for download
 * @throws {Error} if JSZip is unavailable or zip generation fails
 */
export async function downloadSubmissionZip(payload) {
    if (typeof window === 'undefined' || !window.JSZip) {
        throw new Error('JSZip is not available (vendor/jszip/jszip.min.js not loaded)');
    }

    const base = buildSubmissionBaseName(payload);
    const zip = new window.JSZip();
    const root = zip.folder(base);

    // Shallow-clone the payload so we can swap image blobs for file references
    // without mutating the live AppState payload.
    const meta = { ...payload };

    // Combined multi-view snapshots → snapshots/<label>.png
    if (payload.combinedDrawing && typeof payload.combinedDrawing === 'object') {
        const snapshots = root.folder('snapshots');
        const refs = {};
        for (const [label, dataUrl] of Object.entries(payload.combinedDrawing)) {
            const b64 = dataUrlToBase64(dataUrl);
            if (b64) {
                snapshots.file(`${label}.png`, b64, { base64: true });
                refs[label] = `snapshots/${label}.png`;
            } else {
                refs[label] = null;
            }
        }
        meta.combinedDrawing = refs;
    }

    // Per-area images → areas/area-<n>/
    //   overview.png — the drawing composited on the body UV atlas (legible)
    //   drawing.png  — the raw UV drawing (exact painted texture)
    if (Array.isArray(payload.areas)) {
        const areasFolder = root.folder('areas');
        meta.areas = payload.areas.map((area) => {
            const dir = `area-${area.areaNumber}`;
            const folder = areasFolder.folder(dir);
            const next = { ...area };

            const overviewB64 = dataUrlToBase64(area.areaImage);
            if (overviewB64) {
                folder.file('overview.png', overviewB64, { base64: true });
                next.areaImage = `areas/${dir}/overview.png`;
            }

            const drawingB64 = dataUrlToBase64(area.drawingImageData);
            if (drawingB64) {
                folder.file('drawing.png', drawingB64, { base64: true });
                next.drawingImageData = `areas/${dir}/drawing.png`;
            }

            return next;
        });
    }

    root.file('metadata.json', JSON.stringify(meta, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = `${base}.zip`;
    triggerBlobDownload(blob, filename);
    return filename;
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