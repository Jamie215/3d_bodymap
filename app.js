// FHS MSK-IF Pain Assessment Project Prototype Script 2025
// Enhanced with requested modifications

// Add required fonts
const googleFont = document.createElement('link');
googleFont.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap';
googleFont.rel = 'stylesheet';
document.head.appendChild(googleFont);

// Create the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xf0f0f0); // Set background color
scene.background = new THREE.Color(0xf0f0f0);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-10, 10, -10);
scene.add(fillLight);

// Add OrbitControls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 10;
controls.target.set(0, 1.5, 0);
controls.update();

// Store the initial camera and control settings for reset
const initialCameraPosition = new THREE.Vector3(0, 1.0, 1.5);
const initialControlsTarget = new THREE.Vector3(0, 1.0, 0);

// Position the camera
camera.position.copy(initialCameraPosition);
camera.lookAt(initialControlsTarget);

// Raycaster for selecting faces
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add model options
const models = [
    { name: 'Model 1', file: './female_young_avgheight.glb' },
    { name: 'Model 2', file: './male_young_avgheight.glb' }
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

// Function to load model
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
    
    // Create an immediate visual indicator while loading
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(0, 1.5, 0);
    scene.add(sphere);
    
    console.log(`Loading model: ${modelPath}`);
    
    const loader = new THREE.GLTFLoader();
    loader.load(
        modelPath,
        (gltf) => {
            console.log(`Successfully loaded model: ${modelPath}`);
            scene.remove(sphere); // Remove loading indicator
            
            model = gltf.scene;
            model.position.y = 0; // Start at 0 and let's compute a better position
            
            // Get model dimensions to help with centering
            let boundingBox = new THREE.Box3().setFromObject(model);
            let modelHeight = boundingBox.max.y - boundingBox.min.y;
            
            // Position model to be centered vertically in the viewport
            // The value 1.0 is our target center point (from camera settings)
            model.position.y = 1.0 - modelHeight/2;
            // model.position.y += 0.5;
            scene.add(model);

            model.traverse((child) => {
                if(child.isMesh) {
                    if (child.name == ("Hair")) {
                        return;
                    }
                    else if (child.name === "Human") {
                        skinMesh = child;
                        const textureSize = 1024;
                        const canvas = document.createElement('canvas');
                        canvas.width = canvas.height = textureSize;
                        const context = canvas.getContext('2d');
                        context.fillStyle = '#ffffff';
                        context.fillRect(0, 0, textureSize, textureSize);
                        const texture = new THREE.CanvasTexture(canvas);
                        child.material = child.material.clone();
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                        child.userData.canvas = canvas;
                        child.userData.context = context;
                        child.userData.texture = texture;
                    } 
                    else if (child.name === "Top" || child.name === "Shorts") {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.6;
                        child.material.needsUpdate = true;
                    }
                }
            });

            controls.target.set(
                model.position.x,
                model.position.y + modelHeight/2, // Target the middle of the model
                model.position.z
            );
            controls.update();

            currentModelName = modelName;
            console.log(`Current model: ${currentModelName}`);
        },
        (xhr) => {
            console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`);
        },
        (error) => {
            console.error("Error loading model: ", error);
            scene.remove(sphere); // Remove loading indicator on error
        }
    );
}

// Function to reset camera position without affecting the drawing
function resetPosition() {
    camera.position.copy(initialCameraPosition);
    controls.target.copy(initialControlsTarget);
    controls.update();
    statusIndicator.textContent = 'Position Reset';
}

// Create container for the entire application
const appContainer = document.createElement('div');
appContainer.style.position = 'absolute';
appContainer.style.top = '0';
appContainer.style.left = '0';
appContainer.style.width = '100%';
appContainer.style.height = '100%';
appContainer.style.overflow = 'hidden';
document.body.appendChild(appContainer);

// Create canvas container
const canvasContainer = document.createElement('div');
canvasContainer.style.position = 'absolute';
canvasContainer.style.top = '0';
canvasContainer.style.left = '0';
canvasContainer.style.width = '100%';
canvasContainer.style.height = '100%';
appContainer.appendChild(canvasContainer);

// Add the renderer to the canvas container
canvasContainer.appendChild(renderer.domElement);

// Create UI container
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '20px'; // Increased margin
uiContainer.style.left = '20px'; // Increased margin
uiContainer.style.display = 'flex';
uiContainer.style.flexDirection = 'column';
uiContainer.style.gap = '20px'; // Increased gap between containers
uiContainer.style.zIndex = '1000';
canvasContainer.appendChild(uiContainer);

// Create drawing controls
const drawingControlsContainer = document.createElement('div');
drawingControlsContainer.style.background = 'rgba(255, 255, 255, 0.9)';
drawingControlsContainer.style.padding = '20px'; // Increased padding
drawingControlsContainer.style.borderRadius = '10px'; // Larger border radius
drawingControlsContainer.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';
drawingControlsContainer.style.width = '240px'; // Slightly wider
uiContainer.appendChild(drawingControlsContainer);

// Add title
const title = document.createElement('h3');
title.textContent = 'Drawing Controls';
title.style.margin = '0 0 15px 0'; // Increased margin
title.style.fontFamily = 'Roboto, sans-serif';
title.style.fontSize = '22px'; // Further increased font size
title.style.fontWeight = 'bold';
title.style.textAlign = 'center';
drawingControlsContainer.appendChild(title);

// Add buttons with SVG icons
const drawButton = document.createElement('button');
drawButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path></svg><span style="margin-left: 10px; font-size: 16px;">Draw</span>';
drawButton.style.width = '100%';
drawButton.style.padding = '12px'; // Increased padding
drawButton.style.marginBottom = '12px'; // Increased margin
drawButton.style.background = '#0277BD';
drawButton.style.color = 'white';
drawButton.style.border = 'none';
drawButton.style.borderRadius = '6px'; // Larger border radius
drawButton.style.cursor = 'pointer';
drawButton.style.display = 'flex';
drawButton.style.alignItems = 'center';
drawButton.style.justifyContent = 'center';
drawButton.style.fontSize = '16px'; // Increased font size
drawingControlsContainer.appendChild(drawButton);

const eraseButton = document.createElement('button');
eraseButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg><span style="margin-left: 10px; font-size: 16px;">Erase</span>';
eraseButton.style.width = '100%';
eraseButton.style.padding = '12px'; // Increased padding
eraseButton.style.marginBottom = '12px'; // Increased margin
eraseButton.style.background = '#757575';
eraseButton.style.color = 'white';
eraseButton.style.border = 'none';
eraseButton.style.borderRadius = '6px'; // Larger border radius
eraseButton.style.cursor = 'pointer';
eraseButton.style.display = 'flex';
eraseButton.style.alignItems = 'center';
eraseButton.style.justifyContent = 'center';
eraseButton.style.fontSize = '16px'; // Increased font size
drawingControlsContainer.appendChild(eraseButton);

// New SVG for reset all button (trash can icon)
const resetAllButton = document.createElement('button');
resetAllButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg><span style="margin-left: 10px; font-size: 16px;">Reset All</span>';
resetAllButton.style.width = '100%';
resetAllButton.style.padding = '12px'; // Increased padding
resetAllButton.style.marginBottom = '15px'; // Increased margin
resetAllButton.style.background = '#d32f2f'; // Changed to red for reset all
resetAllButton.style.color = 'white';
resetAllButton.style.border = 'none';
resetAllButton.style.borderRadius = '6px'; // Larger border radius
resetAllButton.style.cursor = 'pointer';
resetAllButton.style.display = 'flex';
resetAllButton.style.alignItems = 'center';
resetAllButton.style.justifyContent = 'center';
resetAllButton.style.fontSize = '16px'; // Increased font size
drawingControlsContainer.appendChild(resetAllButton);

// Create divider
const divider = document.createElement('hr');
divider.style.width = '90%';
divider.style.border = '1px solid #e0e0e0';
divider.style.margin = '5px auto 20px auto'; // Increased margin
drawingControlsContainer.appendChild(divider);

// Add brush size adjuster
const brushSizeLabel = document.createElement('div');
brushSizeLabel.style.display = 'flex';
brushSizeLabel.style.justifyContent = 'space-between';
brushSizeLabel.style.alignItems = 'center';
brushSizeLabel.style.width = '100%';
brushSizeLabel.style.marginBottom = '10px'; // Increased margin
drawingControlsContainer.appendChild(brushSizeLabel);

const brushSizeText = document.createElement('div');
brushSizeText.textContent = 'Brush Size:';
brushSizeText.style.fontFamily = 'Roboto, sans-serif';
brushSizeText.style.fontWeight = 'bold';
brushSizeText.style.fontSize = '16px'; // Increased font size
brushSizeLabel.appendChild(brushSizeText);

const brushSizeValue = document.createElement('div');
brushSizeValue.textContent = '15';
brushSizeValue.style.fontFamily = 'Roboto, sans-serif';
brushSizeValue.style.fontWeight = 'bold';
brushSizeValue.style.fontSize = '16px'; // Increased font size
brushSizeValue.style.color = '#0277BD';
brushSizeValue.style.padding = '4px 8px'; // Increased padding
brushSizeValue.style.backgroundColor = '#E3F2FD';
brushSizeValue.style.borderRadius = '4px';
brushSizeLabel.appendChild(brushSizeValue);

const brushSizeSlider = document.createElement('input');
brushSizeSlider.type = 'range';
brushSizeSlider.min = '5';
brushSizeSlider.max = '35';
brushSizeSlider.step = '5';
brushSizeSlider.value = '15';
brushSizeSlider.style.width = '100%';
brushSizeSlider.style.height = '8px'; // Increased height for easier interaction
brushSizeSlider.style.margin = '0 0 20px 0'; // Increased margin
brushSizeSlider.style.accentColor = '#0277BD';
drawingControlsContainer.appendChild(brushSizeSlider);

// Add model select to drawing controls
const divider2 = document.createElement('hr');
divider2.style.width = '90%';
divider2.style.border = '1px solid #e0e0e0';
divider2.style.margin = '15px auto 20px auto'; // Increased margin
drawingControlsContainer.appendChild(divider2);

// Add model select
const modelLabel = document.createElement('div');
modelLabel.textContent = 'Select Model:';
modelLabel.style.fontFamily = 'Roboto, sans-serif';
modelLabel.style.marginBottom = '8px';
modelLabel.style.fontWeight = 'bold';
modelLabel.style.fontSize = '16px'; // Increased font size
drawingControlsContainer.appendChild(modelLabel);

modelSelect.style.width = '100%';
modelSelect.style.padding = '10px'; // Increased padding
modelSelect.style.marginBottom = '10px';
modelSelect.style.borderRadius = '6px'; // Larger border radius
modelSelect.style.border = '1px solid #ccc';
modelSelect.style.fontSize = '15px'; // Increased font size
drawingControlsContainer.appendChild(modelSelect);

// Create view controls - wider than drawing controls
const viewControlsContainer = document.createElement('div');
viewControlsContainer.style.background = 'rgba(255, 255, 255, 0.9)';
viewControlsContainer.style.padding = '20px'; // Increased padding
viewControlsContainer.style.borderRadius = '10px'; // Larger border radius
viewControlsContainer.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';
viewControlsContainer.style.width = '280px'; // Wider than drawing controls
uiContainer.appendChild(viewControlsContainer);

// Add title
const viewTitle = document.createElement('h3');
viewTitle.textContent = 'View Controls';
viewTitle.style.margin = '0 0 15px 0'; // Increased margin
viewTitle.style.fontFamily = 'Roboto, sans-serif';
viewTitle.style.fontSize = '22px'; // Further increased font size
viewTitle.style.fontWeight = 'bold';
viewTitle.style.textAlign = 'center';
viewControlsContainer.appendChild(viewTitle);

// Add button container for rotation/pan
const buttonContainer = document.createElement('div');
buttonContainer.style.display = 'flex';
buttonContainer.style.width = '100%';
buttonContainer.style.marginBottom = '15px'; // Increased margin
buttonContainer.style.border = '1px solid #e0e0e0';
buttonContainer.style.borderRadius = '6px'; // Larger border radius
buttonContainer.style.overflow = 'hidden';
viewControlsContainer.appendChild(buttonContainer);

// Modified SVG for rotate button (more intuitive rotation icon)
const rotateButton = document.createElement('button');
rotateButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> <span style="font-size: 15px;">Rotate</span>';
rotateButton.style.flex = '1';
rotateButton.style.padding = '12px'; // Increased padding
rotateButton.style.border = 'none';
rotateButton.style.background = '#E8F5E9';
rotateButton.style.color = '#333';
rotateButton.style.fontSize = '15px'; // Increased font size
rotateButton.style.cursor = 'pointer';
rotateButton.style.display = 'flex';
rotateButton.style.alignItems = 'center';
rotateButton.style.justifyContent = 'center';
rotateButton.style.gap = '5px';
buttonContainer.appendChild(rotateButton);

const panButton = document.createElement('button');
panButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.2 9l-3 3 3 3M9 5.2l3-3 3 3M15 18.9l-3 3-3-3M18.9 9l3 3-3 3M3.3 12h17.4M12 3.2v17.6"></path></svg> <span style="font-size: 15px;">Pan</span>';
panButton.style.flex = '1';
panButton.style.padding = '12px'; // Increased padding
panButton.style.border = 'none';
panButton.style.background = '#ffffff';
panButton.style.color = '#333';
panButton.style.fontSize = '15px'; // Increased font size
panButton.style.cursor = 'pointer';
panButton.style.display = 'flex';
panButton.style.alignItems = 'center';
panButton.style.justifyContent = 'center';
panButton.style.gap = '5px';
buttonContainer.appendChild(panButton);

// Add reset position button
const resetPositionButton = document.createElement('button');
resetPositionButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"></path><path d="M12 2v20"></path><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg><span style="margin-left: 10px; font-size: 15px;">Reset Position</span>';
resetPositionButton.style.width = '100%';
resetPositionButton.style.padding = '12px'; // Increased padding
resetPositionButton.style.marginBottom = '15px'; // Increased margin
resetPositionButton.style.background = '#4CAF50';
resetPositionButton.style.color = 'white';
resetPositionButton.style.border = 'none';
resetPositionButton.style.borderRadius = '6px'; // Larger border radius
resetPositionButton.style.cursor = 'pointer';
resetPositionButton.style.display = 'flex';
resetPositionButton.style.alignItems = 'center';
resetPositionButton.style.justifyContent = 'center';
resetPositionButton.style.fontSize = '15px'; // Increased font size
viewControlsContainer.appendChild(resetPositionButton);

// Add instructions with increased font size
const rotatePanInstructionsDiv = document.createElement('div');
rotatePanInstructionsDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M3 5.188C3 2.341 5.22 0 8 0s5 2.342 5 5.188v5.625C13 13.658 10.78 16 8 16s-5-2.342-5-5.188V5.189zm4.5-4.155C5.541 1.289 4 3.035 4 5.188V5.5h3.5zm1 0V5.5H12v-.313c0-2.152-1.541-3.898-3.5-4.154M12 6.5H4v4.313C4 13.145 5.81 15 8 15s4-1.855 4-4.188z"/></svg> <span style="margin-left: 8px;">Click and drag to rotate the manikin</span>';
rotatePanInstructionsDiv.style.fontFamily = 'Roboto, sans-serif';
rotatePanInstructionsDiv.style.fontSize = '15px'; // Increased font size
rotatePanInstructionsDiv.style.margin = '8px 0';
rotatePanInstructionsDiv.style.display = 'flex';
rotatePanInstructionsDiv.style.alignItems = 'center';
rotatePanInstructionsDiv.style.gap = '5px';
rotatePanInstructionsDiv.style.color = '#555';
viewControlsContainer.appendChild(rotatePanInstructionsDiv);

// Function to update instructions based on current mode
function updateInstructions(mode) {
    if (mode === 'rotate') {
        rotatePanInstructionsDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M3 5.188C3 2.341 5.22 0 8 0s5 2.342 5 5.188v5.625C13 13.658 10.78 16 8 16s-5-2.342-5-5.188V5.189zm4.5-4.155C5.541 1.289 4 3.035 4 5.188V5.5h3.5zm1 0V5.5H12v-.313c0-2.152-1.541-3.898-3.5-4.154M12 6.5H4v4.313C4 13.145 5.81 15 8 15s4-1.855 4-4.188z"/></svg> <span style="margin-left: 8px;">Click and drag to rotate the model</span>';
    } else if (mode === 'pan') {
        rotatePanInstructionsDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M3 5.188C3 2.341 5.22 0 8 0s5 2.342 5 5.188v5.625C13 13.658 10.78 16 8 16s-5-2.342-5-5.188V5.189zm4.5-4.155C5.541 1.289 4 3.035 4 5.188V5.5h3.5zm1 0V5.5H12v-.313c0-2.152-1.541-3.898-3.5-4.154M12 6.5H4v4.313C4 13.145 5.81 15 8 15s4-1.855 4-4.188z"/></svg> <span style="margin-left: 8px;">Click and drag to move the model</span>';
    }
}

const zoomInstructionsDiv = document.createElement('div');
zoomInstructionsDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M3.646 9.146a.5.5 0 0 1 .708 0L8 12.793l3.646-3.647a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708m0-2.292a.5.5 0 0 0 .708 0L8 3.207l3.646 3.647a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 0 0 0 .708"/></svg> <span style="margin-left: 8px;">Scroll to zoom in/out</span>';
zoomInstructionsDiv.style.fontFamily = 'Roboto, sans-serif';
zoomInstructionsDiv.style.fontSize = '15px'; // Increased font size
zoomInstructionsDiv.style.margin = '8px 0 20px 0'; // Increased margin
zoomInstructionsDiv.style.display = 'flex';
zoomInstructionsDiv.style.alignItems = 'center';
zoomInstructionsDiv.style.gap = '5px';
zoomInstructionsDiv.style.color = '#555';
viewControlsContainer.appendChild(zoomInstructionsDiv);

// Add status indicator
const statusIndicator = document.createElement('div');
statusIndicator.style.position = 'absolute';
statusIndicator.style.bottom = '25px'; // Adjusted position
statusIndicator.style.left = '25px'; // Adjusted position
statusIndicator.style.padding = '12px'; // Increased padding
statusIndicator.style.background = 'rgba(0, 0, 0, 0.7)';
statusIndicator.style.color = 'white';
statusIndicator.style.borderRadius = '6px'; // Larger border radius
statusIndicator.style.fontFamily = 'Roboto, sans-serif';
statusIndicator.style.fontSize = '16px'; // Increased font size
statusIndicator.style.zIndex = '1000';
statusIndicator.textContent = 'Initializing...';
canvasContainer.appendChild(statusIndicator);

// Variables for interaction
let isDrawing = false;
let isErasing = false;
let isPanningMode = false;
let brushRadius = 15;

// Button event listeners with updated instructions handling
drawButton.addEventListener('click', () => {
    isErasing = false;
    drawButton.style.background = '#0277BD';
    eraseButton.style.background = '#757575';
    statusIndicator.textContent = 'Mode: Drawing';
});

eraseButton.addEventListener('click', () => {
    isErasing = true;
    drawButton.style.background = '#757575';
    eraseButton.style.background = '#d32f2f';
    statusIndicator.textContent = 'Mode: Erasing';
});

resetAllButton.addEventListener('click', () => {
    if (skinMesh && skinMesh.userData.context) {
        const context = skinMesh.userData.context;
        const canvas = skinMesh.userData.canvas;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        skinMesh.userData.texture.needsUpdate = true;
        statusIndicator.textContent = 'Canvas Reset';
    }
});

resetPositionButton.addEventListener('click', () => {
    resetPosition();
});

rotateButton.addEventListener('click', () => {
    isPanningMode = false;
    controls.enableRotate = true;
    controls.enablePan = false;
    rotateButton.style.background = '#E8F5E9';
    panButton.style.background = '#ffffff';
    statusIndicator.textContent = 'Mode: Rotate View';
    updateInstructions('rotate');
});

panButton.addEventListener('click', () => {
    isPanningMode = true;
    controls.enableRotate = false;
    controls.enablePan = true;
    rotateButton.style.background = '#ffffff';
    panButton.style.background = '#E8F5E9';
    statusIndicator.textContent = 'Mode: Pan View';
    updateInstructions('pan');
});

// Brush size slider event listener
brushSizeSlider.addEventListener('input', (event) => {
    brushRadius = parseInt(event.target.value);
    brushSizeValue.textContent = brushRadius;
    statusIndicator.textContent = `Brush Size: ${brushRadius}`;
});

modelSelect.addEventListener('change', (event) => {
    const selectedModel = models.find(model => model.file === event.target.value);
    if (selectedModel) {
        statusIndicator.textContent = `Loading: ${selectedModel.name}...`;
        loadModel(selectedModel.file, selectedModel.name);
    }
});

// Mouse event handling for panning implementation
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Enhanced pan handling
function handlePanning(event) {
    if (!isPanningMode || !isDragging) return;
    
    const deltaX = (event.clientX - previousMousePosition.x);
    const deltaY = (event.clientY - previousMousePosition.y);
    
    previousMousePosition.x = event.clientX;
    previousMousePosition.y = event.clientY;
    
    // Apply model movement directly if in pan mode
    if (model) {
        const speed = 0.003;
        model.position.x += deltaX * speed;
        model.position.y -= deltaY * speed;
    }
}

function getMousePositionForRaycasting(event) {
    const canvasRect = renderer.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
    const mouseY = -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
    return { x: mouseX, y: mouseY };
}

// Update mouse event handlers for both drawing and panning
window.addEventListener('mousedown', (event) => {
    if (!model) return;
    
    // Don't process if clicking UI elements
    if (event.target !== renderer.domElement) return;
    
    if (isPanningMode) {
        isDragging = true;
        previousMousePosition.x = event.clientX;
        previousMousePosition.y = event.clientY;
        return;
    }
    
    const mousePos = getMousePositionForRaycasting(event);
    mouse.x = mousePos.x;
    mouse.y = mousePos.y;
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
        isDrawing = true;
        controls.enabled = false;
        statusIndicator.textContent = isErasing ? 'Erasing...' : 'Drawing...';
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    if (isDrawing) {
        isDrawing = false;
        controls.enabled = true;
        statusIndicator.textContent = isErasing ? 'Mode: Erasing' : 'Mode: Drawing';
    }
});

window.addEventListener('mousemove', (event) => {
    // Handle panning if in pan mode
    if (isPanningMode) {
        handlePanning(event);
        return;
    }
    
    if (!isDrawing || !skinMesh || event.target !== renderer.domElement) return;
    
    const mousePos = getMousePositionForRaycasting(event);
    mouse.x = mousePos.x;
    mouse.y = mousePos.y;
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObject(skinMesh, true);
    if (intersects.length === 0) return;
    
    const uv = intersects[0].uv;
    if (!uv) return;
    
    const canvas = skinMesh.userData.canvas;
    const context = skinMesh.userData.context;
    
    const x = Math.floor(uv.x * canvas.width);
    const y = Math.floor((1 - uv.y) * canvas.height);
    
    context.beginPath();
    context.arc(x, y, brushRadius, 0, 2 * Math.PI);
    context.fillStyle = isErasing ? '#ffffff' : '#9575CD';
    context.fill();
    
    skinMesh.userData.texture.needsUpdate = true;
});

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize
function init() {
    // Start animation
    animate();
    
    // Load model
    loadModel(models[0].file, models[0].name);
    
    // Enable pan mode for controls
    controls.enablePan = false; // Start with rotate mode as default

    updateInstructions('rotate');
    
    // Update status
    statusIndicator.textContent = 'Ready';
    
    // Debug message
    console.log('Application initialized');
}

// Start the application
init();