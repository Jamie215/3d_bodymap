import AppState from './state.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function enableInteraction(renderer, camera, controls, statusIndicator) {
    renderer.domElement.addEventListener('mousedown', (event) => {
        if (!AppState.model || event.target !== renderer.domElement) return;

        updateMouse(event, renderer);
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(AppState.model, true);
        if (intersects.length > 0) {
            AppState.isDrawing = true;
            controls.enabled = false;
            statusIndicator.textContent = AppState.isErasing ? 'Erasing...' : 'Drawing...';
        }
    });

    window.addEventListener('mouseup', () => {
        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            controls.enabled = true;
            statusIndicator.textContent = AppState.isErasing ? 'Mode: Erasing' : 'Mode: Drawing';
        }
    });

    window.addEventListener('mousemove', (event) => {
        if (!AppState.isDrawing || !AppState.skinMesh || event.target !== renderer.domElement) return;

        updateMouse(event, renderer);
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(AppState.skinMesh, true);
        if (intersects.length === 0) return;

        const uv = intersects[0].uv;
        if (!uv) return;

        const { canvas, context, texture } = AppState.skinMesh.userData;
        const x = Math.floor(uv.x * canvas.width);
        const y = Math.floor((1 - uv.y) * canvas.height);

        context.beginPath();
        context.arc(x, y, AppState.brushRadius, 0, 2 * Math.PI);
        context.fillStyle = AppState.isErasing ? '#ffffff' : '#9575CD';
        context.fill();
        texture.needsUpdate = true;
    });

    renderer.domElement.addEventListener('dblclick', (event) => {
        if (!AppState.model) return;

        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
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
            statusIndicator.textContent = 'Zoomed to selection';
        }
    });
}

function updateMouse(event, renderer) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}
