// submissionService.js

import * as THREE from 'three';
import AppState from '../app/state.js';
import texturePool from './texturePool.js';
import coverageCalculator from './coverageService.js';
import { buildCsvFiles } from './csvExporter.js';
import { DATA_DICTIONARY_MD } from '../data/dataDictionary.js';

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
 * @property {MultiViewSnapshots|null} bodyViews           — This area rendered on the 3D body (front/back/left/right)
 * @property {Object|null}         questionnaireResponses  — Area survey answers
 * @property {string[]}            drawnRegions            — Vertex group names with drawn content
 * @property {AreaCoverageData|null} coverage
 */

/**
 * The complete data payload assembled by {@link prepareSubmissionData}.
 *
 * There is no backend: this object is serialized and downloaded to the
 * participant's machine by {@link downloadSubmissionZip}, so it can be stored on
 * the provided encrypted device. (A future EmPOWER integration could POST the
 * same object instead.)
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
async function captureMultiViewSnapshots(combinedCanvas) {
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
    const originalAspect         = camera.aspect;

    try {
        AppState.skinMesh.material.map = tempTexture;
        AppState.skinMesh.material.needsUpdate = true;

        const previewWidth = 400;
        const previewHeight = 400;
        renderer.setSize(previewWidth, previewHeight, false);
        renderer.setPixelRatio(1);
        // Match the camera to the square capture buffer so the model isn't stretched.
        camera.aspect = previewWidth / previewHeight;

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
        camera.aspect = originalAspect;
        camera.updateProjectionMatrix();

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
 *   - Session timing
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

    const areas = [];
    for (let index = 0; index < AppState.drawingInstances.length; index++) {
        const instance = AppState.drawingInstances[index];
        const coverage = coverageCalculator.calculateCoverage(instance);

        // Render this single area onto the 3D body (front/back/left/right) so the
        // drawing has anatomical reference. Null if the capture fails.
        const bodyViews = await captureMultiViewSnapshots(instance.canvas);

        areas.push({
            areaNumber: index + 1,
            areaId: instance.id,
            bodyViews,
            questionnaireResponses: instance.questionnaireData,
            drawnRegions: Array.from(instance.drawnRegionNames || []),
            coverage: coverage ? {
                overallPercentage: coverage.overall.percentage,
                coloredArea: coverage.overall.coloredArea,
                regionBreakdown: coverage.regions,
                bodyPartBreakdown: coverage.bodyParts
            } : null
        });
    }

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
        generalQuestionnaire: AppState.generalQuestionnaireResponse
        // Data minimization: no device or browser information is captured. The
        // tool is intended for a supervised desktop setting, so device/OS/browser
        // categories add nothing to the analysis while widening the data surface.
        // The raw navigator.userAgent is likewise never read.
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
function buildSubmissionBaseName(payload) {
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
 * Whether the browser supports the File System Access API, which lets the
 * participant choose where the response file is written (e.g. straight to the
 * provided encrypted device) instead of it landing in the default Downloads
 * folder. Supported on Chromium desktop browsers (Chrome/Edge); unsupported on
 * Firefox/Safari, where we fall back to a normal download.
 *
 * @returns {boolean}
 */
function supportsSavePicker() {
    return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/**
 * Opens the browser's "Save as…" dialog so the participant can choose the save
 * location. Must be called while the triggering click still has user activation,
 * so callers request the target BEFORE any long async work (e.g. zip building).
 *
 * @param {string} suggestedName
 * @param {{description: string, mime: string, ext: string}} opts
 * @returns {Promise<{handle: FileSystemFileHandle|null, cancelled: boolean}>}
 *   handle — a writable file handle, or null to fall back to a normal download.
 *   cancelled — true only when the participant dismissed the dialog themselves.
 */
async function requestSaveTarget(suggestedName, { description, mime, ext }) {
    if (!supportsSavePicker()) return { handle: null, cancelled: false };
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName,
            types: [{ description, accept: { [mime]: [ext] } }]
        });
        return { handle, cancelled: false };
    } catch (error) {
        // The participant closed the dialog without choosing — do nothing.
        if (error && error.name === 'AbortError') return { handle: null, cancelled: true };
        // Any other failure (e.g. a SecurityError): fall back to a normal download.
        console.warn('Save dialog unavailable; falling back to default download', error);
        return { handle: null, cancelled: false };
    }
}

/**
 * Writes a Blob to a chosen file handle, or downloads it the default way when no
 * handle was obtained.
 *
 * @param {FileSystemFileHandle|null} handle
 * @param {Blob} blob
 * @param {string} filename
 */
async function writeToTarget(handle, blob, filename) {
    if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
    }
    triggerBlobDownload(blob, filename);
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
    if (comma === -1 || !dataUrl.startsWith('data:') || !/;base64/i.test(dataUrl.slice(0, comma))) {
        return null;
    }
    return dataUrl.slice(comma + 1);
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
 *     csv/{session,areas,coverage}.csv + README.md
 *
 * Where the browser supports it, the participant is asked where to save the file
 * (so it can go straight to the encrypted device, with no copy in Downloads);
 * otherwise it downloads normally. Entirely client-side — no network request.
 * Uses the vendored global `JSZip`.
 *
 * @param {SubmissionPayload} payload
 * @returns {Promise<string|null>} the filename offered, or null if the
 *   participant cancelled the save dialog
 * @throws {Error} if JSZip is unavailable or zip generation fails
 */
export async function downloadSubmissionZip(payload) {
    if (typeof window === 'undefined' || !window.JSZip) {
        throw new Error('JSZip is not available (vendor/jszip/jszip.min.js not loaded)');
    }

    const base = buildSubmissionBaseName(payload);
    const filename = `${base}.zip`;

    // Ask where to save FIRST, while the triggering click still has user
    // activation (the picker requires it, and zip generation below is async).
    // This lets the participant write straight to the encrypted device with no
    // copy left in the Downloads folder. If they cancel, do nothing.
    const { handle, cancelled } = await requestSaveTarget(filename,
        { description: 'Response bundle (ZIP archive)', mime: 'application/zip', ext: '.zip' });
    if (cancelled) return null;

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

    // Per-area images → areas/area-<n>/{front,back,left,right}.png
    // (this area rendered on the 3D body, for anatomical reference)
    if (Array.isArray(payload.areas)) {
        const areasFolder = root.folder('areas');
        meta.areas = payload.areas.map((area) => {
            const dir = `area-${area.areaNumber}`;
            const folder = areasFolder.folder(dir);
            const next = { ...area };

            if (area.bodyViews && typeof area.bodyViews === 'object') {
                const refs = {};
                for (const [label, dataUrl] of Object.entries(area.bodyViews)) {
                    const b64 = dataUrlToBase64(dataUrl);
                    if (b64) {
                        folder.file(`${label}.png`, b64, { base64: true });
                        refs[label] = `areas/${dir}/${label}.png`;
                    } else {
                        refs[label] = null;
                    }
                }
                next.bodyViews = refs;
            }

            return next;
        });
    }

    root.file('metadata.json', JSON.stringify(meta, null, 2));

    // Tabular exports for analysis (region-by-region coverage in long format),
    // plus a data dictionary that explains every column.
    try {
        const csvFolder = root.folder('csv');
        for (const [name, text] of Object.entries(buildCsvFiles(payload))) {
            csvFolder.file(name, text);
        }
        csvFolder.file('README.md', DATA_DICTIONARY_MD);
    } catch (error) {
        console.error('CSV export failed; continuing with JSON + images only', error);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    await writeToTarget(handle, blob, filename);
    return filename;
}