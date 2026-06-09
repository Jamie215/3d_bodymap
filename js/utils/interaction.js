// interaction.js
// Pointer event handling for the drawing stage: pointerdown, pointermove,
// pointerup/cancel, and the raycast → draw dispatch.
//
// Supports single-finger drawing and two-finger pinch-to-zoom. Two-finger
// dolly is handled by OrbitControls directly via controls.touches.TWO =
// DOLLY_PAN (configured in scene.js); single-finger is bound to null there,
// so OrbitControls ignores it and our pointer handlers own the draw path.
//
// Public API:
//   enableInteraction(renderer, camera, controls) — wire up pointer events
//   cleanupInteraction()                          — remove all listeners
//   syncEraserState()                             — sync button visuals to AppState

import * as THREE from 'three';
import AppState from '../app/state.js';
import eventManager from '../app/eventManager.js';
import { drawAtPointer } from '../services/drawingEngine.js';
import { isRegionVisible } from './regionVisibility.js';

const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

/** @type {string[]} Event manager IDs for all registered listeners */
const eventIds = [];

// Pointer state
let pointerDown  = false;
let pinchActive  = false;

/** @type {Map<number, {x: number, y: number}>} Active pointer positions keyed by pointerId */
const activePointers = new Map();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Remove all registered event listeners and reset internal pointer state.
 * Safe to call multiple times — idempotent.
 */
export function cleanupInteraction() {
    eventIds.forEach(id => eventManager.remove(id));
    eventIds.length = 0;
    pointerDown = false;
    pinchActive = false;
    activePointers.clear();
}

/**
 * Wire up pointer events on the renderer's canvas for drawing/erasing.
 *
 * Event flow:
 *   pointerdown  → raycast; if hit, begin drawing
 *   pointermove  → if drawing, raycast + paint at UV coordinate
 *   pointerup    → stop drawing
 *
 * Two-finger pinch is detected by tracking active pointer count. When two
 * pointers are down, we stop drawing and let OrbitControls' built-in TWO
 * gesture (DOLLY_PAN, configured in scene.js) handle the zoom.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera}        camera
 * @param {OrbitControls}       controls
 */
export function enableInteraction(renderer, camera, controls) {
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';

    // ── Pointer down ────────────────────────────────────────────────────
    eventIds.push(eventManager.add(canvas, 'pointerdown', (event) => {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // Two-finger pinch → let OrbitControls handle dolly
        if (activePointers.size >= 2) {
            pinchActive = true;
            AppState.isDrawing = false;
            pointerDown = false;
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

        // Suppress drawing during a pinch — OrbitControls owns the gesture.
        if (pinchActive) return;

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
        }
    };

    eventIds.push(eventManager.add(window, 'pointerup',     endPointer));
    eventIds.push(eventManager.add(window, 'pointercancel', endPointer));
}

/**
 * Synchronise the draw/erase button visual state to match AppState.isErasing.
 * Called when re-entering the drawing stage to ensure the button highlight
 * reflects the current mode.
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

/**
 * Convert a DOM pointer event to normalised device coordinates (-1 to +1).
 *
 * @param {PointerEvent}     event
 * @param {HTMLCanvasElement} canvas
 */
function updatePointer(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    pointer.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    pointer.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
}

/**
 * Handle a pointerdown on the canvas: raycast into the scene, and if the
 * hit is on a visible region, begin drawing.
 *
 * @param {THREE.Camera}  camera
 * @param {OrbitControls} controls
 */
function handlePointerDown(camera, controls) {
    if (AppState.skinMesh) AppState.skinMesh.updateMatrixWorld(true);

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
                    return;
                }
            }
        }

        AppState.isDrawing = true;
        pointerDown = true;
        drawAtPointer(camera, pointer, AppState.isErasing);
    }
}