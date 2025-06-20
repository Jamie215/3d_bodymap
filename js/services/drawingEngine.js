// drawingEngine.js
import AppState from '../app/state.js';
import texturePool from '../utils/textureManager.js'

const raycaster = new THREE.Raycaster();
const mirroredRaycaster = new THREE.Raycaster();

const colourPalette = d3.schemeObservable10;

export function buildGlobalUVMap(geometry, canvasWidth, canvasHeight) {
    const indexAttr = geometry.index;
    const uvAttr = geometry.attributes.uv;
    const skinIndex = geometry.attributes.skinIndex;
    const skinWeight = geometry.attributes.skinWeight;
    const bones = AppState.skinMesh.skeleton.bones;
    const faceCount = indexAttr.count / 3;

    const globalUVMap = new Map();
    const globalPixelBoneMap = new Map();
    const faceBoneMap = new Map();

    for (let faceIdx = 0; faceIdx < faceCount; faceIdx++) {
        const a = indexAttr.getX(faceIdx * 3);
        const b = indexAttr.getX(faceIdx * 3 + 1);
        const c = indexAttr.getX(faceIdx * 3 + 2);

        const uvA = uvToPixel(uvAttr, a, canvasWidth, canvasHeight);
        const uvB = uvToPixel(uvAttr, b, canvasWidth, canvasHeight);
        const uvC = uvToPixel(uvAttr, c, canvasWidth, canvasHeight);

        // Determine the dominant bone for this face
        const dominantBone = getDominantBoneForVertex(a, skinIndex, skinWeight, bones);
        faceBoneMap.set(faceIdx, dominantBone);

        rasterizeTriangle(uvA, uvB, uvC, canvasWidth, canvasHeight, globalUVMap, globalPixelBoneMap, dominantBone);
    }

    return {globalUVMap, globalPixelBoneMap, faceBoneMap};
}

function getDominantBoneForVertex(vertexIndex, skinIndex, skinWeight, bones) {
    const boneIndices = [
        skinIndex.getX(vertexIndex),
        skinIndex.getY(vertexIndex),
        skinIndex.getZ(vertexIndex),
        skinIndex.getW(vertexIndex)
    ];
    const weights = [
        skinWeight.getX(vertexIndex),
        skinWeight.getY(vertexIndex),
        skinWeight.getZ(vertexIndex),
        skinWeight.getW(vertexIndex)
    ];
    const maxIndex = weights.indexOf(Math.max(...weights));
    return bones[boneIndices[maxIndex]].name;
}


function uvToPixel(uvAttr, vertexIndex, canvasWidth, canvasHeight) {
    const u = uvAttr.getX(vertexIndex);
    const v = uvAttr.getY(vertexIndex);
    const x = Math.floor(u * canvasWidth);
    const y = Math.floor((1 - v) * canvasHeight);
    return { x, y };
}

function rasterizeTriangle(p0, p1, p2, canvasWidth, canvasHeight, globalUVMap, globalPixelBoneMap, dominantBone) {
    const minX = Math.max(0, Math.min(p0.x, p1.x, p2.x));
    const maxX = Math.min(canvasWidth - 1, Math.max(p0.x, p1.x, p2.x));
    const minY = Math.max(0, Math.min(p0.y, p1.y, p2.y));
    const maxY = Math.min(canvasHeight - 1, Math.max(p0.y, p1.y, p2.y));

    // Dilation amount for smoothing drawing near the seam edge
    const dilation = 1;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (pointInTriangle({ x, y }, p0, p1, p2)) {
                for (let dy = -dilation; dy <= dilation; dy++) {
                    for (let dx = -dilation; dx <= dilation; dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        if (px < 0 || py < 0 || px >= canvasWidth || py >= canvasHeight) continue;
                        const key = `${px},${py}`;
                        globalUVMap.set(key, true);
                        globalPixelBoneMap.set(key, dominantBone);
                    }
                }
            }
        }
    }
}

function pointInTriangle(p, a, b, c) {
    const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
    const s = (1 / (2 * area)) * (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y);
    const t = (1 / (2 * area)) * (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y);
    const u = 1 - s - t;
    return s >= 0 && t >= 0 && u >= 0;
}

