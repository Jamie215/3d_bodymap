import AppState from './state.js';
import eventManager from './eventManager.js';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const eventIds = [];

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
        if (!AppState.model || event.target !== canvas) return;
        updatePointer(event, canvas);
        handlePointerDown(camera, controls);
    }));

    eventIds.push(eventManager.add(window, 'mouseup', () => {
        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            controls.enabled = true;
        }
    }));

    
    eventIds.push(eventManager.add(window, 'mousemove', (event) => {
        if (!AppState.isDrawing || !AppState.skinMesh || event.target !== canvas) return;
        updatePointer(event, canvas);
        drawAtPointer(camera);
    }));

    eventIds.push(eventManager.add(canvas, 'dblclick', (event) => {
        if (!AppState.model) return;
        handleDoubleTap(event, canvas, camera, controls);
    }));

    // Touch-based Interaction
    eventIds.push(eventManager.add(canvas, 'touchstart', (event) => {
        event.preventDefault();
        if (!AppState.model) return;
        updatePointer(event, canvas);
        handlePointerDown(camera, controls);
    }, {passive: false}));

    eventIds.push(eventManager.add(canvas, 'touchend', () => {
        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            controls.enabled = true;
        }
    }));
    
    eventIds.push(eventManager.add(canvas, 'touchmove', (event) => {
        event.preventDefault();
        if(!AppState.isDrawing || !AppState.skinMesh) return;
        updatePointer(event, canvas);
        drawAtPointer(camera);
    }, {passive: false}));

    let lastTapTime = 0;

    eventIds.push(eventManager.add(canvas, 'touchend', (event) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
            handleDoubleTap(event, canvas, camera, controls);
        }
        lastTapTime = currentTime;
    }));
}

