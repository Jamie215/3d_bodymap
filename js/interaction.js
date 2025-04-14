import AppState from './state.js';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

export function enableInteraction(renderer, camera, controls) {
    const canvas = renderer.domElement;

    // Prevent default touch actions on canvas
    canvas.style.touchAction = 'none';
    
    // Mouse-based interaction
    canvas.addEventListener('mousedown', (event) => {
        if (!AppState.model || event.target !== canvas) return;

        updatePointer(event, canvas);
        handlePointerDown(camera, controls);
    });

    window.addEventListener('mouseup', () => {
        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            controls.enabled = true;
        }
    });

    window.addEventListener('mousemove', (event) => {
        if (!AppState.isDrawing || !AppState.skinMesh || event.target !== canvas) return;

        updatePointer(event, canvas);
        drawAtPointer(camera);
    });

    canvas.addEventListener('dblclick', (event) => {
        if (!AppState.model) return;

        handleDoubleTap(event, canvas, camera, controls);
    });

    // Touch-based Interaction
    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();

        if (!AppState.model) return;
        
        updatePointer(event, canvas);
        handlePointerDown(camera, controls);
    }, {passive: false});

    canvas.addEventListener('touchend', () => {
        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            controls.enabled = true;
        }
    });
    
    canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();

        if(!AppState.isDrawing || !AppState.skinMesh) return;

        updatePointer(event, canvas);
        drawAtPointer(camera);
    }, {passive: false});

    let lastTapTime = 0;

    canvas.addEventListener('touchend', (event) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;

        if (tapLength < 300 && tapLength > 0) {
            handleDoubleTap(event, canvas, camera, controls);
        }

        lastTapTime = currentTime;
    });
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
    const intersects = raycaster.intersectObject(AppState.model, true);

    if (intersects.length > 0) {
        AppState.isDrawing = true;
        controls.enabled = false;
    }
}

function drawAtPointer(camera) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(AppState.skinMesh, true);
    if (intersects.length === 0) return;

    const uv = intersects[0].uv;
    if (!uv) return;

    const {canvas, context, texture } = AppState.skinMesh.userData;
    const x = Math.floor(uv.x * canvas.width);
    const y = Math.floor((1 -uv.y) * canvas.height);

    context.beginPath();
    context.arc(x, y, AppState.brushRadius, 0, 2*Math.PI);
    context.fillStyle = AppState.isErasing ? '#ffffff' : '#9575CD';
    context.fill();
    texture.needsUpdate = true;
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
    const intersects = localRay.intersectObject(AppState.model, true);

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
