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
        showLoadingProgress(0);
    }

    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (gltf) => {
                if (thisRequest.cancelled) return;
                hideLoadingProgress();

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
            (xhr) => {
                if (thisRequest.cancelled) return;
                
                // Calculate progress percentage
                if (xhr.lengthComputable) {
                    const percentComplete = (xhr.loaded / xhr.total) * 100;
                    updateLoadingProgress(percentComplete);
                } else {
                    // If we can't determine exact progress, show bytes loaded
                    const mbLoaded = (xhr.loaded / 1024 / 1024).toFixed(2);
                    updateLoadingProgress(null, mbLoaded);
                }
            },
            (err) => {
                if (thisRequest.cancelled) return;
                hideLoadingProgress();
                console.error("Model loading error: ", err);
                reject(err);
            }
        );
    });
}

function showLoadingProgress(percentage = 0) {
    // Remove any existing progress indicator first
    hideLoadingProgress();
    
    const progressContainer = document.createElement('div');
    progressContainer.id = 'loading-progress-container';
    progressContainer.innerHTML = `
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            
            #loading-progress-container {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 1000;
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                min-width: 300px;
            }
            
            .progress-title {
                color: #333;
                font-family: Inter, sans-serif;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
                text-align: center;
            }
            
            .progress-bar-container {
                width: 100%;
                height: 24px;
                background: #e0e0e0;
                border-radius: 12px;
                overflow: hidden;
                position: relative;
            }
            
            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #0277BD, #029ffd);
                border-radius: 12px;
                transition: width 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .progress-bar::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                right: 0;
                background: linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0),
                    rgba(255, 255, 255, 0.3),
                    rgba(255, 255, 255, 0)
                );
                animation: shimmer 2s infinite;
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            .progress-text {
                color: #666;
                font-family: Inter, sans-serif;
                font-size: 14px;
                text-align: center;
                margin-top: 10px;
            }
            
            .progress-percentage {
                font-weight: 600;
                color: var(--primary-color);
            }
            
            .loading-dots {
                display: inline-block;
                animation: pulse 1.5s infinite;
            }
        </style>
        <div class="progress-title">Loading 3D Model</div>
        <div class="progress-bar-container">
            <div class="progress-bar" id="progress-bar" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-text" id="progress-text">
            <span class="progress-percentage">${percentage.toFixed(1)}%</span> complete
        </div>`;
    
    document.body.appendChild(progressContainer);
}

function updateLoadingProgress(percentage, mbLoaded = null) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (!progressBar || !progressText) return;
    
    if (percentage !== null) {
        // We have a percentage
        progressBar.style.width = `${percentage}%`;
        
        if (percentage >= 100) {
            progressText.innerHTML = `
                <span class="progress-percentage">Loading</span>
                <span class="loading-dots">...</span>`;
        } else {
            progressText.innerHTML = `
                <span class="progress-percentage">${percentage.toFixed(1)}%</span> complete`;
        }
    } else if (mbLoaded !== null) {
        // We only have bytes loaded (no total size available)
        // Show indeterminate progress with MB loaded
        progressBar.style.width = '50%';
        progressBar.style.animation = 'pulse 1.5s infinite';
        progressText.innerHTML = `
            <span class="progress-percentage">${mbLoaded} MB</span> loaded
            <span class="loading-dots">...</span>`;
    }
}

function hideLoadingProgress() {
    const el = document.getElementById('loading-progress-container');
    if (el) {
        // Add a fade-out animation before removing
        el.style.transition = 'opacity 0.3s';
        el.style.opacity = '0';
        setTimeout(() => {
            if (el.parentNode) {
                document.body.removeChild(el);
            }
        }, 300);
    }
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