export function setupCursorManagement(renderer) {
    const canvasPanel = document.getElementById('canvas-panel');
    
    if (!canvasPanel) return;
    
    // Create container for cursor elements
    const cursorContainer = document.createElement('div');
    cursorContainer.classList.add('cursor-container');
    cursorContainer.style.position = 'absolute';
    cursorContainer.style.pointerEvents = 'none';
    cursorContainer.style.zIndex = '9999';
    cursorContainer.style.transform = 'translate(-50%, -50%)';
    cursorContainer.style.display = 'none';
    cursorContainer.style.width = '40px';
    cursorContainer.style.height = '40px';
    document.body.appendChild(cursorContainer);
    
    // Create size indicator circle
    const sizeCircle = document.createElement('div');
    sizeCircle.classList.add('cursor-size');
    sizeCircle.style.position = 'absolute';
    sizeCircle.style.borderRadius = '50%';
    sizeCircle.style.transition = 'width 0.2s, height 0.2s, background-color 0.2s';
    sizeCircle.style.top = '50%';
    sizeCircle.style.left = '50%';
    sizeCircle.style.transform = 'translate(-50%, -50%)';
    cursorContainer.appendChild(sizeCircle);
    
    // Create tool icon element
    const toolIcon = document.createElement('div');
    toolIcon.classList.add('cursor-icon');
    toolIcon.style.position = 'absolute';
    toolIcon.style.top = '50%';
    toolIcon.style.left = '50%';
    toolIcon.style.transform = 'translate(-50%, -50%)';
    toolIcon.style.width = '18px';
    toolIcon.style.height = '18px';
    toolIcon.style.overflow = 'visible';
    toolIcon.style.display = 'flex';
    toolIcon.style.alignItems = 'center';
    toolIcon.style.justifyContent = 'center'
    cursorContainer.appendChild(toolIcon);
    
    // Hide default cursor over canvas
    canvasPanel.style.cursor = 'none';
    
    // Create SVG icons as data URLs
    const getDrawIconSvg = (color) => `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
        </svg>
    `;
    
    const getEraseIconSvg = (color) => `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
            <path d="M22 21H7"></path>
            <path d="m5 11 9 9"></path>
        </svg>
    `;

    const updateToolIcon = (svg) => {
        toolIcon.innerHTML = svg;
    };

    const drawColor = '#0277BD';
    const eraseColor = '#FF5252';
    
    // Update cursor position and appearance
    canvasPanel.addEventListener('mousemove', (e) => {
        // Show cursor container
        cursorContainer.style.display = 'block';
        
        // Update position
        cursorContainer.style.left = `${e.clientX}px`;
        cursorContainer.style.top = `${e.clientY}px`;
        
        // Update size based on brush radius
        const size = AppState.brushRadius * 2;
        sizeCircle.style.width = `${size}px`;
        sizeCircle.style.height = `${size}px`;

        const iconOffset = { x: 0, y: -15 }; // Customize these values to your preference
        toolIcon.style.transform = `translate(${iconOffset.x}px, ${iconOffset.y}px)`;
        
        // Update color and icon based on mode
        if (AppState.isErasing) {
            sizeCircle.style.border = `2px solid ${eraseColor}`;
            sizeCircle.style.backgroundColor = `rgba(255, 82, 82, 0.1)`;
            
            // Only update the icon if it's changed to avoid DOM manipulation on every move
            if (!toolIcon.dataset.currentTool || toolIcon.dataset.currentTool !== 'erase') {
            updateToolIcon(getEraseIconSvg(eraseColor));
            toolIcon.dataset.currentTool = 'erase';
            }
        } else {
            sizeCircle.style.border = `2px solid ${drawColor}`;
            sizeCircle.style.backgroundColor = `rgba(2, 119, 189, 0.1)`;
            
            if (!toolIcon.dataset.currentTool || toolIcon.dataset.currentTool !== 'draw') {
            updateToolIcon(getDrawIconSvg(drawColor));
            toolIcon.dataset.currentTool = 'draw';
            }
        }
    });

    // Hide cursor when leaving canvas
    canvasPanel.addEventListener('mouseleave', () => {
        cursorContainer.style.display = 'none';
    });

    // Update cursor size when brush size changes
    const brushSizeSlider = document.querySelector('.vertical-slider');
    if (brushSizeSlider) {
        brushSizeSlider.addEventListener('input', () => {
        const size = AppState.brushRadius * 2;
            sizeCircle.style.width = `${size}px`;
            sizeCircle.style.height = `${size}px`;
        });
    }

    // Update cursor when switching tools
    const drawButton = document.querySelector('.button-primary');
    const eraseButton = document.querySelector('.button-secondary');
    
    if (drawButton) {
        drawButton.addEventListener('click', () => {
            updateToolIcon(getDrawIconSvg(drawColor));
            toolIcon.dataset.currentTool = 'draw';
            sizeCircle.style.border = `2px solid ${drawColor}`;
            sizeCircle.style.backgroundColor = `rgba(2, 119, 189, 0.1)`;
        });
    }
    
    if (eraseButton) {
        eraseButton.addEventListener('click', () => {
            updateToolIcon(getEraseIconSvg(eraseColor));
            toolIcon.dataset.currentTool = 'erase';
            sizeCircle.style.border = `2px solid ${eraseColor}`;
            sizeCircle.style.backgroundColor = `rgba(255, 82, 82, 0.1)`;
        });
    }

    canvasPanel.addEventListener('mousedown', () => {
        if (AppState.isDrawing) {
          sizeCircle.style.opacity = '0.8';
        }
    });
      
    window.addEventListener('mouseup', () => {
        sizeCircle.style.opacity = '0.4';
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

        drawAtPointer(camera);
    }
}

function drawAtPointer(camera) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(AppState.skinMesh, true);
    if (intersects.length === 0) return;

    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    const { canvas, context, texture } = currentInstance
    const fillStyle = AppState.isErasing ? '#ffffff' : '#9575CD';
    context.fillStyle = fillStyle;

    const currentHit = intersects[0];
    const currentPoint = currentHit.point;

    drawBrushAtUV(currentHit.uv, canvas, context, AppState.brushRadius);

    AppState.previousHitPoint = currentPoint;

    // Handle mirroring across seam at the back
    const seamDistanceThreshold = 0.0075;
    if (Math.abs(currentPoint.x) < seamDistanceThreshold) {
        const mirroredOrigin = raycaster.ray.origin.clone();
        mirroredOrigin.x *= -1;

        const mirroredDir = raycaster.ray.direction.clone();
        mirroredDir.x *= -1;

        raycaster.set(mirroredOrigin, mirroredDir);
        const mirroredHits = raycaster.intersectObject(AppState.skinMesh, true);

        if (mirroredHits.length > 0 && mirroredHits[0].uv) {
            drawBrushAtUV(mirroredHits[0].uv, canvas, context, AppState.brushRadius / 2);
        }
    }

    texture.needsUpdate = true;

    // Detect bones from face geometry
    const faceIndex = currentHit.faceIndex;
    const geometry = AppState.skinMesh.geometry;
    const indexAttr = geometry.index;
    const skinIndex = geometry.attributes.skinIndex;
    const skinWeight = geometry.attributes.skinWeight;

    const a = indexAttr.getX(faceIndex * 3);
    const b = indexAttr.getX(faceIndex * 3 + 1);
    const c = indexAttr.getX(faceIndex * 3 + 2);

    function getDominantBone(vertIndex) {
        const indices = [
            skinIndex.getX(vertIndex),
            skinIndex.getY(vertIndex),
            skinIndex.getZ(vertIndex),
            skinIndex.getW(vertIndex)
        ];
        const weights = [
            skinWeight.getX(vertIndex),
            skinWeight.getY(vertIndex),
            skinWeight.getZ(vertIndex),
            skinWeight.getW(vertIndex)
        ];
        const maxIndex = weights.indexOf(Math.max(...weights));
        return indices[maxIndex];
    }

    const bones = [a, b, c].map(getDominantBone);
    const boneNames = bones
        .map(i => AppState.skinMesh.skeleton.bones[i]?.name)
        .filter(Boolean);

    // --- Save detected bones per stroke ---
    if (!AppState.drawnBoneNames) AppState.drawnBoneNames = new Set();
    boneNames.forEach(name => AppState.drawnBoneNames.add(name));
}

