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
                if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                    const positionCount = child.geometry.attributes.position.count;
        
                    // Ensure the geometry is indexed
                    if (!child.geometry.index) {
                        child.geometry = THREE.BufferGeometryUtils.mergeVertices(child.geometry);
                        child.geometry.computeVertexNormals();
                    }
        
                    // Ensure the `color` attribute exists
                    if (!child.geometry.attributes.color) {
                        const colorArray = new Float32Array(positionCount * 3);
                        for (let i = 0; i < colorArray.length; i += 3) {
                            colorArray[i] = 1;     // R (white)
                            colorArray[i + 1] = 1; // G (white)
                            colorArray[i + 2] = 1; // B (white)
                        }
                        child.geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
                    }
                    child.material.vertexColors = true;
        
                    // console.log(`Mesh "${child.name}" has ${child.geometry.index.count / 3} faces`);
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
let selectedFaces = new Set(); // Track the currently selected face

raycaster.params.Points.threshold = 0.1;

// Event listener for mouse clicks
window.addEventListener('click', (event) => {
    // Update mouse coordinates in normalized device space
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Only run raycasting if the model is loaded
    if (!model) return;

    // Set raycaster based on mouse position and camera
    raycaster.setFromCamera(mouse, camera);

    // Perform raycasting on the model
    const intersects = raycaster.intersectObject(model, true); // 'true' to include children

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const faceIndex = intersect.faceIndex;

        // If the face is already selected, deselect it
        if (selectedFaces.has(faceIndex)) {
            deselectFace(intersect);
        } else {
            // Highlight the selected face
            selectFace(intersect);
        }
    } else {
        console.log("No intersection detected");
    }
});

// Function to select a face
function selectFace(intersect) {
    const geometry = intersect.object.geometry;

    if (geometry && geometry.index && geometry.attributes.color) {
        const faceIndex = intersect.faceIndex;
        selectedFaces.add(faceIndex);

        const colors = geometry.attributes.color.array;
        const vertexIndices = [
            geometry.index.array[faceIndex * 3],
            geometry.index.array[faceIndex * 3 + 1],
            geometry.index.array[faceIndex * 3 + 2],
        ];

        // Change the colors of the vertices of the selected face
        vertexIndices.forEach((vertexIndex) => {
            colors[vertexIndex * 3] = 0; // R
            colors[vertexIndex * 3 + 1] = 0; // G
            colors[vertexIndex * 3 + 2] = 1; // B
        });

        geometry.attributes.color.needsUpdate = true;
    } else {
        console.error("Invalid geometry or color attributes for face selection");
    }
}

// Function to deselect a face
function deselectFace(intersect) {
    const geometry = intersect.object.geometry;

    if (geometry && geometry.index && geometry.attributes.color) {
        const faceIndex = intersect.faceIndex;
        selectedFaces.delete(faceIndex);

        const colors = geometry.attributes.color.array;
        const vertexIndices = [
            geometry.index.array[faceIndex * 3],
            geometry.index.array[faceIndex * 3 + 1],
            geometry.index.array[faceIndex * 3 + 2],
        ];

        // Reset the colors of the vertices of the deselected face to white
        vertexIndices.forEach((vertexIndex) => {
            colors[vertexIndex * 3] = 1; // R
            colors[vertexIndex * 3 + 1] = 1; // G
            colors[vertexIndex * 3 + 2] = 1; // B
        });

        geometry.attributes.color.needsUpdate = true;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Update controls every frame
    renderer.render(scene, camera);
}
animate();