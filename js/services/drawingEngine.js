// drawingEngine.js
import AppState from '../app/state.js';
import texturePool from '../utils/textureManager.js'

const raycaster = new THREE.Raycaster();

export function drawAtUV(uv, canvas, context, radius, isErasing = false) { 
    const x = Math.floor(uv.x * canvas.width);
    const y = Math.floor((1 - uv.y) * canvas.height);

    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = isErasing ? '#ffffff' : '#9575CD';
    context.fill();
 }

export function drawAtPointer(camera, pointer, isErasing = false) { 
    if (!AppState.skinMesh) return;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(AppState.skinMesh, true);
    if (intersects.length === 0) return;

    const currentHit = intersects[0];
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    const { canvas, context, texture } = currentInstance;

    drawAtUV(currentHit.uv, canvas, context, AppState.brushRadius, isErasing);
    handleMirroredDrawing(currentHit, AppState.brushRadius, isErasing);

    if (!isErasing) {
        updateBoneMapFromHit(currentHit, currentInstance);
    } else {
        eraseFromBoneMap(currentHit, currentInstance, AppState.brushRadius);
    }

    texture.needsUpdate = true;
}

function handleMirroredDrawing(hit, radius, isErasing) { 
    const point = hit.point;
    if (Math.abs(point.x) >= 0.0075) return;

    const mirroredOrigin = raycaster.ray.origin.clone().multiply(new THREE.Vector3(-1, 1, 1));
    const mirroredDir = raycaster.ray.direction.clone().multiply(new THREE.Vector3(-1, 1, 1));

    raycaster.set(mirroredOrigin, mirroredDir);
    const mirroredHits = raycaster.intersectObject(AppState.skinMesh, true);

    if (mirroredHits.length > 0 && mirroredHits[0].uv) {
        const instance = AppState.drawingInstances[AppState.currentDrawingIndex];
        drawAtUV(mirroredHits[0].uv, instance.canvas, instance.context, radius / 2, isErasing);
    }
 }

function updateBoneMapFromHit(hit, instance) {
    const boneNames = detectBonesFromFace(hit.faceIndex);
    const x = Math.round(hit.uv.x * instance.canvas.width);
    const y = Math.round((1 - hit.uv.y) * instance.canvas.height);
    const key = `${x},${y}`;

    for (const name of boneNames) {
        instance.drawnBoneNames.add(name);
        if (!instance.bonePixelMap[name]) instance.bonePixelMap[name] = new Set();
        instance.bonePixelMap[name].add(key);
    }
}

function eraseFromBoneMap(hit, instance, radius) {
    const boneNames = detectBonesFromFace(hit.faceIndex);
    const x = Math.round(hit.uv.x * instance.canvas.width);
    const y = Math.round((1 - hit.uv.y) * instance.canvas.height);

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            if (dx * dx + dy * dy > radius * radius) continue;

            const px = x + dx;
            const py = y + dy;
            if (px < 0 || py < 0 || px >= instance.canvas.width || py >= instance.canvas.height) continue;

            const eraseKey = `${px},${py}`;
            for (const name of boneNames) {
                const pixelSet = instance.bonePixelMap[name];
                if (pixelSet) {
                    pixelSet.delete(eraseKey);
                    if (pixelSet.size === 0) {
                        delete instance.bonePixelMap[name];
                        instance.drawnBoneNames.delete(name);
                    }
                }
            }
        }
    }
}

export function detectBonesFromFace(faceIndex) {
    const geometry = AppState.skinMesh.geometry;
    const indexAttr = geometry.index;
    const skinIndex = geometry.attributes.skinIndex;
    const skinWeight = geometry.attributes.skinWeight;

    const a = indexAttr.getX(faceIndex * 3);
    const b = indexAttr.getX(faceIndex * 3 + 1);
    const c = indexAttr.getX(faceIndex * 3 + 2);

    return [a, b, c].map(i => {
    const indices = [
      skinIndex.getX(i), skinIndex.getY(i),
      skinIndex.getZ(i), skinIndex.getW(i)
    ];
    const weights = [
      skinWeight.getX(i), skinWeight.getY(i),
      skinWeight.getZ(i), skinWeight.getW(i)
    ];
    const maxIndex = weights.indexOf(Math.max(...weights));
    return AppState.skinMesh.skeleton.bones[indices[maxIndex]]?.name;
  }).filter(Boolean);
}

export function clearCurrentDrawing() { 
    const instance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if (!instance) return;

    const { context, canvas, texture } = instance;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    instance.drawnBoneNames.clear();
    instance.bonePixelMap = {};
    instance.questionnaireData = null;
    texture.needsUpdate = true;
}

export function addNewDrawingInstance() {
    const instanceId = `drawing-${AppState.drawingInstances.length + 1}`;
    const textureBundle = texturePool.getNewTexture(instanceId);

    const newInstance = {
        id: instanceId,
        canvas: textureBundle.canvas,
        context: textureBundle.context,
        texture: textureBundle.texture,
        drawnBoneNames: new Set(),
        bonePixelMap: {},
        questionnaireData: null,
        uvDrawingData: null
    };

    // Store the new instance in AppState
    AppState.drawingInstances.push(newInstance);
    AppState.currentDrawingIndex = AppState.drawingInstances.length - 1;
    updateCurrentDrawing();
}

export function isDrawingBlank() {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if(!currentInstance || !currentInstance.canvas) return true;

    const ctx = currentInstance.context;
    const { width, height } = currentInstance.canvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;

    // Check if all pixels are white (or nearly white)
    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        // If anything isn't fully white/transparent
        if (!(r === 255 && g === 255 && b === 255 && a === 255)) {
            return false; // Non-blank pixel found
        }
    }
    return true;
}

export function updateCurrentDrawing() {
    // Update the current drawing instance
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if (!currentInstance || !AppState.skinMesh || !AppState.skinMesh.material) return;

    const material = AppState.skinMesh.material;
    if (!material) {
        console.warn("SkinMesh.material is not ready.");
        return;
    }

    AppState.skinMesh.userData.canvas = currentInstance.canvas;
    AppState.skinMesh.userData.context = currentInstance.context;
    AppState.skinMesh.userData.texture = currentInstance.texture;

    material.map = currentInstance.texture;
    material.needsUpdate = true;
    currentInstance.texture.needsUpdate = true;

    const pixelMap = currentInstance.bonePixelMap;
    currentInstance.drawnBoneNames = new Set(
        Object.keys(pixelMap).filter(bone => pixelMap[bone].size > 0)
    );

    const statusBar = document.getElementById('drawing-status-bar');
    if (statusBar) {
        const current = AppState.currentDrawingIndex + 1;
        statusBar.textContent = `Add Your Main Area of Pain or Symptom #${current}`;
    }
}