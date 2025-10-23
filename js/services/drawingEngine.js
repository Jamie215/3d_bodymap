// drawingEngine.js
import AppState from '../app/state.js';
import texturePool from '../utils/textureManager.js'

const raycaster = new THREE.Raycaster();
const mirroredRaycaster = new THREE.Raycaster();

const colourPalette = d3.schemeObservable10;

let idToRegionMap = null;
let regionToIdMap = null;

// Load region-to-ID mappings to AppState
export async function initializeRegionMappings() {
    try {
        const response = await fetch('../../assets/region_id_mapping.json');
        const mappingData = await response.json();

        idToRegionMap = {};
        for (const [id, region] of Object.entries(mappingData.id_to_region)) {
            idToRegionMap[parseInt(id)] = region;
        }
        
        regionToIdMap = mappingData.region_to_id;

        AppState.regionToIdMap = regionToIdMap;
        AppState.idToRegionMap = idToRegionMap;
        
    } catch (error) {
        console.error("Failed to load vertex group mappings", error);
        idToRegionMap = { 0 : "unassigned" };
        regionToIdMap = {};
    }
}

// Get the regionID for a specific vertex
function getVertexRegion(regionIDAttr, vertexIndex) {
    const regionID = regionIDAttr.getX(vertexIndex);
    return idToRegionMap[regionID] || null;
}

// Determine which anatomical region a 3D face belongs to
function getDominantRegionForFace(regionIDAttr, vertexA, vertexB, vertexC) {
    const regionA = getVertexRegion(regionIDAttr, vertexA);
    const regionB = getVertexRegion(regionIDAttr, vertexB);
    const regionC = getVertexRegion(regionIDAttr, vertexC);

    // Filter out null/unassigned
    const regions = [regionA, regionB, regionC].filter(r => r && r !== "unassigned");
    
    if (regions.length === 0) return null;
    
    // Count occurrences
    const counts = {};
    regions.forEach(region => {
        counts[region] = (counts[region] || 0) + 1;
    });
    
    // Return most common
    return Object.keys(counts).reduce((a, b) => 
        counts[a] > counts[b] ? a : b
    );
}

// Create mapping between UV texture coordinates and anatomical regions
export function buildGlobalUVMap(geometry, canvasWidth, canvasHeight) {
    const indexAttr = geometry.index;
    const uvAttr = geometry.attributes.uv;
    const regionIDAttr = geometry.attributes._regionid;

    if (!regionIDAttr) {
        console.error("No regionID attribute available to identify location");
    }

    const faceCount = indexAttr.count / 3;
    const globalUVMap = new Map(); // track which pixels can be drawn on
    const globalPixelRegionMap = new Map(); // tracks which body part each UV pixel belongs
    const faceRegionMap = new Map(); // tracks the dominant anatomical region for each 3D face of the mesh

    for (let faceIdx = 0; faceIdx < faceCount; faceIdx++) {
        const a = indexAttr.getX(faceIdx * 3);
        const b = indexAttr.getX(faceIdx * 3 + 1);
        const c = indexAttr.getX(faceIdx * 3 + 2);

        const uvA = uvToPixel(uvAttr, a, canvasWidth, canvasHeight);
        const uvB = uvToPixel(uvAttr, b, canvasWidth, canvasHeight);
        const uvC = uvToPixel(uvAttr, c, canvasWidth, canvasHeight);

        // Determine the dominant region for this face
        const dominantRegion = getDominantRegionForFace(regionIDAttr, a, b, c);
        faceRegionMap.set(faceIdx, dominantRegion);
        rasterizeTriangle(uvA, uvB, uvC, canvasWidth, canvasHeight, globalUVMap, globalPixelRegionMap, dominantRegion);
    }

    return {globalUVMap, globalPixelRegionMap, faceRegionMap};
}

// Convert UV coordinates to pixel coordinates
function uvToPixel(uvAttr, vertexIndex, canvasWidth, canvasHeight) {
    const u = uvAttr.getX(vertexIndex);
    const v = uvAttr.getY(vertexIndex);
    const x = Math.floor(u * canvasWidth);
    const y = Math.floor((1 - v) * canvasHeight);
    return { x, y };
}

// Fill traingle area in UV space with region data
function rasterizeTriangle(p0, p1, p2, canvasWidth, canvasHeight, globalUVMap, globalPixelRegionMap, dominantRegion) {
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
                        globalPixelRegionMap.set(key, dominantRegion);
                    }
                }
            }
        }
    }
}

// Check if the point is in a triangle
function pointInTriangle(p, a, b, c) {
    const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
    const s = (1 / (2 * area)) * (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y);
    const t = (1 / (2 * area)) * (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y);
    const u = 1 - s - t;
    return s >= 0 && t >= 0 && u >= 0;
}

// Draw or erase a specific UV coordinate
export function drawAtUV(uv, canvas, context, radius, isErasing=false, hitRegion=null) { 
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

    // Check if the center pixel exists
    for (let dx = -10; dx <= 10; dx++) {
        for (let dy = -10; dy <= 10; dy++) {
            const testKey = `${cx + dx},${cy + dy}`;
            if (AppState.globalUVMap.has(testKey)) {
                break;
            }
        }
    }

    for (let py = 0; py < canvas.height; py++) {
        for (let px = 0; px < canvas.width; px++) {
            const offset = (py * canvas.width + px) * 4;
            const alpha = maskPixels[offset + 3];
            if (alpha === 0) continue;

            const key = `${px},${py}`;
            if (!AppState.globalUVMap.has(key)) {
                console.warn("Not within globalUVMap");
                continue;
            }
            if (isErasing && baseCtx) {
                const basePixel = baseCtx.getImageData(px, py, 1, 1).data;
                context.fillStyle = `rgba(${basePixel[0]},${basePixel[1]},${basePixel[2]},${basePixel[3] / 255})`;
            }
            context.fillRect(px, py, 1, 1);    // Draw the pixel if it's within the mask and in the correct area.
        }
    }
 }

