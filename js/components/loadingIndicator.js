// loadingIndicator.js
// Loading progress bar UI shown while the GLTF model downloads.
// Pure DOM — no Three.js or AppState dependency.

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create and display the loading progress overlay.
 * Removes any existing indicator first to prevent duplicates.
 *
 * @param {number} percentage — initial progress (0–100)
 */
export function showLoadingProgress(percentage = 0) {
    hideLoadingProgress();

    const container = document.createElement('div');
    container.id = 'loading-progress-container';
    container.innerHTML = `
        <div class="progress-title">Loading 3D Model</div>
        <div class="progress-bar-container">
            <div class="progress-bar" id="progress-bar" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-text" id="progress-text">
            <span class="progress-percentage">${percentage.toFixed(1)}%</span> complete
        </div>`;

    document.body.appendChild(container);
}

/**
 * Update the loading bar width and status text.
 *
 * @param {number|null} percentage — 0–100, or null if indeterminate
 * @param {string|null} mbLoaded   — megabytes loaded (used when total is unknown)
 */
export function updateLoadingProgress(percentage, mbLoaded = null) {
    const progressBar  = document.getElementById('progress-bar');
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
        progressBar.style.width     = '50%';
        progressBar.style.animation = 'pulse 1.5s infinite';
        progressText.innerHTML = `
            <span class="progress-percentage">${mbLoaded} MB</span> loaded
            <span class="loading-dots">...</span>`;
    }
}

/**
 * Fade out and remove the loading progress overlay.
 */
export function hideLoadingProgress() {
    const el = document.getElementById('loading-progress-container');
    if (!el) return;

    el.style.transition = 'opacity 0.3s';
    el.style.opacity    = '0';

    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
}