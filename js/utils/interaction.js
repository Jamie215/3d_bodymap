// interaction.js
// Pointer event handling for the drawing stage: pointerdown, pointermove,
// pointerup/cancel, and the raycast → draw dispatch.
//
// Custom cursor management extracted to cursorManager.js.

import AppState from '../app/state.js';
import eventManager from '../app/eventManager.js';
import { drawAtPointer } from '../services/drawingEngine.js';
import { isRegionVisible } from './regionVisibility.js';

// Re-export cursor functions so existing import paths keep working
export { setupCursorManagement, disableCursorManagement } from './cursorManager.js';

const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

const eventIds = [];

// Pointer state
let pointerDown  = false;
let pinchActive  = false;
const activePointers = new Map();

// ============================================================================
// PUBLIC API
// ============================================================================

/** Remove all registered event listeners and reset pointer state. */
export function cleanupInteraction() {
    eventIds.forEach(id => eventManager.remove(id));
    eventIds.length = 0;
    pointerDown = false;
    pinchActive = false;
    activePointers.clear();
}

/** Wire up pointer events on the renderer canvas for drawing. */
export function enableInteraction(renderer, camera, controls) {
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';

    // ── Pointer down ────────────────────────────────────────────────────
    eventIds.push(eventManager.add(canvas, 'pointerdown', (event) => {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // Two-finger pinch → delegate to orbit controls
        if (activePointers.size >= 2) {
            pinchActive = true;
            AppState.isDrawing = false;
            pointerDown = false;
            controls.enabled = true;
            return;
        }

        if (!AppState.skinMesh || event.target !== canvas) return;

        updatePointer(event, canvas);
        handlePointerDown(camera, controls);
    }));

    // ── Pointer move ────────────────────────────────────────────────────
    eventIds.push(eventManager.add(window, 'pointermove', (event) => {
        if (!AppState.isDrawing || !AppState.skinMesh || !pointerDown) return;
        if (event.pointerType === 'mouse' && event.buttons === 0) return;

        if (activePointers.has(event.pointerId)) {
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }

        if (pinchActive) {
            controls.enabled = true;
            return;
        }

        updatePointer(event, canvas);
        drawAtPointer(camera, pointer, AppState.isErasing);
    }));

    // ── Pointer end ─────────────────────────────────────────────────────
    const endPointer = (event) => {
        activePointers.delete(event.pointerId);
        if (activePointers.size < 2) pinchActive = false;

        if (activePointers.size === 0) {
            pointerDown = false;
            AppState.isDrawing = false;
            controls.enabled = true;
        }
    };

    eventIds.push(eventManager.add(window, 'pointerup',     endPointer));
    eventIds.push(eventManager.add(window, 'pointercancel', endPointer));
}

/**
 * Sync the draw/erase button visual state to match AppState.isErasing.
 * Called when re-entering the drawing stage.
 */
export function syncEraserState() {
    const drawBtn  = document.getElementById('draw-button');
    const eraseBtn = document.getElementById('erase-button');
    const label    = document.querySelector('.drawing-tools-container h2');

    if (!drawBtn || !eraseBtn) return;

    if (AppState.isErasing) {
        eraseBtn.classList.remove('button-secondary');
        eraseBtn.classList.add('button-primary');
        drawBtn.classList.remove('button-primary');
        drawBtn.classList.add('button-secondary');
        if (label) label.textContent = 'Eraser Size';
    } else {
        drawBtn.classList.remove('button-secondary');
        drawBtn.classList.add('button-primary');
        eraseBtn.classList.remove('button-primary');
        eraseBtn.classList.add('button-secondary');
        if (label) label.textContent = 'Marker Size';
    }
}

// ============================================================================
// INTERNAL
// ============================================================================

function updatePointer(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    pointer.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    pointer.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
}

function handlePointerDown(camera, controls) {
    if (AppState.skinMesh) AppState.skinMesh.updateMatrixWorld(true);

    controls.enabled = false;
    controls.update();
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    if (!AppState.skinMesh.geometry.boundingBox) {
        AppState.skinMesh.geometry.computeBoundingBox();
    }

    raycaster.setFromCamera(pointer, camera);
    raycaster.near = camera.near;
    raycaster.far  = camera.far;

    const intersects = raycaster.intersectObject(AppState.skinMesh, true);

    if (intersects.length > 0) {
        const hit = intersects[0];

        // Gate: ignore hits on hidden regions
        if (hit.face && AppState.visibleRegionIds) {
            const regionAttr = AppState.skinMesh.geometry.getAttribute('_regionid');
            if (regionAttr) {
                const regionId = regionAttr.getX(hit.face.a);
                if (!isRegionVisible(regionId)) {
                    controls.enabled = true;
                    return;
                }
            }
        }

        AppState.isDrawing = true;
        pointerDown = true;
        drawAtPointer(camera, pointer, AppState.isErasing);
    } else {
        controls.enabled = true;
    }
}