// Main drawing function
export function drawAtPointer(camera, pointer, isErasing = false) { 
    if (!AppState.skinMesh) {
        console.warn("Doesn't have a skinmesh");
        return;
    }

    AppState.skinMesh.updateMatrixWorld(true);
    
    // Update raycaster with current camera parameters
    raycaster.setFromCamera(pointer, camera);
    raycaster.near = camera.near;
    raycaster.far = camera.far;

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
            mirroredRaycaster.near = camera.near;
            mirroredRaycaster.far = camera.far;

            const mirroredHits = mirroredRaycaster.intersectObject(AppState.skinMesh, true);
            if (mirroredHits.length > 0) {
                processHit(mirroredHits[0], isErasing);
            }
        }
    }
}

// Process a raycast hit to draw/erase on texture
function processHit(hit, isErasing) {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    const { canvas, context, texture } = currentInstance;

    // Determine the dominant vertex group for this hit
    const hitRegion = AppState.faceRegionMap?.get(hit.faceIndex) || null;
    // console.log(`Hit face ${hit.faceIndex} → region: ${hitRegion}`);

    drawAtUV(hit.uv, canvas, context, AppState.brushRadius, isErasing, hitRegion);

    if (!isErasing) {
        updateRegionMapFromHit(hit, currentInstance, hitRegion);
    } else {
        eraseFromRegionMap(hit, currentInstance, AppState.brushRadius, hitRegion);
    }

    texture.needsUpdate = true;
}

// Track which regions have been drawn on
function updateRegionMapFromHit(hit, instance, regionName) {
    const x = Math.round(hit.uv.x * instance.canvas.width);
    const y = Math.round((1 - hit.uv.y) * instance.canvas.height);
    const key = `${x},${y}`;

    // Track drawn regions
    instance.drawnRegionNames = instance.drawnRegionNames || new Set();
    instance.drawnRegionNames.add(regionName);

    // Track pixels per region
    if(!instance.regionPixelMap) instance.regionPixelMap = {};
    if (!instance.regionPixelMap[regionName]) {
        instance.regionPixelMap[regionName] = new Set();
    }
    instance.regionPixelMap[regionName].add(key);
}

// Remove pixel from region tracking when erasing
function eraseFromRegionMap(hit, instance, radius, regionName) {
    const x = Math.round(hit.uv.x * instance.canvas.width);
    const y = Math.round((1 - hit.uv.y) * instance.canvas.height);

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            if (dx * dx + dy * dy > radius * radius) continue;

            const px = x + dx;
            const py = y + dy;
            if (px < 0 || py < 0 || px >= instance.canvas.width || py >= instance.canvas.height) continue;

            const eraseKey = `${px},${py}`;
            const pixelSet = instance.regionPixelMap?.[regionName];
            if (pixelSet) {
                pixelSet.delete(eraseKey);
                if (pixelSet.size === 0) {
                    delete instance.regionPixelMap[regionName];
                    instance.drawnRegionNames.delete(regionName);
                }
            }
        }
    }
}

// Update painting colors for drawing instances
export function updateInstanceColors() {
    AppState.drawingInstances.forEach((instance, index) => {
        const newColor = colourPalette[index % colourPalette.length];
        
        // Special case for 10th color (index 9)
        if (index % colourPalette.length === 9) {
            instance.colour = '#333399';
        } else {
            instance.colour = newColor;
        }

        redrawInstanceWithNewColor(instance);
    });
}

// 
function redrawInstanceWithNewColor(instance) {
    const { canvas, context, colour } = instance;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Parse the new color
    const newColor = hexToRgb(colour);
    
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        // If pixel is not white (i.e., it's part of the drawing)
        if (!(r === 255 && g === 255 && b === 255 && a === 255)) {
            // Check if it's not the base texture (you may need to adjust this logic)
            // For now, we'll replace any non-white pixel with the new color
            if (a > 0 && !(r === 255 && g === 255 && b === 255)) {
                pixels[i] = newColor.r;
                pixels[i + 1] = newColor.g;
                pixels[i + 2] = newColor.b;
                // Keep the same alpha
            }
        }
    }
    
    context.putImageData(imageData, 0, 0);
    instance.texture.needsUpdate = true;
}

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

export function addNewDrawingInstance() {
    const instanceId = `drawing-${AppState.drawingInstances.length + 1}`;
    const textureBundle = texturePool.getNewTexture(instanceId);

    const newInstance = {
        id: instanceId,
        canvas: textureBundle.canvas,
        context: textureBundle.context,
        texture: textureBundle.texture,
        drawnRegionNames: new Set(),
        regionPixelMap: {},
        questionnaireData: null,
        uvDrawingData: null,
        colour: colourPalette[AppState.drawingInstances.length % colourPalette.length],
        initialized: false // boolean for whether or not the drawingView has come from surveyView
    };

    // Change the 10th colour from the colourPalette
    if (AppState.drawingInstances.length % colourPalette.length === 9) {
        newInstance.colour = '#333399';
    }

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

    const pixelMap = currentInstance.regionPixelMap;
    currentInstance.drawnRegionNames = new Set(
        Object.keys(pixelMap).filter(group => pixelMap[group].size > 0)
    );
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