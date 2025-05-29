export function createScene(canvasContainer) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 1.0, 1.5);
    camera.lookAt(0, 1.0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0xf0f0f0);
    canvasContainer.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight1.position.set(5, 10, 7.5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-10, 10, -10);
    scene.add(dirLight2);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.25;
    controls.maxDistance = 10;
    controls.target.set(0, 1.5, 0);
    controls.enableRotate = false;
    controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: null
    };
    controls.update();

    return { scene, camera, renderer, controls };
}

export function resizeRenderer(camera, renderer, container) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Update camera aspect ratio
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    
    // Handle orientation changes on mobile
    if (window.innerWidth <= 768) {
        // Adjust camera for portrait mode on mobile
        if (window.innerHeight > window.innerWidth) {
            // In portrait mode, we might need to adjust the camera position
            // to ensure the model is fully visible
            camera.position.z = Math.max(1.5, 2.0); // Increase distance
        } else {
            // In landscape, we can use a value closer to desktop
            camera.position.z = 1.5;
        }
    }
}
