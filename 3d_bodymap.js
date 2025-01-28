// Create the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.background = new THREE.Color(0xf0f0f0);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 2); // Slightly less intense than the main light
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
                child.material.needsUpdate = true;

                // Store canvas and context for painting
                child.userData.canvas = canvas;
                child.userData.context = context;
                child.userData.texture = texture;
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
brushRadiusSlider.max = '20';
brushRadiusSlider.step = '5';
brushRadiusSlider.value = '5';

// Append the label and slider to the container
uiContainer.appendChild(label);
uiContainer.appendChild(brushRadiusSlider);
uiContainer.appendChild(brushRadiusValue);

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

// Event listener for toggling erase mode (e.g., with the "E" key)
window.addEventListener('keydown', (event) => {
    if (event.key === 'e' || event.key === 'E') {
        isErasing = !isErasing; // Toggle erase mode
        console.log(`Erase mode: ${isErasing ? 'ON' : 'OFF'}`);
    }
});

// Update brushRadius when the slider value changes
brushRadiusSlider.addEventListener('input', (event) => {
    brushRadius = parseFloat(event.target.value);
    brushRadiusValue.textContent = brushRadius.toFixed(1); // Update the displayed value
});

// Event listener for mouse move (paint while moving)
window.addEventListener('mousemove', (event) => {
    if (!isDrawing || !model) return;

    // Update mouse coordinates in normalized device space
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Set raycaster based on mouse position and camera
    raycaster.setFromCamera(mouse, camera);

    // Perform raycasting on the model
    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const uv = intersect.uv;
        const object = intersect.object;

        if (object.userData.context) {
            const context = object.userData.context;
            const canvas = object.userData.canvas;

            // Convert UV coordinates to canvas coordinates
            const x = Math.floor(uv.x * canvas.width);
            const y = Math.floor((1 - uv.y) * canvas.height); // Flip Y-axis

            // Draw on the canvas
            context.beginPath();
            context.arc(x, y, brushRadius, 0, 2 * Math.PI);
            context.fillStyle = isErasing ? '#ffffff' : '#9575CD'; // Erase to white or paint red
            context.fill();

            // Update the texture
            object.userData.texture.needsUpdate = true;
        }
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Update controls every frame
    renderer.render(scene, camera);
}
animate();
