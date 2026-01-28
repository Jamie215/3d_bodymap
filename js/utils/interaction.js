import AppState from '../app/state.js';
import eventManager from '../app/eventManager.js';
import { drawAtPointer } from '../services/drawingEngine.js';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const eventIds = [];

// State
let pointerDown = false;
let pinchActive = false;
const activePointers = new Map();

// Cursor management
let cursorContainer = null;
let cursorIconEl = null;

const cursorHandlers = {
    mousemove: null,
    mouseleave: null,
    drawBtnClick: null,
    eraseBtnClick: null
};

// Remove all registered event listeners
export function cleanupInteraction() {
    eventIds.forEach(id => eventManager.remove(id));
    eventIds.length = 0;
    pointerDown = false;
    pinchActive = false;
    activePointers.clear();
}

export function enableInteraction(renderer, camera, controls) {
    const canvas = renderer.domElement;

    // Prevent default touch actions on canvas
    canvas.style.touchAction = 'none';

    // Pointer down: begin drawing
    eventIds.push(eventManager.add(canvas, 'pointerdown', (event) => {
        // Register pointer
        activePointers.set(event.pointerId, {x: event.clientX, y: event.clientY })

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

    eventIds.push(eventManager.add(window, 'pointermove', (event) => {
        if (!AppState.isDrawing || !AppState.skinMesh || !pointerDown) return;
        if (event.pointerType === 'mouse' && event.buttons === 0) return;

        if (activePointers.has(event.pointerId)) {
            activePointers.set(event.pointerId, {x: event.clientX, y: event.clientY });
        }

        if (pinchActive) {
            controls.enabled = true;
            return;
        }

        updatePointer(event, canvas);
        drawAtPointer(camera, pointer, AppState.isErasing);
    }));

    const endPointer = (event) => {
        activePointers.delete(event.pointerId);

        if (activePointers.size < 2) {
            pinchActive = false;
        }

        if (activePointers.size === 0) {
            pointerDown = false;
            AppState.isDrawing = false;
            controls.enabled = true;
        } else {

        }
    };

    eventIds.push(eventManager.add(window, 'pointerup', endPointer));
    eventIds.push(eventManager.add(window, 'pointercancel', endPointer));
}

export function setupCursorManagement() {
    const canvasPanel = document.getElementById('canvas-panel');
    if (!canvasPanel) return;

    // Create container for cursor elements
    if (!cursorContainer || !document.body.contains(cursorContainer)) {
        cursorContainer = document.createElement('div');
        cursorContainer.classList.add('cursor-container');
        document.body.appendChild(cursorContainer);

        cursorIconEl = document.createElement('div');
        cursorIconEl.className = 'cursor-icon';
        cursorContainer.appendChild(cursorIconEl);
    }
    
    cursorContainer.style.display = '';
    canvasPanel.style.cursor = 'none';

    const drawColor = 'var(--primary-color)';
    const eraseColor = 'var(--light-red)';
    const getDrawIcon  = (c) => `<i class="fa-solid fa-pen" style="color: ${c};"></i>`;
    const getEraseIcon = (c) => `<i class="fa-solid fa-eraser" style="color: ${c};"></i>`;

    const updateIcon = () => {
       cursorIconEl.innerHTML = AppState.isErasing ? getEraseIcon(eraseColor) : getDrawIcon(drawColor);
    }

    disableCursorManagement();

    // Handlers
    cursorHandlers.mousemove = (e) => {
    cursorContainer.style.display = 'block';
    cursorContainer.style.left = `${e.clientX}px`;
    cursorContainer.style.top  = `${e.clientY}px`;
  };
  cursorHandlers.mouseleave = () => { cursorContainer.style.display = 'none'; };

  const drawBtn = document.getElementById('draw-button');
  const eraseBtn = document.getElementById('erase-button');

  // Attach listeners
  canvasPanel.addEventListener('mousemove', cursorHandlers.mousemove, { passive: true });
  canvasPanel.addEventListener('mouseleave', cursorHandlers.mouseleave, { passive: true });

  if (drawBtn) {
    cursorHandlers.drawBtnClick = () => { AppState.isErasing = false; updateIcon(); };
    drawBtn.addEventListener('click', cursorHandlers.drawBtnClick);
  }
  if (eraseBtn) {
    cursorHandlers.eraseBtnClick = () => { AppState.isErasing = true; updateIcon(); };
    eraseBtn.addEventListener('click', cursorHandlers.eraseBtnClick);
  }

  // Initial paint
  updateIcon();
}

export function disableCursorManagement() {
    const canvasPanel = document.getElementById('canvas-panel');
    if (!canvasPanel) return;

    // Remove listeners if present
    if (cursorHandlers.mousemove)  { canvasPanel.removeEventListener('mousemove', cursorHandlers.mousemove); cursorHandlers.mousemove  = null; }
    if (cursorHandlers.mouseleave) { canvasPanel.removeEventListener('mouseleave', cursorHandlers.mouseleave); cursorHandlers.mouseleave = null; }

    const drawBtn = document.querySelector('.draw-button');
    const eraseBtn = document.querySelector('.erase-button');
    if (drawBtn && cursorHandlers.drawBtnClick) {
        drawBtn.removeEventListener('click', cursorHandlers.drawBtnClick);
        cursorHandlers.drawBtnClick = null;
    }
    if (eraseBtn && cursorHandlers.eraseBtnClick) {
        eraseBtn.removeEventListener('click', cursorHandlers.eraseBtnClick);
        cursorHandlers.eraseBtnClick = null;
    }

    if (cursorContainer) cursorContainer.style.display = 'none';
    canvasPanel.style.cursor = 'default';
}

function updatePointer(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;

    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function handlePointerDown(camera, controls) {
    if (AppState.skinMesh) {
        AppState.skinMesh.updateMatrixWorld(true);
    }
    
    controls.enabled = false;
    controls.update();
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    
    // Get foot bounding box in world coordinates
    if (!AppState.skinMesh.geometry.boundingBox) {
        AppState.skinMesh.geometry.computeBoundingBox();
    }
    const bbox = AppState.skinMesh.geometry.boundingBox.clone();
    bbox.applyMatrix4(AppState.skinMesh.matrixWorld);
    
    raycaster.setFromCamera(pointer, camera);
    raycaster.near = camera.near;
    raycaster.far = camera.far;
    
    // Calculate where we're aiming    
    const intersects = raycaster.intersectObject(AppState.skinMesh, true);

    if (intersects.length > 0) {
        AppState.isDrawing = true;
        pointerDown = true;
        drawAtPointer(camera, pointer, AppState.isErasing);
    } else {
        console.warn('No intersection detected');
        controls.enabled = true;
    }
}

export function syncEraserState() {
    const drawBtn = document.getElementById('draw-button');
    const eraseBtn = document.getElementById('erase-button');
    const brushSizeLabel = document.querySelector('.drawing-tools-container h2');
    
    if (!drawBtn || !eraseBtn) return;
    
    if (AppState.isErasing) {
        eraseBtn.classList.remove('button-secondary');
        eraseBtn.classList.add('button-primary');
        drawBtn.classList.remove('button-primary');
        drawBtn.classList.add('button-secondary');
        if (brushSizeLabel) brushSizeLabel.textContent = 'Eraser Size';
    } else {
        drawBtn.classList.remove('button-secondary');
        drawBtn.classList.add('button-primary');
        eraseBtn.classList.remove('button-primary');
        eraseBtn.classList.add('button-secondary');
        if (brushSizeLabel) brushSizeLabel.textContent = 'Marker Size';
    }
}