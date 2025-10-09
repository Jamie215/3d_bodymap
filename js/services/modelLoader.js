import AppState from '../app/state.js';
import texturePool from '../utils/textureManager.js'

const loader = new THREE.GLTFLoader();

// Track the current loading request
let currentLoadingRequest = null;

function disposeNode(node) {
    if (node.geometry) {
        node.geometry.dispose();
    }

    if (node.material) {
        if (Array.isArray(node.material)) {
            node.material.forEach(material => disposeMaterial(material));
        } else {
            disposeMaterial(node.material);
        }
    }

    if (node.userData && node.userData.texture) {
        node.userData.texture.dispose();
    }
}

function disposeMaterial(material) {
    // Skip if material is null or undefined
    if (!material) return;
    
    // Dispose textures and other disposable properties
    for (const prop in material) {
        try {
            const value = material[prop];
            // Only try to dispose if the value has a dispose function
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
        } catch (e) {
            console.warn(`Error disposing material property ${prop}:`, e);
        }
    }
    
    // Finally dispose the material itself
    if (typeof material.dispose === 'function') {
        material.dispose();
    }
}

// Clean up a model and its resources
function cleanupModel(model) {
    if (!model) return;
    
    // Traverse the model to dispose all resources
    model.traverse(disposeNode);
}

export function loadModel(path, name, scene, controls, onLoaded = () => {}) {
    // Cancel any previous loading by tracking the current request
    const thisRequest = { cancelled: false };
    
    // If there was a previous request, mark it as cancelled
    if (currentLoadingRequest) {
        currentLoadingRequest.cancelled = true;
    }
    
    // Set this as the current request
    currentLoadingRequest = thisRequest;

    // Only show loading spinner if not cancelled
    if (!thisRequest.cancelled) {
        showLoadingSpinner();
    }

    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (gltf) => {
                if (thisRequest.cancelled) return;
                hideLoadingSpinner();

                // Clean up previous model
                if (AppState.model) {
                    scene.remove(AppState.model);
                    cleanupModel(AppState.model);

                    if (AppState.skinMesh?.userData?.textureId) {
                        texturePool.releaseTexture(AppState.skinMesh.userData.textureId);
                    }

                    AppState.model = null;
                    AppState.skinMesh = null;
                }

                // Add new model
                const model = gltf.scene;
                const bbox = new THREE.Box3().setFromObject(model);
                const height = bbox.max.y - bbox.min.y;

                model.position.y = 1.0 - height / 2;
                scene.add(model);

                let skinMesh = null;

                model.traverse((child) => {
                    if (!child.isMesh) return;

                    if (child.name === 'Hair') {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.4;
                        child.material.needsUpdate = true;
                    }

                    if (child.name === 'Human') {
                        skinMesh = child;

                        const textureId = `model-${name}-skin`;
                        const { canvas, context, threeTexture } = texturePool.getTexture(textureId);
                        
                        child.material = child.material.clone();
                        child.material.map = threeTexture;
                        child.material.transparent = true;
                        child.material.opacity = 0.75;
                        child.material.needsUpdate = true;
                        child.userData = { 
                            canvas, 
                            context, 
                            texture: threeTexture, 
                            textureId 
                        };

                        AppState.skinMesh = skinMesh;
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
                AppState.currentModelName = name;

                const { canvas: baseCanvas, context: baseCtx, threeTexture: baseTexture } = texturePool.getTexture(`base-texture-${name}`);
                baseCtx.fillStyle = '#ffffff';
                baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

                AppState.baseTextureCanvas = baseCanvas;
                AppState.baseTextureContext = baseCtx;
                AppState.baseTextureTexture = baseTexture;

                console.log(`Loaded model: ${name}`);
                
                resolve(skinMesh);
            },
            undefined,
            (err) => {
                if (thisRequest.cancelled) return;
                hideLoadingSpinner();
                console.error("Model loading error: ", err);
                reject(err);
            }
        );
    });
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

export function cleanupAllModels() {
    if (AppState.model) {
        cleanupModel(AppState.model);
        AppState.model = null;
        AppState.skinMesh = null;
    }

    if (typeof texturePool !== 'undefined') {
        texturePool.disposeAll();
    }
}