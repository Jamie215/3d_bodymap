// FHS MSK-IF Pain Assessment Project Prototype Script 2025

const googleFont = document.createElement('link');
googleFont.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap';
googleFont.rel = 'stylesheet';
document.head.appendChild(googleFont);

// For Future Testing (Need to fix)
// const bodyRegions = [
//     { name: "Face", uvMin: { x: 0.8, y: 0.35 }, uvMax: { x: 1.0, y: 0.65 } },
//     { name: "Neck", uvMin: { x: 0.2, y: 0.9 }, uvMax: { x: 0.55, y: 0.95 } },
//     { name: "Chest", uvMin: { x: 0.3, y: 0.65 }, uvMax: { x: 0.5, y: 0.75 } },
//     { name: "Abdomen", uvMin: { x: 0.3, y: 0.5 }, uvMax: { x: 0.5, y: 0.65 } },
//     { name: "Arm - Left", uvMin: { x: 0.0, y: 0.8 }, uvMax: { x: 0.2, y: 0.9 } },
//     { name: "Arm - Right", uvMin: { x: 0.6, y: 0.8 }, uvMax: { x: 0.75, y: 0.9 } },
//     { name: "Leg - Left", uvMin: { x: 0.15, y: 0.2 }, uvMax: { x: 0.4, y: 0.4 } },
//     { name: "Leg - Right", uvMin: { x: 0.4, y: 0.2 }, uvMax: { x: 0.6, y: 0.4 } },
//     { name: "Feet", uvMin: { x: 0.0, y: 0.0 }, uvMax: { x: 0.4, y: 0.1 } },
//     { name: "Hands", uvMin: { x: 0.4, y: 0.0 }, uvMax: { x: 0.8, y: 0.2 } }
// ];


// Create the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.background = new THREE.Color(0xf0f0f0);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-10, 10, -10); // Opposite position to the main light
scene.add(fillLight);

// Add OrbitControls for zooming and rotating
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth motion
controls.dampingFactor = 0.05;
controls.minDistance = 1; // Minimum zoom
controls.maxDistance = 10; // Maximum zoom
controls.target.set(0, 1.5, 0); // Focus point
controls.update();

// Panning mode
controls.enablePan = false;

// Position the camera
camera.position.set(0, 1.5, 2);
camera.lookAt(0, 1.5, 0);

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Raycaster for selecting faces
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add model options
const models = [
    { name: 'Model 1', file: './preliminary_3D_manikin.glb' },
    { name: 'Model 2', file: './preliminary_3D_manikin2.glb' }
];

// Create Model select option
const modelSelect = document.createElement('select');
modelSelect.id = 'model-select';

let currentModelName = "Model 1";
let model = null;
let skinMesh = null;

models.forEach((model) => {
    const option = document.createElement('option');
    option.value = model.file;
    option.textContent = model.name;
    if (model.name === currentModelName) option.selected = true;
    modelSelect.appendChild(option);
});

function loadModel(modelPath, modelName) {
    if (model) {
        scene.remove(model);
        model.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        model = null;
        skinMesh = null;
    }
    const loader = new THREE.GLTFLoader();
    loader.load(
        modelPath,
        (gltf) => {
            console.log(`Successfully loaded model: ${modelPath}`);
            model = gltf.scene;
            model.position.y += 0.5;
            scene.add(model);

            // console.log("GLTF Full Metadata:", JSON.stringify(gltf.parser.json, null, 2));

            model.traverse((child) => {
                if(child.isMesh) {
                    // console.log(`Parent, Child_name: ${child.parent.name}, ${child.name}`);
                    // console.log(`Child_material_name: ${child.material.name}`)
                    if (child.name == ("Hair")) {
                        // console.log(`Skipping hair material for: ${child.name}`);
                        return; // Skip modifying hair material
                    }
                    else if (child.name === "Human") {
                        // Assuming "base" is the skin layer
                        skinMesh = child;

                        const textureSize = 1024; // Texture resolution
                        const canvas = document.createElement('canvas');
                        canvas.width = canvas.height = textureSize;
                        const context = canvas.getContext('2d');

                        // Fill the texture with white (base color)
                        context.fillStyle = '#ffffff';
                        context.fillRect(0, 0, textureSize, textureSize);

                        // Create a texture from the canvas
                        const texture = new THREE.CanvasTexture(canvas);
                        texture.needsUpdate = true;

                        // Assign the texture to the material
                        child.material.map = texture;
                        child.material.transparent = true;
                        child.material.alphaTest = 0.5;
                        child.material.needsUpdate = true;

                        // Store canvas and context for painting
                        child.userData.canvas = canvas;
                        child.userData.context = context;
                        child.userData.texture = texture;
                    } 
                    else if (child.name === "Top" || child.name === "Shorts") {
                        child.material.transparent = true;
                        child.material.opacity = 0.8;
                        child.material.depthWrite = false;
                        child.material.blending = THREE.NormalBlending;
                    }
                }
            });
            currentModelName = modelName;
            console.log(`Current model: ${currentModelName}`);

            // Ensure controls are updated
            controls.update();
        },
        undefined,
        (error) => {
            console.error("Error loading model: ", error);
        }
    );
}

