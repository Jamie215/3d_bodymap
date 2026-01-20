// js/components/viewControls.js
import AppState from "../app/state.js";
import { 
    showRegionSelectorModal, 
    setOnRegionSelected, 
    createRegionSelectorFooterButton 
} from "./modal.js";

/**
 * Show the region selector modal
 * Can be called from anywhere to re-open the modal
 */
export function showRegionSelector() {
    showRegionSelectorModal();
}

/**
 * Setup region selector for the drawing view
 * - Sets up the callback for region selection
 * - Shows the modal
 * 
 * @param {HTMLElement} buttonContainer - The container to add the button to
 * @param {boolean} showModal - Whether to show the modal immediately (default: true)
 */
export function setupRegionSelectorForDrawing(buttonContainer, showModal = true) {
    // Set callback for region selection
    setOnRegionSelected((regionName) => {
        console.log('Region selected:', regionName);
        // Store selected region in AppState
        AppState.selectedRegion = regionName;
    });
    
    // Add focus button (if not already present)
    if (buttonContainer && !buttonContainer.querySelector('#region-selector-footer-btn')) {
        const focusButton = createRegionSelectorFooterButton();
        buttonContainer.appendChild(focusButton);
    }
    
    // Show modal when entering drawing view
    if (showModal) {
        setTimeout(() => {
            showRegionSelectorModal();
        }, 300);
    }
}

/**
 * Create canvas rotation controls
 * These are the left/right rotation buttons overlaid on the canvas
 * 
 * @param {HTMLElement} canvasPanel - The canvas panel element
 */
export function createCanvasRotationControls(canvasPanel) {
    // Create container for rotation controls
    const rotationControlsContainer = document.createElement('div');
    rotationControlsContainer.id = 'canvas-rotation-controls';
    rotationControlsContainer.className = 'canvas-rotation-controls';
    
    // Create left rotation button
    const leftRotateBtn = document.createElement('button');
    leftRotateBtn.className = 'canvas-rotate-btn rotate-left';
    leftRotateBtn.setAttribute('aria-label', 'Rotate model left');
    leftRotateBtn.innerHTML = `
        <svg fill="#024dbd" width="40px" height="40px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="icon flat-color" stroke="#024dbd" stroke-width="2.4">
            <path d="M21.32,5.05a1,1,0,0,0-1.27.63A12.14,12.14,0,0,1,8.51,14H5.41l1.3-1.29a1,1,0,0,0-1.42-1.42l-3,3a1,1,0,0,0,0,1.42l3,3a1,1,0,0,0,1.42,0,1,1,0,0,0,0-1.42L5.41,16h3.1A14.14,14.14,0,0,0,22,6.32,1,1,0,0,0,21.32,5.05Z" style="fill: #024dbd;"></path>
        </svg>
    `;
    
    // Create right rotation button  
    const rightRotateBtn = document.createElement('button');
    rightRotateBtn.className = 'canvas-rotate-btn rotate-right';
    rightRotateBtn.setAttribute('aria-label', 'Rotate model right');
    rightRotateBtn.innerHTML = `
        <svg fill="#024dbd" width="40px" height="40px" viewBox="0 0 24 24" id="curve-arrow-left-7" data-name="Flat Color" xmlns="http://www.w3.org/2000/svg" class="icon flat-color" stroke="#024dbd" stroke-width="2.4"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path id="primary" d="M21.32,5.05a1,1,0,0,0-1.27.63A12.14,12.14,0,0,1,8.51,14H5.41l1.3-1.29a1,1,0,0,0-1.42-1.42l-3,3a1,1,0,0,0,0,1.42l3,3a1,1,0,0,0,1.42,0,1,1,0,0,0,0-1.42L5.41,16h3.1A14.14,14.14,0,0,0,22,6.32,1,1,0,0,0,21.32,5.05Z" style="fill: #024dbd;"></path></g></svg>
    `;

    // Function to rotate the camera smoothly
    function rotateCamera(direction) {
        if (!AppState.cameraUtils) {
            console.warn('CameraUtils not initialized');
            return;
        }

        // Use cameraUtils rotation methods directly
        // cameraUtils handles angle management internally (in radians)
        if (direction === 'left') {
            AppState.cameraUtils.rotateLeft();
        } else {
            AppState.cameraUtils.rotateRight();
        }
        
        // Log current view for debugging
        // const viewName = AppState.cameraUtils.getCurrentViewName();
        // const angleDegrees = AppState.cameraUtils.getRotationAngleDegrees().toFixed(0);
        // console.log(`Rotation: ${viewName} (${angleDegrees}°)`);
        
        // Visual feedback
        const button = direction === 'left' ? leftRotateBtn : rightRotateBtn;
        button.classList.add('clicked');
        setTimeout(() => button.classList.remove('clicked'), 200);
    }
    
    // Add event listeners
    leftRotateBtn.addEventListener('click', () => rotateCamera('left'));
    rightRotateBtn.addEventListener('click', () => rotateCamera('right'));
    
    // Add touch event handling for mobile
    [leftRotateBtn, rightRotateBtn].forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            btn.classList.add('touched');
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.classList.remove('touched');
            btn.click();
        });
    });
    
    // Append buttons to container
    rotationControlsContainer.appendChild(leftRotateBtn);
    rotationControlsContainer.appendChild(rightRotateBtn);
    
    // Return container and utility functions
    return {
        container: rotationControlsContainer,
        resetRotation: () => {
            if (AppState.cameraUtils) {
                AppState.cameraUtils.resetRotation();
            }
        },
        cleanup: () => {
            rotationControlsContainer.remove();
        }
    };
}