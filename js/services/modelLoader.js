// modelLoader.js
// GLTF model loading, material setup, and cleanup.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import AppState from '../app/state.js';
import texturePool from './texturePool.js';
import { showLoadingProgress, updateLoadingProgress, hideLoadingProgress } from '../components/loadingIndicator.js';

const loader = new GLTFLoader();

// Track the current loading request so we can cancel on model switch
let currentLoadingRequest = null;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Load a GLTF model, configure materials, and register it in AppState.
 *
 * @param {string}        path     — URL to the .glb file
 * @param {string}        name     — display name for the model
 * @param {THREE.Scene}   scene
 * @param {OrbitControls} controls
 * @returns {Promise<THREE.Mesh>}  — resolves with the skin mesh
 */
export function loadModel(path, name, scene, controls) {
    const thisRequest = { cancelled: false };

    if (currentLoadingRequest) currentLoadingRequest.cancelled = true;
    currentLoadingRequest = thisRequest;

    if (!thisRequest.cancelled) showLoadingProgress(0);

    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (gltf) => {
                if (thisRequest.cancelled) return;
                hideLoadingProgress();

                cleanupPreviousModel(scene);

                const model = gltf.scene;
                const bbox   = new THREE.Box3().setFromObject(model);
                const height = bbox.max.y - bbox.min.y;

                model.position.y = 1.0 - height / 2;
                scene.add(model);

                let skinMesh = null;

                model.traverse((child) => {
                    if (!child.isMesh) return;

                    if (child.name === 'Human') {
                        skinMesh = child;
                        setupSkinMesh(child, name);
                    }

                    if (['Top', 'Shorts'].includes(child.name)) {
                        setupTransparentMesh(child, 1);
                    }

                    if (child.name === 'Hair') {
                        setupTransparentMesh(child, 2);
                    }
                });

                controls.target.set(model.position.x, model.position.y + height / 2, model.position.z);
                controls.update();

                AppState.model            = model;
                AppState.currentModelName = name;

                setupBaseTexture(name);

                console.log(`Loaded model: ${name}`);
                resolve(skinMesh);
            },
            (xhr) => {
                if (thisRequest.cancelled) return;
                if (xhr.lengthComputable) {
                    updateLoadingProgress((xhr.loaded / xhr.total) * 100);
                } else {
                    updateLoadingProgress(null, (xhr.loaded / 1024 / 1024).toFixed(2));
                }
            },
            (err) => {
                if (thisRequest.cancelled) return;
                hideLoadingProgress();
                console.error('Model loading error:', err);
                reject(err);
            }
        );
    });
}

/** Dispose all models and textures. Call on app shutdown. */
export function cleanupAllModels() {
    if (AppState.model) {
        cleanupModel(AppState.model);
        AppState.model    = null;
        AppState.skinMesh = null;
    }
    if (typeof texturePool !== 'undefined') {
        texturePool.disposeAll();
    }
}

// ============================================================================
// INTERNAL — CLEANUP
// ============================================================================

function cleanupPreviousModel(scene) {
    if (!AppState.model) return;

    scene.remove(AppState.model);
    cleanupModel(AppState.model);

    if (AppState.skinMesh?.userData?.textureId) {
        texturePool.releaseTexture(AppState.skinMesh.userData.textureId);
    }

    AppState.model    = null;
    AppState.skinMesh = null;
}

function cleanupModel(model) {
    if (!model) return;
    model.traverse(disposeNode);
}

function disposeNode(node) {
    if (node.geometry) node.geometry.dispose();

    if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(disposeMaterial);
    }

    if (node.userData?.texture) node.userData.texture.dispose();
}

function disposeMaterial(material) {
    if (!material) return;
    for (const prop in material) {
        try {
            const value = material[prop];
            if (value && typeof value.dispose === 'function') value.dispose();
        } catch (e) { /* ignore */ }
    }
    if (typeof material.dispose === 'function') material.dispose();
}

// ============================================================================
// INTERNAL — MATERIAL SETUP
// ============================================================================

function setupSkinMesh(child, modelName) {
    child.renderOrder = 0;

    const textureId = `model-${modelName}-skin`;
    const { canvas, context, texture } = texturePool.getTexture(textureId);

    const aoTexture = new THREE.TextureLoader().load(
        '../assets/body_ao_modified.png',
        null,  // onLoad — not needed, texture is usable immediately
        null,  // onProgress
        (err) => console.warn('AO texture failed to load — model will render without ambient occlusion', err)
    );
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
        shader.uniforms.visibleIds   = { value: new Float32Array(512).fill(-1) };
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
    child.userData = { canvas, context, texture, textureId };

    AppState.skinMesh = child;
}

function setupTransparentMesh(child, renderOrder) {
    child.renderOrder          = renderOrder;
    child.material             = child.material.clone();
    child.material.transparent = true;
    child.material.opacity     = 0.5;
    child.material.side        = THREE.DoubleSide;
    child.material.depthWrite  = false;
    child.material.needsUpdate = true;
}

function setupBaseTexture(modelName) {
    const { canvas, context, texture } = texturePool.getTexture(`base-texture-${modelName}`);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    AppState.baseTextureCanvas  = canvas;
    AppState.baseTextureContext = context;
    AppState.baseTextureTexture = texture;
}