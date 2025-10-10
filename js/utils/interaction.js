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
let cursorSizeEl = null;
let cursorIconEl = null;

const cursorHandlers = {
    mousemove: null,
    mouseleave: null,
    brushInput: null,
    drawBtnClick: null,
    eraseBtnClick: null,
    mousedown: null,
    mouseup: null
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
        cursorContainer.style.position = 'absolute';
        cursorContainer.style.pointerEvents = 'none';
        cursorContainer.style.zIndex = '9999';
        cursorContainer.style.transform = 'translate(-50%, -50%)';
        cursorContainer.style.display = 'none';
        cursorContainer.style.width = '40px';
        cursorContainer.style.height = '40px';
        document.body.appendChild(cursorContainer);

        cursorSizeEl = document.createElement('div');
        cursorSizeEl.className = 'cursor-size';
        cursorSizeEl.style.position = 'absolute';
        cursorSizeEl.style.borderRadius = '50%';
        cursorSizeEl.style.transition = 'width 0.2s, height 0.2s, background-color 0.2s';
        cursorSizeEl.style.top = '50%';
        cursorSizeEl.style.left = '50%';
        cursorSizeEl.style.transform = 'translate(-50%, -50%)';
        cursorContainer.appendChild(cursorSizeEl);

        cursorIconEl = document.createElement('div');
        cursorIconEl.className = 'cursor-icon';
        cursorIconEl.style.position = 'absolute';
        cursorIconEl.style.top = '50%';
        cursorIconEl.style.left = '50%';
        cursorIconEl.style.transform = 'translate(-50%, -50%)';
        cursorIconEl.style.width = '18px';
        cursorIconEl.style.height = '18px';
        cursorIconEl.style.overflow = 'visible';
        cursorIconEl.style.display = 'flex';
        cursorIconEl.style.alignItems = 'center';
        cursorIconEl.style.justifyContent = 'center';
        cursorContainer.appendChild(cursorIconEl);
    }
    
    cursorContainer.style.display = '';
    canvasPanel.style.cursor = 'none';

    const drawColor = '#0277BD';
    const eraseColor = '#FF5252';
    const getDrawIconSvg  = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></svg>`;
    const getEraseIconSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`;

    const updateIcon = () => {
       if (AppState.isErasing) {
            cursorSizeEl.style.border = `2px solid ${eraseColor}`;
            cursorSizeEl.style.backgroundColor = `rgba(255, 82, 82, 0.1)`;
            cursorIconEl.innerHTML = getEraseIconSvg(eraseColor);
        } else {
            cursorSizeEl.style.border = `2px solid ${drawColor}`;
            cursorSizeEl.style.backgroundColor = `rgba(2, 119, 189, 0.1)`;
            cursorIconEl.innerHTML = getDrawIconSvg(drawColor);
        } 
    }

    disableCursorManagement();

    // Handlers
    cursorHandlers.mousemove = (e) => {
    cursorContainer.style.display = 'block';
    cursorContainer.style.left = `${e.clientX}px`;
    cursorContainer.style.top  = `${e.clientY}px`;
    const size = AppState.brushRadius * 2;
    cursorSizeEl.style.width = `${size}px`;
    cursorSizeEl.style.height = `${size}px`;
    updateIcon();
  };
  cursorHandlers.mouseleave = () => { cursorContainer.style.display = 'none'; };
  cursorHandlers.brushInput = () => {
    const size = AppState.brushRadius * 2;
    cursorSizeEl.style.width = `${size}px`;
    cursorSizeEl.style.height = `${size}px`;
  };
  cursorHandlers.mousedown = () => { cursorSizeEl.style.opacity = '0.8'; };
  cursorHandlers.mouseup   = ()   => { cursorSizeEl.style.opacity = '0.4'; };

  const brushSlider = document.querySelector('.vertical-slider');
  const drawBtn     = document.querySelector('.button-primary');
  const eraseBtn    = document.querySelector('.button-secondary');

  // Attach listeners
  canvasPanel.addEventListener('mousemove', cursorHandlers.mousemove, { passive: true });
  canvasPanel.addEventListener('mouseleave', cursorHandlers.mouseleave, { passive: true });
  canvasPanel.addEventListener('mousedown', cursorHandlers.mousedown, { passive: true });
  window.addEventListener('mouseup', cursorHandlers.mouseup, { passive: true });

  if (brushSlider) brushSlider.addEventListener('input', cursorHandlers.brushInput, { passive: true });
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
    if (cursorHandlers.mousedown)  { canvasPanel.removeEventListener('mousedown', cursorHandlers.mousedown); cursorHandlers.mousedown = null; }
    if (cursorHandlers.mouseup)    { window.removeEventListener('mouseup', cursorHandlers.mouseup); cursorHandlers.mouseup = null; }

    const brushSlider = document.querySelector('.vertical-slider');
    if (brushSlider && cursorHandlers.brushInput) {
        brushSlider.removeEventListener('input', cursorHandlers.brushInput);
        cursorHandlers.brushInput = null;
    }
    const drawBtn = document.querySelector('.button-primary');
    const eraseBtn = document.querySelector('.button-secondary');
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