import AppState from '../app/state.js';
import eventManager from '../app/eventManager.js';
import { drawAtPointer } from '../services/drawingEngine.js';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const eventIds = [];

let drawSuppressed = false;
let pointerDown = false;

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

// Add a cleanup function
export function cleanupInteraction() {
    // Remove all registered event listeners
    eventIds.forEach(id => eventManager.remove(id));
    eventIds.length = 0; // Clear the array
}

export function enableInteraction(renderer, camera, controls) {
    const canvas = renderer.domElement;

    // Prevent default touch actions on canvas
    canvas.style.touchAction = 'none';

    // Mouse-based interaction
    eventIds.push(eventManager.add(canvas, 'mousedown', (event) => {
        if (!AppState.skinMesh || event.target !== canvas) return;

        pointerDown = true;
        drawSuppressed = true;

        if (drawClickTimeout) clearTimeout(drawClickTimeout);

        drawClickTimeout = setTimeout(() => {
            drawClickTimeout = null;
            drawSuppressed = false;

            updatePointer(event, canvas);
            handlePointerDown(camera, controls);
        }, 250)

    }));

    eventIds.push(eventManager.add(window, 'mouseup', () => {
        pointerDown = false;

        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            controls.enabled = true;
        }
    }));

    eventIds.push(eventManager.add(window, 'mousemove', (event) => {
        if (!AppState.isDrawing || !AppState.skinMesh || event.target !== canvas) return;
        if (!pointerDown || drawSuppressed) return;
        updatePointer(event, canvas);
        drawAtPointer(camera, pointer, AppState.isErasing);
    }));

    eventIds.push(eventManager.add(canvas, 'dblclick', (event) => {
        if (!AppState.model) return;
        if (drawClickTimeout) {
            clearTimeout(drawClickTimeout);
            drawClickTimeout = null;
        }
        drawSuppressed = false;
        pointerDown = false;
        handleDoubleTap(event, canvas, camera, controls);
    }));

    // Touch-based Interaction
    let lastTouchTime = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let drawClickTimeout = null;
    let pinchActive = false;
    let initPinchDistance= 0;

    const doubleTapThreshold = 250;
    const doubleTapDistance = 30;

    function resetDrawSuppression() {
        drawSuppressed = false;
    }

    function getDistance(a, b) {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.hypot(dx, dy);
    }

    eventIds.push(eventManager.add(canvas, 'touchstart', (event) => {

        if (event.touches.length > 1) {
            pinchActive = true;
            initPinchDistance = getDistance(event.touches[0], event.touches[1]);
            return;
        }
        event.preventDefault();

        if (!AppState.skinMesh) return;

        const now = Date.now();
        const touch = event.touches[0];
        const dx = Math.abs(touch.clientX - lastTouchX);
        const dy = Math.abs(touch.clientY - lastTouchY);
        const dt = now - lastTouchTime;

        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        lastTouchTime = now;

        if (drawClickTimeout) {
            clearTimeout(drawClickTimeout);
            drawClickTimeout = null;
        }

        const isDoubleTap = (dt < doubleTapThreshold) && (dx < doubleTapDistance) && (dy < doubleTapDistance);

        if (isDoubleTap) {
            drawSuppressed = true;
            pointerDown = false;

            // Suppress for a brief moment to block accidental drawing
            handleDoubleTap(event, canvas, camera, controls);
            setTimeout(resetDrawSuppression, doubleTapThreshold);
            return;
        }

        pointerDown = true;
        drawSuppressed = true;

        drawClickTimeout = setTimeout(() => {
            drawSuppressed = false;
            drawClickTimeout = null;
            updatePointer(event, canvas);
            handlePointerDown(camera, controls);
        }, doubleTapThreshold);
    }, {passive: false}));

    eventIds.push(eventManager.add(canvas, 'touchend', (event) => {
        event.preventDefault();

        // Exit pinch mode when fingers lift
        if (pinchActive && event.touches.length < 2) {
            pinchActive = false;
        }

        pointerDown = false;
        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            controls.enabled = true;
        }
    }));

    eventIds.push(eventManager.add(canvas, 'touchmove', (event) => {
        event.preventDefault();

        if (pinchActive && event.touches.length > 1) {
            const newDist = getDistance(event.touches[0], event.touches[1]);
            const scale = newDist / initPinchDistance;

            controls.enableZoom = true;
            controls.zoomSpeed = scale;
            controls.update();

            return;
        }

        if(!AppState.isDrawing || !AppState.skinMesh) return;
        updatePointer(event, canvas);
        drawAtPointer(camera, pointer, AppState.isErasing);
    }, {passive: false}));
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
  canvasPanel.addEventListener('mousemove',  cursorHandlers.mousemove,  { passive: true });
  canvasPanel.addEventListener('mouseleave', cursorHandlers.mouseleave, { passive: true });
  canvasPanel.addEventListener('mousedown',  cursorHandlers.mousedown,  { passive: true });
  window.addEventListener('mouseup',         cursorHandlers.mouseup,    { passive: true });

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

    // Handle both mouse and touch events
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function handlePointerDown(camera, controls) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(AppState.skinMesh, true);

    if (intersects.length > 0) {
        AppState.isDrawing = true;
        controls.enabled = false;

        drawAtPointer(camera, pointer, AppState.isErasing);
    }
}

function handleDoubleTap(event, canvas, camera, controls) {
    if (!AppState.model) return;

    // Get pointer coordinates
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;

    // Check if it's a touch event with changedTouches
    if (event.changedTouches && event.changedTouches.length > 0) {
        // For touchend, use changedTouches
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
    } else if (event.touches && event.touches.length > 0) {
        // For touchstart/touchmove, use touches
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else if (event.clientX !== undefined && event.clientY !== undefined) {
        // For mouse events
        clientX = event.clientX;
        clientY = event.clientY;
    } else {
        // If we can't determine coordinates, exit
        return;
    }

    const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const mouseVec = new THREE.Vector2(mouseX, mouseY);

    const localRay = new THREE.Raycaster();
    localRay.setFromCamera(mouseVec, camera);
    const intersects = localRay.intersectObject(AppState.skinMesh, true);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const direction = new THREE.Vector3().subVectors(point, camera.position).normalize();
        const distance = camera.position.distanceTo(point);
        const zoomFactor = 0.4;

        camera.position.addScaledVector(direction, distance * zoomFactor);
        controls.target.copy(point);
        controls.update();
    }
}