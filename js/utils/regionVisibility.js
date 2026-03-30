// regionVisibility.js
// Controls which anatomical regions are visible on the 3D model by
// writing to the custom region-visibility shader uniforms.
//
// When a limb is selected in the region selector, other body parts are
// hidden via the GPU shader (fragment discard) rather than by manipulating
// mesh visibility. Clothing and hair meshes are toggled via standard
// Three.js `.visible` since they don't carry the region shader.
//
// Public API:
//   setVisibleRegions(regionIds, checkedAreas) — apply a visibility filter
//   isRegionVisible(regionId)                  — query current filter state

import AppState from '../app/state.js';

/**
 * Show only the specified regions on the skin mesh, hiding everything else.
 * Pass `null` or an empty array to show the full body (no filter).
 *
 * Writes directly to the shader uniforms injected by modelLoader.js's
 * `onBeforeCompile` hook: `visibleIds`, `visibleCount`, `filterActive`.
 *
 * Also toggles clothing and hair mesh visibility based on which main
 * body areas are selected (e.g. hide shorts when only arms are visible).
 *
 * @param {number[]|null}  regionIds    — Numeric `_regionid` attribute values to keep visible.
 *                                         `null` or `[]` disables the filter (full body).
 * @param {string[]|null}  checkedAreas — Main area names from the region selector
 *                                         (e.g. `['Head', 'Torso']`). Used to decide
 *                                         clothing visibility. Pass `null` when clearing.
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
 *
 * Rules:
 *   - Hair is visible when full body is shown, or when "Head" is in the checked set
 *   - Top is visible when full body is shown, or when "Torso" is checked
 *   - Shorts follows the same rule as Top
 *
 * @param {boolean}        isFullBody   — true when no region filter is active
 * @param {string[]|null}  checkedAreas — main area names, or null
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
 *
 * Returns `true` if no filter is active (full body shown) or if the
 * specific ID is in the visible set.
 *
 * Used by the drawing interaction layer to reject pointer hits on
 * hidden regions so the user can't paint invisible surfaces.
 *
 * @param {number} regionId — numeric `_regionid` attribute value
 * @returns {boolean}
 */
export function isRegionVisible(regionId) {
    if (!AppState.visibleRegionIds) return true;
    return AppState.visibleRegionIds.has(regionId);
}