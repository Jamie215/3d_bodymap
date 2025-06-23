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
    controls.maxDistance = 10;
    controls.target.set(0, 1.5, 0);
    controls.enableRotate = false;
    controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: null
    };
    controls.update();
    controls.addEventListener('change', () => {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        const modelForward = new THREE.Vector3(0,0,1);
        const alignment = cameraDirection.dot(modelForward);

        const safeAlignment = Math.abs(alignment) < 0.1 ? 0 : alignment;

        if (safeAlignment === 0) {
            controls.minDistance = 0.5;
        } else {
            controls.minDistance = 0.25;
        }
    })

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
}
