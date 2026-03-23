import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import AppState from '../app/state.js';
import texturePool from '../utils/textureManager.js';

const loader = new GLTFLoader();

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
    if (!material) return;

    for (const prop in material) {
        try {
            const value = material[prop];
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
        } catch (e) {
            console.warn(`Error disposing material property ${prop}:`, e);
        }
    }

    if (typeof material.dispose === 'function') {
        material.dispose();
    }
}

function cleanupModel(model) {
    if (!model) return;
    model.traverse(disposeNode);
}

export function loadModel(path, name, scene, controls, onLoaded = () => {}) {
    const thisRequest = { cancelled: false };

    if (currentLoadingRequest) {
        currentLoadingRequest.cancelled = true;
    }

    currentLoadingRequest = thisRequest;

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

                    if (child.name === 'Human') {
                        skinMesh = child;
                        child.renderOrder = 0;

                        const textureId = `model-${name}-skin`;
                        const { canvas, context, texture } = texturePool.getTexture(textureId);

                        // Upload AO texture
                        const aoTexture = new THREE.TextureLoader().load('../assets/body_ao_modified.png');
                        aoTexture.flipY = false;

                        child.material = new THREE.MeshLambertMaterial({
                            map: texture,
                            aoMap: aoTexture,
                            aoMapIntensity: 1.0,
                            transparent: true,
                            opacity: 1.0,
                            color: 0xdddddd,
                            emissive: 0x333333,
                            emissiveIntensity: 1.0
                        });

                        // Region visibility shader
                        child.material.onBeforeCompile = (shader) => {
                            shader.uniforms.visibleIds = { value: new Float32Array(512).fill(-1) };
                            shader.uniforms.visibleCount = { value: 0 };
                            shader.uniforms.filterActive = { value: false };

                            shader.vertexShader = shader.vertexShader.replace(
                                '#include <common>',
                                `#include <common>
                                 attribute float _regionid;
                                 uniform float visibleIds[512];
                                 uniform int visibleCount;
                                 uniform bool filterActive;
                                 flat varying float vRegionId;
                                 varying float vVisibility;`
                            );
                            shader.vertexShader = shader.vertexShader.replace(
                                '#include <begin_vertex>',
                                `#include <begin_vertex>
                                 vRegionId = _regionid;
                                 vVisibility = 0.0;
                                 if (filterActive) {
                                     for (int i = 0; i < 512; i++) {
                                         if (i >= visibleCount) break;
                                         if (abs(_regionid - visibleIds[i]) < 0.5) {
                                             vVisibility = 1.0;
                                             break;
                                         }
                                     }
                                 } else {
                                     vVisibility = 1.0;
                                 }`
                            );

                            shader.fragmentShader = shader.fragmentShader.replace(
                                '#include <common>',
                                `#include <common>
                                 uniform bool filterActive;
                                 flat varying float vRegionId;
                                 varying float vVisibility;`
                            );
                            shader.fragmentShader = shader.fragmentShader.replace(
                                '#include <dithering_fragment>',
                                `#include <dithering_fragment>
                                 if (filterActive) {
                                     if (vVisibility < 0.05) {
                                         discard;
                                     } else if (vVisibility < 0.95) {
                                         gl_FragColor.a *= smoothstep(0.05, 0.95, vVisibility);
                                     }
                                 }`
                            );

                            child.userData.regionShader = shader;
                        };

                        child.geometry.setAttribute('uv2', child.geometry.getAttribute('uv'));
                        child.material.needsUpdate = true;
                        child.userData = {
                            canvas,
                            context,
                            texture,
                            textureId
                        };

                        AppState.skinMesh = skinMesh;
                    }

                    if (['Top', 'Shorts'].includes(child.name)) {
                        child.renderOrder = 1;
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.5;
                        child.material.side = THREE.DoubleSide;
                        child.material.depthWrite = false;
                        child.material.needsUpdate = true;
                    }

                    if (child.name === 'Hair') {
                        child.renderOrder = 2;
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.5;
                        child.material.side = THREE.DoubleSide;
                        child.material.depthWrite = false;
                        child.material.needsUpdate = true;
                    }
                });

                controls.target.set(model.position.x, model.position.y + height / 2, model.position.z);
                controls.update();

                AppState.model = model;
                AppState.currentModelName = name;

                const { canvas: baseCanvas, context: baseCtx, texture: baseTexture } = texturePool.getTexture(`base-texture-${name}`);
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

                if (xhr.lengthComputable) {
                    const percentComplete = (xhr.loaded / xhr.total) * 100;
                    updateLoadingProgress(percentComplete);
                } else {
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
    hideLoadingProgress();

    const progressContainer = document.createElement('div');
    progressContainer.id = 'loading-progress-container';
    progressContainer.innerHTML = `
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
