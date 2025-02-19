// FHS MSK-IF Pain Assessment Project Prototype Script 2025

const googleFont = document.createElement('link');
googleFont.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap';
googleFont.rel = 'stylesheet';
document.head.appendChild(googleFont);

// For Future Testing
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

// Position the camera
camera.position.set(0, 1.5, 5);
camera.lookAt(0, 1.5, 0);

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Load the GLTF model
let model;
const loader = new THREE.GLTFLoader();
loader.load(
    './preliminary_3D_manikin.glb',
    (gltf) => {
        model = gltf.scene;
        scene.add(model);

        // Traverse the model and inspect materials
        model.traverse((child) => {
            if (child.isMesh) {
                console.log(`Parent, Child_name: ${child.parent.name}, ${child.name}`);
                console.log(`Child_material_name: ${child.material.name}`)
                if (child.name == ("Hair")) {
                    // console.log(`Skipping hair material for: ${child.name}`);
                    return; // Skip modifying hair material
                }
                if (child.name === "Human") {
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
    },
    undefined,
    (error) => {
        console.error('Error loading model:', error);
    }
);

// Raycaster for selecting faces
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
// Create and add the UI container
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '10px';
uiContainer.style.left = '10px';
uiContainer.style.zIndex = '10';
uiContainer.style.background = 'rgba(255, 255, 255, 0.8)';
uiContainer.style.padding = '10px';
uiContainer.style.borderRadius = '5px';

// Create the label
const label = document.createElement('label');
label.textContent = 'Brush Radius: ';
label.htmlFor = 'brush-radius';

// Create the span to show the current brush radius value
const brushRadiusValue = document.createElement('span');
brushRadiusValue.id = 'brush-radius-value';
brushRadiusValue.textContent = '5';

// Create the slider input
const brushRadiusSlider = document.createElement('input');
brushRadiusSlider.type = 'range';
brushRadiusSlider.id = 'brush-radius';
brushRadiusSlider.min = '1';
brushRadiusSlider.max = '31';
brushRadiusSlider.step = '5';
brushRadiusSlider.value = '5';

// Create erase mode toggle button
const eraseButton = document.createElement('button');
eraseButton.textContent = 'Erase Mode: OFF'
eraseButton.style.padding = '8px 12px';
eraseButton.style.marginTop = '10px';
eraseButton.style.marginLeft = '20px';
eraseButton.style.border = 'none';
eraseButton.style.borderRadius = '5px';
eraseButton.style.background = '#d32f2f'; // Red color for erasing
eraseButton.style.color = '#ffffff';
eraseButton.style.fontFamily = "'Roboto', sans-serif";
eraseButton.style.cursor = 'pointer';
eraseButton.style.padding = '10px';

// Create reset button
const resetButton = document.createElement('button');
resetButton.textContent = 'Reset Drawing';
resetButton.style.padding = '8px 12 px';
resetButton.style.marginTop = '10px';
resetButton.style.marginLeft = '20px';
resetButton.style.border = 'none';
resetButton.style.borderRadius = '5px';
resetButton.style.background = '#1976D2'; // Blue color for reset
resetButton.style.color = '#ffffff';
resetButton.style.fontFamily = "'Roboto', sans-serif";
resetButton.style.cursor = 'pointer';
resetButton.style.padding = '10px';

// Append the label and slider to the container
uiContainer.appendChild(label);
uiContainer.appendChild(brushRadiusSlider);
uiContainer.appendChild(brushRadiusValue);

// Append buttons to the container
uiContainer.appendChild(eraseButton);
uiContainer.appendChild(resetButton);

// Append the container to the body
document.body.appendChild(uiContainer);

// Update the brushRadius dynamically
brushRadiusSlider.addEventListener('input', (event) => {
    brushRadius = parseFloat(event.target.value);
    brushRadiusValue.textContent = brushRadius.toFixed(1);
});

let brushRadius = 5;
let isDrawing = false;
let isErasing = false;

// Event listener for mouse down (start painting)
window.addEventListener('mousedown', (event) => {
    if (!model) return; // Ensure the model is loaded

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
    if (isDrawing) { 
        isDrawing = false;
        controls.enabled = true; // Re-enable rotation controls
        console.log('Drawing stopped. Controls enabled.');
    }
});

// Event listener for toggling erase mode
eraseButton.addEventListener('click', () => {
    isErasing = !isErasing; // Toggle erase mode
    eraseButton.textContent = `Erase Mode: ${isErasing ? 'ON' : 'OFF'}`;
    eraseButton.style.background = isErasing ? '#388E3C' : '#d32f2f'; // Green when ON, Red when OFF
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

// Update brushRadius when the slider value changes
brushRadiusSlider.addEventListener('input', (event) => {
    brushRadius = parseFloat(event.target.value);
    brushRadiusValue.textContent = brushRadius.toFixed(1); // Update the displayed value
});

// Event listener for mouse move (paint while moving)
window.addEventListener('mousemove', (event) => {
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

// Style related
uiContainer.style.fontFamily = "'Roboto', sans-serif";
uiContainer.style.fontSize = "20px";

label.style.fontFamily = "'Roboto', sans-serif";
label.style.fontSize = "20px";
label.style.fontWeight = "bold";

brushRadiusValue.style.fontFamily = "'Roboto', sans-serif";
brushRadiusValue.style.fontSize = "20px";
brushRadiusValue.style.marginLeft = "5px"; 