function drawBrushAtUV(uv, canvas, context, radius) {
    const x = Math.floor(uv.x * canvas.width);
    const y = Math.floor((1 - uv.y) * canvas.height);

    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fill();
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

export function getRegionFromUVHit(uv, uvVertexMap, skinnedMesh) {
    const geometry = skinnedMesh.geometry;
    const skinIndex = geometry.attributes.skinIndex;
    const skinWeight = geometry.attributes.skinWeight;

    if (!skinIndex || !skinWeight) {
        console.warn("Missing skinning data on mesh.");
        return null;
    }

    // Find the closest UV in the map
    let minDist = Infinity;
    let bestMatch = null;
    for (let i = 0; i < uvVertexMap.length; i++) {
        const { u: mapU, v: mapV } = uvVertexMap[i];
        const dist = Math.hypot(uv.u - mapU, uv.v - mapV);
        if (dist < minDist) {
            minDist = dist;
            bestMatch = uvVertexMap[i];
        }
    }

    if (!bestMatch || bestMatch.index == null) {
        console.warn("No valid UV match found.");
        return null;
    }

    const idx = bestMatch.index;

    if (idx >= skinIndex.count) {
        console.warn("Vertex index out of bounds:", idx);
        return null;
    }

    const indices = [
        skinIndex.getX(idx),
        skinIndex.getY(idx),
        skinIndex.getZ(idx),
        skinIndex.getW(idx)
    ];
    const weights = [
        skinWeight.getX(idx),
        skinWeight.getY(idx),
        skinWeight.getZ(idx),
        skinWeight.getW(idx)
    ];

    const maxWeightIdx = weights.indexOf(Math.max(...weights));
    const boneIndex = indices[maxWeightIdx];
    const boneName = skinnedMesh.skeleton.bones[boneIndex]?.name || null;

    return boneName;
}

export function getBoneFromPaintedUV(canvas, skinnedMesh) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;

    const geometry = skinnedMesh.geometry;
    const uvAttr = geometry.attributes.uv;
    const indexAttr = geometry.index;
    const skinIndex = geometry.attributes.skinIndex;
    const skinWeight = geometry.attributes.skinWeight;

    const boneWeightMap = new Map();

    const N = 10;
    for (let y = 0; y < height; y += N) {
        for (let x = 0; x < width; x += N) {
            const idx = (y * width + x) * 4;
            const alpha = imageData[idx + 3];
            if (alpha < 10) continue;

            const u = x / width;
            const v = 1 - y / height;

            // Loop through all triangles
            for (let i = 0; i < indexAttr.count; i += 3) {
                const a = indexAttr.getX(i);
                const b = indexAttr.getX(i + 1);
                const c = indexAttr.getX(i + 2);

                const uvA = new THREE.Vector2(uvAttr.getX(a), uvAttr.getY(a));
                const uvB = new THREE.Vector2(uvAttr.getX(b), uvAttr.getY(b));
                const uvC = new THREE.Vector2(uvAttr.getX(c), uvAttr.getY(c));

                if (pointInTriangle(u, v, uvA, uvB, uvC)) {
                    // All 3 vertices contribute
                    [a, b, c].forEach(vert => {
                        const bones = [
                            skinIndex.getX(vert),
                            skinIndex.getY(vert),
                            skinIndex.getZ(vert),
                            skinIndex.getW(vert),
                        ];
                        const weights = [
                            skinWeight.getX(vert),
                            skinWeight.getY(vert),
                            skinWeight.getZ(vert),
                            skinWeight.getW(vert),
                        ];

                        for (let j = 0; j < 4; j++) {
                            const bone = bones[j];
                            const weight = weights[j];
                            if (weight > 0.01) {
                                boneWeightMap.set(bone, (boneWeightMap.get(bone) || 0) + weight);
                            }
                        }
                    });
                    break; // move on to next painted pixel
                }
            }
        }
    }

    const sortedBones = [...boneWeightMap.entries()]
    .filter(([_, weight]) => weight > 2.0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

    return sortedBones.map(([boneIndex, _]) => skinnedMesh.skeleton.bones[boneIndex]?.name).filter(Boolean);
}

function pointInTriangle(u, v, A, B, C) {
    const P = new THREE.Vector2(u, v);

    // Vectors from A to B and A to C
    const v0 = C.clone().sub(A);
    const v1 = B.clone().sub(A);
    const v2 = P.clone().sub(A);

    const dot00 = v0.dot(v0);
    const dot01 = v0.dot(v1);
    const dot02 = v0.dot(v2);
    const dot11 = v1.dot(v1);
    const dot12 = v1.dot(v2);

    const denom = dot00 * dot11 - dot01 * dot01;

    // Triangle is degenerate
    if (denom === 0) return false;

    const invDenom = 1 / denom;
    const uCoord = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const vCoord = (dot00 * dot12 - dot01 * dot02) * invDenom;

    // Point is inside the triangle if uCoord and vCoord are both >= 0 and their sum <= 1
    return uCoord >= 0 && vCoord >= 0 && (uCoord + vCoord <= 1);
}