import AppState from '../app/state.js';
import eventManager from '../app/eventManager.js';
import { drawAtPointer } from '../services/drawingEngine.js';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const eventIds = [];

// Arrow-pan overlay
let panUIHandle = null;

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

    if (panUIHandle) { panUIHandle.destroy(); panUIHandle = null; }
}

export function enableInteraction(renderer, camera, controls) {
    const canvas = renderer.domElement;

    // Prevent default touch actions on canvas
    canvas.style.touchAction = 'none';

    // Install overlay arrows on top of canvas-panel
    const canvasPanel = document.getElementById('canvas-panel');
    if (!panUIHandle && canvasPanel) {
        panUIHandle = installPanArrows({ panelEl: canvasPanel, camera, controls, renderer, radiusFactor: 0.45 });

        if (AppState.model) panUIHandle.updateRoot(AppState.model);
        else if (AppState.skinMesh) panUIHandle.updateRoot(AppState.skinMesh);

        document.addEventListener('manikin:ready', (e) => {
            if (e?.detail?.root) panUIHandle.updateRoot(e.detail.root);
        });
    }

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

export function installPanArrows({ panelEl, camera, controls, renderer, radiusFactor = 0.45 }) {
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');

    if (getComputedStyle(panelEl).position === 'static') panelEl.style.position = 'relative';

    panelEl.appendChild(overlay);

    const mkBtn = (aria, direction) => {
        const b = document.createElement('button');
        b.setAttribute('aria-label', aria);
        b.className = 'button-pan';
        b.style.transform = 'translate(-50%, -50%)';

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '22');

        const chevron = document.createElementNS(svgNS, 'polyline');
        chevron.setAttribute('fill', 'none');
        chevron.setAttribute('stroke', 'currentColor');
        chevron.setAttribute('stroke-width', '2.5');
        chevron.setAttribute('stroke-linecap', 'round');
        chevron.setAttribute('stroke-linejoin', 'round');

        const pointsMap = {
            up:    '18 15 12 9 6 15',
            down:  '6 9 12 15 18 9',
            left:  '15 6 9 12 15 18',
            right: '9 6 15 12 9 18',
        };
        chevron.setAttribute('points', pointsMap[direction]);
        svg.appendChild(chevron);
        b.appendChild(svg);

        return b;
    };

    const btnUp = mkBtn('Pan up', 'up');
    const btnLeft = mkBtn('Pan left', 'left');
    const btnRight = mkBtn('Pan right', 'right');
    const btnDown = mkBtn('Pan down', 'down');

    overlay.append(btnUp, btnDown, btnLeft, btnRight);

    function setFixedPositions() {
        const panelRect  = panelEl.getBoundingClientRect();
        const canvasRect = renderer.domElement.getBoundingClientRect();

        const ox = canvasRect.left - panelRect.left;   // canvas offset within panel
        const oy = canvasRect.top  - panelRect.top;
        const cx = ox + canvasRect.width  / 2;
        const cy = oy + canvasRect.height / 2;
        const m  = 36; // margin from canvas edge (px).

        // top center (above head region)
        btnUp.style.left  = `${cx}px`;
        btnUp.style.top   = `${oy + m}px`;

        // bottom center (near feet)
        btnDown.style.left = `${cx}px`;
        btnDown.style.top  = `${oy + canvasRect.height - m}px`;

        // left middle (near left hand)
        btnLeft.style.left = `${ox + m}px`;
        btnLeft.style.top  = `${cy}px`;

        // right middle (near right hand)
        btnRight.style.left = `${ox + canvasRect.width - m}px`;
        btnRight.style.top  = `${cy}px`;
    }

    // Recompute only when layout changes
    const roPanel  = new ResizeObserver(setFixedPositions);
    const roCanvas = new ResizeObserver(setFixedPositions);
    roPanel.observe(panelEl);
    roCanvas.observe(renderer.domElement);

    // Call once now and again whenever you swap models
    setFixedPositions();
    
    // Pan Bounds (anchor + radius) 
    const bbox = new THREE.Box3();
    const sphere = new THREE.Sphere();
    const anchor = new THREE.Vector3();
    const offset = new THREE.Vector3();
    let maxPanRadius = 1;
    let rootObj = null;

    function updateRoot(root) {
        if (!root) return;
        rootObj = root;
        bbox.setFromObject(rootObj);
        bbox.getBoundingSphere(sphere);
        anchor.copy(sphere.center);
        maxPanRadius = Math.max(1e-6, radiusFactor * sphere.radius);

        // Sensible zoom limits for this model scale
        controls.minDistance = 0.6 * sphere.radius;
        controls.maxDistance = 2.5 * sphere.radius;

        camera.near = Math.min(0.02 * sphere.radius, 0.05);
        camera.updateProjectionMatrix();

        clampTarget();
        controls.update();
    }

    function clampTarget() {
        offset.copy(camera.position).sub(controls.target);
        const v = controls.target.clone().sub(anchor);
        const len = v.length();
        if (len > maxPanRadius) {
        v.setLength(maxPanRadius);
        controls.target.copy(anchor).add(v);
        camera.position.copy(controls.target).add(offset);
        }
    }

    // Pan in screen space by N “pixels”
    const tmp = new THREE.Vector3();
    function panByPixels(deltaX, deltaY) {
        if (AppState.isDrawing) return; // don’t pan while drawing

        const element = renderer.domElement;

        tmp.copy(camera.position).sub(controls.target);
        let targetDistance = tmp.length();
        targetDistance *= Math.tan((camera.fov * Math.PI / 180) / 2);

        const moveX = (2 * targetDistance * deltaX) / element.clientHeight;
        const moveY = -(2 * targetDistance * deltaY) / element.clientHeight;

        const viewDir = tmp.normalize(); // from target -> camera
        const camRight = new THREE.Vector3().crossVectors(camera.up, viewDir).normalize();
        const camUp = new THREE.Vector3().copy(camera.up).normalize();

        const pan = new THREE.Vector3()
        .addScaledVector(camRight, moveX)
        .addScaledVector(camUp, moveY);

        controls.target.add(pan);
        camera.position.add(pan);

        clampTarget();
        controls.update();
    }

    // Hold-to-pan
    function attachHold(btn, dx, dy) {
        let raf = 0;
        const stepPx = 24;
        const tick = () => { panByPixels(dx * stepPx, dy * stepPx); raf = requestAnimationFrame(tick); };
        const start = (e) => { e.preventDefault(); if (!raf) tick(); };
        const stop  = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

        btn.addEventListener('pointerdown', start);
        window.addEventListener('pointerup', stop);
        btn.addEventListener('pointerleave', stop);
        btn.addEventListener('pointercancel', stop);

        // Single nudge
        btn.addEventListener('click', (e) => { e.preventDefault(); panByPixels(dx * stepPx, dy * stepPx); });
    }

    attachHold(btnUp, 0, -1);
    attachHold(btnDown, 0, 1);
    attachHold(btnLeft, -1, 0);
    attachHold(btnRight, 1, 0);

    return {
        updateRoot,
        destroy() {
            roPanel.disconnect();
            roCanvas.disconnect();
            overlay.remove();
        }
    };
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
    const clientX = event.clientX;
    const clientY = event.clientY;

    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function handlePointerDown(camera, controls) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(AppState.skinMesh, true);

    if (intersects.length > 0) {
        AppState.isDrawing = true;
        pointerDown = true;
        controls.enabled = false;

        drawAtPointer(camera, pointer, AppState.isErasing);
    }
}