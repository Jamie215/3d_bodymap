import AppState from '../app/state.js';

/**
 * Show only the specified regions on the skin mesh, hiding everything else.
 * Pass null or an empty array to show the full body.
 *
 * @param {number[]|null} regionIds - Array of numeric _regionid values to keep visible
 * @param {string[]|null} checkedAreas - Optional array of checked area names (e.g. ['Head', 'Torso'])
 */
export function setVisibleRegions(regionIds, checkedAreas = null) {
    const mesh = AppState.skinMesh;
    if (!mesh) return;

    const shader = mesh.userData.regionShader;
    if (!shader) {
        console.warn('Region shader not ready — model may not have rendered yet.');
        return;
    }

    const isFullBody = !regionIds || regionIds.length === 0;

    if (isFullBody) {
        shader.uniforms.filterActive.value = false;
        AppState.visibleRegionIds = null;
    } else {
        const idsArray = shader.uniforms.visibleIds.value;
        idsArray.fill(-1);
        regionIds.forEach((id, i) => {
            if (i < 512) idsArray[i] = id;
        });
        shader.uniforms.visibleCount.value = Math.min(regionIds.length, 512);
        shader.uniforms.filterActive.value = true;
        AppState.visibleRegionIds = new Set(regionIds);
    }

    // Toggle clothing and hair visibility
    updateClothingVisibility(isFullBody, checkedAreas);
}

/**
 * Shows or hides clothing/hair meshes based on which body areas are selected.
 */
function updateClothingVisibility(isFullBody, checkedAreas) {
    if (!AppState.model) return;

    const areas = checkedAreas ? new Set(checkedAreas) : null;

    AppState.model.traverse(child => {
        if (!child.isMesh) return;

        if (child.name === 'Hair') {
            child.visible = isFullBody || (areas !== null && areas.has('Head'));
        }
        if (child.name === 'Top') {
            child.visible = isFullBody || (areas !== null && areas.has('Torso'));
        }
        if (child.name === 'Shorts') {
            child.visible = isFullBody || (areas !== null && areas.has('Torso'));
        }
    });
}

/**
 * Check whether a given region ID is currently visible.
 * Returns true if no filter is active (full body shown).
 */
export function isRegionVisible(regionId) {
    if (!AppState.visibleRegionIds) return true;
    return AppState.visibleRegionIds.has(regionId);
}