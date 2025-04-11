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
controls.minDistance = 0.5;
controls.maxDistance = 10;
controls.target.set(0, 1.5, 0);
controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: null
};
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
    
    // Create a loading spinner element
    const loadingContainer = document.createElement('div');
    loadingContainer.id = 'loading-container';
    loadingContainer.style.position = 'absolute';
    loadingContainer.style.top = '50%';
    loadingContainer.style.left = '50%';
    loadingContainer.style.transform = 'translate(-50%, -50%)';
    loadingContainer.style.display = 'flex';
    loadingContainer.style.flexDirection = 'column';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.justifyContent = 'center';
    loadingContainer.style.zIndex = '1000';
    
    // Create spinner
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.border = '5px solid rgba(255, 255, 255, 0.3)';
    spinner.style.borderRadius = '50%';
    spinner.style.borderTop = '5px solid #0277BD';
    spinner.style.animation = 'spin 1s linear infinite';
    loadingContainer.appendChild(spinner);
    
    // Create loading text
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading...';
    loadingText.style.marginTop = '15px';
    loadingText.style.color = '#333';
    loadingText.style.fontFamily = 'Roboto, sans-serif';
    loadingText.style.fontSize = '18px';
    loadingText.style.fontWeight = 'bold';
    loadingContainer.appendChild(loadingText);
    
    // Add spinner animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Add loading container to the document
    document.body.appendChild(loadingContainer);
    
    console.log(`Loading model: ${modelPath}`);
    
    // Update status indicator
    statusIndicator.textContent = `Loading: ${modelName}...`;
    
    const loader = new THREE.GLTFLoader();
    loader.load(
        modelPath,
        (gltf) => {
            console.log(`Successfully loaded model: ${modelPath}`);
            document.body.removeChild(loadingContainer); // Remove loading indicator
            
            model = gltf.scene;
            model.position.y = 0; // Start at 0 and let's compute a better position
            
            // Get model dimensions to help with centering
            let boundingBox = new THREE.Box3().setFromObject(model);
            let modelHeight = boundingBox.max.y - boundingBox.min.y;
            
            // Position model to be centered vertically in the viewport
            // The value 1.0 is our target center point (from camera settings)
            model.position.y = 1.0 - modelHeight/2;
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

            currentModelName = modelName;
            console.log(`Current model: ${currentModelName}`);
        },
        (xhr) => {
            console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`);
        },
        (error) => {
            document.body.removeChild(loadingContainer);
            console.error("Error loading model: ", error);
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
appContainer.id = 'app-container';
appContainer.style.display = 'flex';
appContainer.style.position = 'absolute';
appContainer.style.top = '0';
appContainer.style.left = '0';
appContainer.style.width = '100%';
appContainer.style.height = '100%';
appContainer.style.background = '#F0F0F0';
document.body.appendChild(appContainer);

// Left-side UI panel
const uiPanel = document.createElement('div');
uiPanel.id = 'ui-panel';
uiPanel.style.background = 'transparent';
uiPanel.style.display = 'flex';
uiPanel.style.flexDirection = 'column';
uiPanel.style.padding = '20px';
uiPanel.style.justifyContent = "space-around";
uiPanel.style.overflowY = 'auto';
appContainer.appendChild(uiPanel);

// Right-side canvas panel
const canvasPanel = document.createElement('div');
canvasPanel.id = 'canvas-panel';
canvasPanel.style.flexGrow = '1';
canvasPanel.style.position = 'relative';
canvasPanel.style.overflow = 'hidden';
appContainer.appendChild(canvasPanel);

// Add renderer to canvasPanel
canvasPanel.appendChild(renderer.domElement);

// Create UI container
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '20px'; // Increased margin
uiContainer.style.left = '20px'; // Increased margin
uiContainer.style.display = 'flex';
uiContainer.style.flexDirection = 'column';
uiContainer.style.gap = '20px'; // Increased gap between containers
uiContainer.style.zIndex = '1000';
uiPanel.appendChild(uiContainer);

// Create drawing controls
const drawingControlsContainer = document.createElement('div');
drawingControlsContainer.style.background = 'rgba(255, 255, 255, 0.9)';
drawingControlsContainer.style.padding = '20px'; // Increased padding
drawingControlsContainer.style.borderRadius = '10px'; // Larger border radius
drawingControlsContainer.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';
drawingControlsContainer.style.width = '240px'; // Slightly wider
uiPanel.appendChild(drawingControlsContainer);

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
uiPanel.appendChild(viewControlsContainer);

// Add title
const viewTitle = document.createElement('h3');
viewTitle.textContent = 'View Controls';
viewTitle.style.margin = '0 0 15px 0'; // Increased margin
viewTitle.style.fontFamily = 'Roboto, sans-serif';
viewTitle.style.fontSize = '22px'; // Further increased font size
viewTitle.style.fontWeight = 'bold';
viewTitle.style.textAlign = 'center';
viewControlsContainer.appendChild(viewTitle);

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
rotatePanInstructionsDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M3 5.188C3 2.341 5.22 0 8 0s5 2.342 5 5.188v5.625C13 13.658 10.78 16 8 16s-5-2.342-5-5.188V5.189zm4.5-4.155C5.541 1.289 4 3.035 4 5.188V5.5h3.5zm1 0V5.5H12v-.313c0-2.152-1.541-3.898-3.5-4.154M12 6.5H4v4.313C4 13.145 5.81 15 8 15s4-1.855 4-4.188z"/></svg> <span style="margin-left: 8px;">Click arrows to rotate the model</span>';
rotatePanInstructionsDiv.style.fontFamily = 'Roboto, sans-serif';
rotatePanInstructionsDiv.style.fontSize = '15px'; // Increased font size
rotatePanInstructionsDiv.style.margin = '8px 0';
rotatePanInstructionsDiv.style.display = 'flex';
rotatePanInstructionsDiv.style.alignItems = 'center';
rotatePanInstructionsDiv.style.gap = '5px';
rotatePanInstructionsDiv.style.color = '#555';
viewControlsContainer.appendChild(rotatePanInstructionsDiv);

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
uiPanel.appendChild(statusIndicator);

// Variables for interaction
let isDrawing = false;
let isErasing = false;
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

const arrowContainer = document.createElement('div');
arrowContainer.style.position = 'absolute';
arrowContainer.style.top = '0';
arrowContainer.style.left = '0';
arrowContainer.style.width = '100%';
arrowContainer.style.height = '100%';
arrowContainer.style.pointerEvents = 'none';
arrowContainer.style.zIndex = '900';
arrowContainer.style.pointerEvents = 'none'; // allows click-through

function getArrowSymbol(direction) {
    switch (direction) {
        case 'up': return '↑';
        case 'down': return '↓';
        case 'left': return '←';
        case 'right': return '→';
        default: return '';
    }
}

['up', 'down', 'left', 'right'].forEach(dir => {
    const btn = document.createElement('button');
    btn.innerHTML = getArrowSymbol(dir); // e.g. ↑ ↓ ← →
    btn.className = `arrow-btn arrow-${dir}`;
    btn.style.position = 'absolute';
    btn.style.pointerEvents = 'auto'; // clickable
    btn.style.width = '48px';
    btn.style.height = '48px';
    btn.style.fontSize = '24px';
    btn.style.fontWeight = 'bold';
    btn.style.fontFamily = 'Roboto, sans-serif';
    btn.style.background = 'rgba(0,0,0,0.5)';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '50%';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
        moveCamera(dir, 'rotate');
    });
    arrowContainer.appendChild(btn);
});
canvasPanel.appendChild(arrowContainer);

arrowContainer.style.position = 'absolute';
arrowContainer.style.top = '0';
arrowContainer.style.left = '0';
arrowContainer.style.width = '100%';
arrowContainer.style.height = '100%';
arrowContainer.style.pointerEvents = 'none'; // container doesn't block clicks
arrowContainer.style.zIndex = '900';

arrowContainer.querySelector('.arrow-up').style.left = `calc(50%)`;
arrowContainer.querySelector('.arrow-up').style.top = '7%';
arrowContainer.querySelector('.arrow-up').style.transform = 'translateX(-50%)';

arrowContainer.querySelector('.arrow-down').style.left = `calc(50%)`;
arrowContainer.querySelector('.arrow-down').style.bottom = '7%';
arrowContainer.querySelector('.arrow-down').style.transform = 'translateX(-50%)';

arrowContainer.querySelector('.arrow-left').style.left = 'calc(10%)';
arrowContainer.querySelector('.arrow-left').style.top = '50%';
arrowContainer.querySelector('.arrow-left').style.transform = 'translateY(-50%)';

arrowContainer.querySelector('.arrow-right').style.right = '10%';
arrowContainer.querySelector('.arrow-right').style.top = '50%';
arrowContainer.querySelector('.arrow-right').style.transform = 'translateY(-50%)';


function moveCamera(direction, mode = 'rotate') {
    const rotateAmount = Math.PI / 6;  // ~30 degrees
    const pivot = controls.target.clone();
    const directionToCamera = camera.position.clone().sub(pivot);

    let axis = new THREE.Vector3();
    switch (direction) {
        case 'left':  axis.copy(camera.up); break;
        case 'right': axis.copy(camera.up).negate(); break;
        case 'up':
        case 'down':
            // Sideways axis for vertical orbit
            axis.copy(panRight);
            if (direction === 'down') axis.negate();
            break;
    }

    directionToCamera.applyAxisAngle(axis, rotateAmount);
    camera.position.copy(pivot.clone().add(directionToCamera));
    camera.lookAt(pivot);

    controls.update();
}


function getMousePositionForRaycasting(event) {
    const canvasRect = renderer.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
    const mouseY = -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
    return { x: mouseX, y: mouseY };
}

function getModelScreenPosition() {
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(model).getCenter(center);
    
    const projected = center.clone().project(camera);
    const x = (projected.x + 1) / 2 * window.innerWidth;
    const y = (-projected.y + 1) / 2 * window.innerHeight;

    return { x, y };
}

window.addEventListener('mousedown', (event) => {
    if (!model) return;
    
    // Don't process if clicking UI elements
    if (event.target !== renderer.domElement) return;
        
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
    updateCanvasSize();
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function updateCanvasSize() {
    const canvasPanel = document.getElementById('canvas-panel');
    const width = canvasPanel.clientWidth;
    const height = canvasPanel.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Initialize
function init() {
    updateCanvasSize();
    // Start animation
    animate();
    
    // Load model
    loadModel(models[0].file, models[0].name);
    
    controls.enableRotate = false;
    
    // Update status
    statusIndicator.textContent = 'Ready';
    
    // Debug message
    console.log('Application initialized');
}

renderer.domElement.addEventListener('dblclick', (event) => {
    if (!model) return;

    // Get normalized device coordinates (-1 to +1) for raycasting
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouseVec = new THREE.Vector2(mouseX, mouseY);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseVec, camera);

    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
        const point = intersects[0].point;

        // Move camera halfway toward the clicked point
        const direction = new THREE.Vector3().subVectors(point, camera.position).normalize();
        const distance = camera.position.distanceTo(point);
        const zoomFactor = 0.4;  // Lower = stronger zoom

        const newPosition = camera.position.clone().add(direction.multiplyScalar(distance * zoomFactor));
        camera.position.copy(newPosition);
        controls.target.copy(point);

        controls.update();
        statusIndicator.textContent = 'Zoomed to selection';
    }
});


// Start the application
init();