// Create and add the UI container
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '10px';
uiContainer.style.left = '10px';
uiContainer.style.zIndex = '10';
uiContainer.style.background = 'rgba(255, 255, 255, 0.8)';
uiContainer.style.padding = '10px';
uiContainer.style.borderRadius = '5px';
uiContainer.style.display = 'flex';
uiContainer.style.alignItems = 'center';
uiContainer.style.gap = '10px';
uiContainer.style.fontFamily = "'Roboto', sans-serif";
uiContainer.style.fontSize = "20px";

// Styling the model selection
modelSelect.fontFamily = "'Roboto', sans-serif";
modelSelect.style.padding = '8px 12px';
modelSelect.style.borderRadius = '5px';
modelSelect.style.fontSize = "20px";

// Create the label
const label = document.createElement('label');
label.textContent = 'Brush Size: ';
label.htmlFor = 'brush-radius';
label.style.fontFamily = "'Roboto', sans-serif";
label.style.fontSize = "20px";
label.style.fontWeight = "bold";

// Create the slider input
const brushRadiusSlider = document.createElement('input');
brushRadiusSlider.type = 'range';
brushRadiusSlider.id = 'brush-radius';
brushRadiusSlider.min = '1';
brushRadiusSlider.max = '31';
brushRadiusSlider.step = '5';
brushRadiusSlider.value = '5';

// Create the span to show the current brush radius value
const brushRadiusValue = document.createElement('span');
brushRadiusValue.id = 'brush-radius-value';
brushRadiusValue.textContent = '5';
brushRadiusValue.style.marginRight = '20px';
brushRadiusValue.style.fontFamily = "'Roboto', sans-serif";
brushRadiusValue.style.fontSize = "20px";

// Create erase mode toggle button
const eraseButton = document.createElement('button');
eraseButton.textContent = 'Drawing Mode'
eraseButton.style.padding = '8px 12px';
eraseButton.style.border = 'none';
eraseButton.style.borderRadius = '5px';
eraseButton.style.background = '#388E3C';
eraseButton.style.color = '#ffffff';
eraseButton.style.fontFamily = "'Roboto', sans-serif";
eraseButton.style.fontSize = '20px';
eraseButton.style.cursor = 'pointer';

// Create reset button
const resetButton = document.createElement('button');
resetButton.textContent = 'Reset Drawing';
resetButton.style.padding = '8px 12px';
resetButton.style.border = 'none';
resetButton.style.borderRadius = '5px';
resetButton.style.background = '#1976D2'; // Blue
resetButton.style.color = '#ffffff';
resetButton.style.fontFamily = "'Roboto', sans-serif";
resetButton.style.fontSize = '20px';
resetButton.style.cursor = 'pointer';

// Create Pan Mode toggle button
const panButton = document.createElement('button');
panButton.textContent = "Zoom / Rotate";
panButton.style.padding = '8px 12px';
panButton.style.border = 'none';
panButton.style.borderRadius = '5px';
panButton.style.background = '#1976D2'; // Blue
panButton.style.color = '#ffffff';
panButton.style.fontFamily = "'Roboto', sans-serif";
panButton.style.fontSize = '20px';
panButton.style.cursor = 'pointer';

// Append the elements to the container
uiContainer.appendChild(modelSelect);
uiContainer.appendChild(label);
uiContainer.appendChild(brushRadiusSlider);
uiContainer.appendChild(brushRadiusValue);
uiContainer.appendChild(eraseButton);
uiContainer.appendChild(resetButton);
uiContainer.appendChild(panButton);

// Append the container to the body
document.body.appendChild(uiContainer);

// Event listener for model selection change
modelSelect.addEventListener("change", (event) => {
    const selectedModel = models.find(model => model.file === event.target.value);
    if (selectedModel) {
        loadModel(selectedModel.file, selectedModel.name);
    }
});

// Re-append the model selector to UI
uiContainer.appendChild(modelSelect);

// Load the default model at startup
loadModel(models[0].file, models[0].name);

// Update the brushRadius dynamically
brushRadiusSlider.addEventListener('input', (event) => {
    brushRadius = parseFloat(event.target.value);
    brushRadiusValue.textContent = brushRadius.toFixed(1);
});

let brushRadius = 5;
let isDrawing = false;
let isErasing = false;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Event listener for mouse down (start painting)
window.addEventListener('mousedown', (event) => {
    if (!model) return; // Ensure the model is loaded

    // For panning
    if (isPanningMode) {
        isDragging = true;
        previousMousePosition.x = event.clientX;
        previousMousePosition.y = event.clientY;
        return;
    }

    // Update mouse coordinates in normalized device space
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Set raycaster based on mouse position and camera
    raycaster.setFromCamera(mouse, camera);

    // Check if the mouse is intersecting with the body map
    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
        // Start drawing only if the body map is intersected
        isDrawing = true;
        controls.enabled = false; // Disable rotation controls
        console.log('Drawing started on the body map.');
    }
});