export function drawAtUV(uv, canvas, context, radius, isErasing = false, hitBone = null) { 
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    const cx = Math.floor(uv.x * canvas.width);
    const cy = Math.floor((1 - uv.y) * canvas.height);

    // Create offscreen mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');

    // Draw smooth circular brush onto mask
    maskCtx.fillStyle = '#000';
    maskCtx.beginPath();
    maskCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
    maskCtx.fill();

    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    const maskPixels = maskData.data;

    const baseCtx = AppState.baseTextureContext;

    if (!isErasing) {
        context.fillStyle = currentInstance.colour;
    }

    for (let py = 0; py < canvas.height; py++) {
        for (let px = 0; px < canvas.width; px++) {
            const offset = (py * canvas.width + px) * 4;
            const alpha = maskPixels[offset + 3];
            if (alpha === 0) continue;

            const key = `${px},${py}`;
            if (!AppState.globalUVMap.has(key)) continue;
            if (hitBone && AppState.globalPixelBoneMap.get(key) !== hitBone) continue;
            
            if (isErasing && baseCtx) {
                const basePixel = baseCtx.getImageData(px, py, 1, 1).data;
                context.fillStyle = `rgba(${basePixel[0]},${basePixel[1]},${basePixel[2]},${basePixel[3] / 255})`;
            }
            context.fillRect(px, py, 1, 1);    // Draw the pixel if it's within the mask and in the correct bone area.
        }
    }
 }

export function drawAtPointer(camera, pointer, isErasing = false) { 
    if (!AppState.skinMesh) return;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(AppState.skinMesh, true);
    if (intersects.length > 0) {
        const hit = intersects[0];
        processHit(hit, isErasing);

        const distanceFromCenter = Math.abs(hit.point.x);
        const seamThreshold = 0.0075;

        if (distanceFromCenter <= seamThreshold) {
            const mirroredOrigin = raycaster.ray.origin.clone().multiply(new THREE.Vector3(-1, 1, 1));
            const mirroredDir = raycaster.ray.direction.clone().multiply(new THREE.Vector3(-1, 1, 1));

            mirroredRaycaster.set(mirroredOrigin, mirroredDir);
            const mirroredHits = mirroredRaycaster.intersectObject(AppState.skinMesh, true);
            if (mirroredHits.length > 0) {
                processHit(mirroredHits[0], isErasing);
            }
        }
    }
}

function processHit(hit, isErasing) {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    const { canvas, context, texture } = currentInstance;

    // Determine the dominant bone for this hit
    const hitBone = AppState.faceBoneMap.get(hit.faceIndex);

    drawAtUV(hit.uv, canvas, context, AppState.brushRadius, isErasing, hitBone);

    if (!isErasing) {
        updateBoneMapFromHit(hit, currentInstance);
    } else {
        eraseFromBoneMap(hit, currentInstance, AppState.brushRadius);
    }

    texture.needsUpdate = true;
}

function updateBoneMapFromHit(hit, instance) {
    const boneNames = [AppState.faceBoneMap.get(hit.faceIndex)];
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
    const boneNames = [AppState.faceBoneMap.get(hit.faceIndex)];
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
        uvDrawingData: null,
        colour: colourPalette[AppState.drawingInstances.length % colourPalette.length],
        initialized: false // boolean for whether or not the drawingView has come from surveyView
    };

    // Overlay persistent base drawing
    if (AppState.baseTextureCanvas) {
        const snapshot = document.createElement('canvas');
        snapshot.width = AppState.baseTextureCanvas.width;
        snapshot.height = AppState.baseTextureCanvas.height;
        snapshot.getContext('2d').drawImage(AppState.baseTextureCanvas, 0, 0);
        newInstance.context.drawImage(snapshot, 0, 0);
    }

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
        statusBar.innerHTML = `Add Your ${current}${getOrdinal(current)} Main Area of Pain or Symptom`;
    }
}

function getOrdinal(n) {
  let ord = 'th';

  if (n % 10 == 1 && n % 100 != 11)
  {
    ord = 'st';
  }
  else if (n % 10 == 2 && n % 100 != 12)
  {
    ord = 'nd';
  }
  else if (n % 10 == 3 && n % 100 != 13)
  {
    ord = 'rd';
  }

  return ord;
}