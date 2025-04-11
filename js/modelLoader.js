import AppState from './state.js';

const loader = new THREE.GLTFLoader();

// Track the current loading request
let currentLoadingRequest = null;

export function loadModel(path, name, scene, controls, onLoaded = () => {}) {
    // Cancel any previous loading by tracking the current request
    const thisRequest = { cancelled: false };
    
    // If there was a previous request, mark it as cancelled
    if (currentLoadingRequest) {
        currentLoadingRequest.cancelled = true;
    }
    
    // Set this as the current request
    currentLoadingRequest = thisRequest;
    
    // Function to clean up the previous model
    const cleanupPreviousModel = () => {
        if (AppState.model) {
            scene.remove(AppState.model);
            AppState.model.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            AppState.model = null;
            AppState.skinMesh = null;
        }
    };

    // Only show loading spinner if not cancelled
    if (!thisRequest.cancelled) {
        showLoadingSpinner();
        cleanupPreviousModel();
    }

    loader.load(path, 
        // Success callback
        (gltf) => {
            // If this request was cancelled, don't proceed
            if (thisRequest.cancelled) {
                return;
            }
            
            hideLoadingSpinner();

            const model = gltf.scene;
            const bbox = new THREE.Box3().setFromObject(model);
            const height = bbox.max.y - bbox.min.y;

            model.position.y = 1.0 - height / 2;
            scene.add(model);

            let skinMesh = null;

            model.traverse((child) => {
                if (!child.isMesh) return;

                if (child.name === 'Hair') return;

                if (child.name === 'Human') {
                    skinMesh = child;
                    const canvas = document.createElement('canvas');
                    canvas.width = canvas.height = 1024;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    const tex = new THREE.CanvasTexture(canvas);
                    child.material = child.material.clone();
                    child.material.map = tex;
                    child.material.needsUpdate = true;

                    child.userData = { canvas, context: ctx, texture: tex };
                }

                if (['Top', 'Shorts'].includes(child.name)) {
                    child.material = child.material.clone();
                    child.material.transparent = true;
                    child.material.opacity = 0.6;
                    child.material.needsUpdate = true;
                }
            });

            controls.target.set(model.position.x, model.position.y + height / 2, model.position.z);
            controls.update();

            AppState.model = model;
            AppState.skinMesh = skinMesh;
            AppState.currentModelName = name;

            console.log(`Loaded model: ${name}`);
            
            // Only call onLoaded if this request wasn't cancelled
            if (!thisRequest.cancelled) {
                onLoaded();
            }
        },
        // Progress callback
        (xhr) => {
            // Optional: you could update a progress bar here
            // if (xhr.lengthComputable) {
            //     const percentComplete = xhr.loaded / xhr.total * 100;
            //     updateProgressBar(percentComplete);
            // }
        },
        // Error callback
        (err) => {
            // If this request was cancelled, don't show the error
            if (thisRequest.cancelled) {
                return;
            }
            
            hideLoadingSpinner();
            console.error("Model loading error:", err);
        }
    );
    
    // Return a function that can be used to cancel this specific load request
    return () => {
        thisRequest.cancelled = true;
    };
}

function showLoadingSpinner() {
    // Remove any existing spinner first
    hideLoadingSpinner();
    
    const spinner = document.createElement('div');
    spinner.id = 'loading-container';
    spinner.innerHTML = `
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
        <div style="
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            display: flex; flex-direction: column; align-items: center;
            z-index: 1000;">
            <div style="
                width: 50px; height: 50px;
                border: 5px solid rgba(255,255,255,0.3);
                border-top: 5px solid #0277BD;
                border-radius: 50%;
                animation: spin 1s linear infinite;"></div>
            <div style="
                margin-top: 15px; color: #333;
                font-family: Inter, sans-serif; font-size: 18px; font-weight: bold;">
                Loading...
            </div>
        </div>`;
    document.body.appendChild(spinner);
}

function hideLoadingSpinner() {
    const el = document.getElementById('loading-container');
    if (el) document.body.removeChild(el);
}