// Event listener for mouse up (stop painting)
window.addEventListener('mouseup', () => {
    isDragging = false;
    if (isDrawing) { 
        isDrawing = false;
        controls.enabled = true; // Re-enable rotation controls
        console.log('Drawing stopped. Controls enabled.');
    }
});

// Event listener for toggling erase mode
eraseButton.addEventListener('click', () => {
    isErasing = !isErasing; // Toggle erase mode
    eraseButton.textContent = `${isErasing ? 'Erase Mode' : 'Drawing Mode'}`;
    eraseButton.style.background = isErasing ? '#d32f2f' : '#388E3C'; // Green when ON, Red when OFF
});

// Reset button functionality
resetButton.addEventListener('click', () => {
    if (skinMesh && skinMesh.userData.context) {
        const context = skinMesh.userData.context;
        const canvas = skinMesh.userData.canvas;

        // Clear the canvas by filling it with white
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Update the texture
        skinMesh.userData.texture.dispose();
        skinMesh.userData.texture = new THREE.CanvasTexture(canvas);
        skinMesh.material.map = skinMesh.userData.texture;
        skinMesh.material.needsUpdate = true;

        console.log("Drawing reset.");
    }
});

let isPanningMode = false;
panButton.addEventListener('click', () => {
    isPanningMode = !isPanningMode;
    panButton.textContent = `${isPanningMode ? 'Drag / Pan' : 'Zoom / Rotate'}`;
    panButton.style.background = isPanningMode ? '#388E3C' : '#1976D2';
    document.body.style.cursor = isPanningMode ? 'move' : 'default';

    controls.enableRotate = !isPanningMode;
});

// Update brushRadius when the slider value changes
brushRadiusSlider.addEventListener('input', (event) => {
    brushRadius = parseFloat(event.target.value);
    brushRadiusValue.textContent = brushRadius.toFixed(1); // Update the displayed value
});

// Event listener for mouse move (paint while moving)
window.addEventListener('mousemove', (event) => {
    if (isPanningMode && isDragging) {
        // Implement panning
        const deltaX = event.clientX - previousMousePosition.x;
        const deltaY = event.clientY - previousMousePosition.y;

        previousMousePosition.x = event.clientX;
        previousMousePosition.y = event.clientY;

        const panSpeed = 0.005; // Adjust sensitivity

        // Move both the camera position and controls target
        camera.position.x -= deltaX * panSpeed;
        camera.position.y += deltaY * panSpeed;
        controls.target.x -= deltaX * panSpeed;
        controls.target.y += deltaY * panSpeed;

        controls.update();
        return; // Exit early to avoid painting when panning
    }
    
    if (!isDrawing || !skinMesh) {
        // console.warn("Skipping paint event - skinMesh not assigned yet.");
        return;
    }

    // Update mouse coordinates in normalized device space
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Set raycaster based on mouse position and camera
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(model.children, true); // Check all meshes in the model
    if (intersects.length === 0) return;

    let skinHit = null;
    let worldPosition = null;

    for (let hit of intersects) {
        if (hit.object === skinMesh) {
            // Found a direct hit on the skin
            skinHit = hit;
            break;
        }
        if (hit.object.name.toLowerCase().startsWith("base_")) {
            // If we hit clothing first, store the world position
            worldPosition = hit.point;
        }
    }

    if (!skinHit && worldPosition) {
        // If we hit clothing, we need to find the skin at the same world position
        const skinIntersects = raycaster.intersectObject(skinMesh, true);
        if (skinIntersects.length > 0) {
            skinHit = skinIntersects[0];  // Use the first intersection with the skin
        }
    }

    if (!skinHit) {
        console.log("No skin detected, skipping paint.");
        return;
    }

    // Extract UV coordinates
    const uv = skinHit.uv;
    if (!uv) return;

    // For Future Testing
    // let bodyPart = getBodyPartFromUV(uv);
    // console.log(`Painting on: ${bodyPart}`);

    if (skinMesh.userData.context) {
        const context = skinMesh.userData.context;
        const canvas = skinMesh.userData.canvas;

        const x = Math.floor(uv.x * canvas.width);
        const y = Math.floor((1 - uv.y) * canvas.height);

        context.beginPath();
        context.arc(x, y, brushRadius, 0, 2 * Math.PI);
        context.fillStyle = isErasing ? '#ffffff' : '#9575CD';
        context.fill();

        // Force texture update
        skinMesh.userData.texture.dispose();
        skinMesh.userData.texture = new THREE.CanvasTexture(canvas);
        skinMesh.material.map = skinMesh.userData.texture;
        skinMesh.material.needsUpdate = true;
    }
});

// For Future Testing
// function getBodyPartFromUV(uv) {
//     for (let region of bodyRegions) {
//         if (
//             uv.x >= region.uvMin.x && uv.x <= region.uvMax.x &&
//             uv.y >= region.uvMin.y && uv.y <= region.uvMax.y
//         ) {
//             return region.name;
//         }
//     }
//     return "Unknown";
// }

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Update controls every frame
    renderer.render(scene, camera);
}
animate();