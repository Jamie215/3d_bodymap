import AppState from "../app/state.js";

export function createViewControls(controls, viewControlsPanel) {    
    const viewToolsContainer = document.createElement('div');
    viewToolsContainer.classList.add('view-tools-container');

    // Divider 
    const divider = document.createElement('hr');
    divider.classList.add('divider');

    // Body Region Selector
    const regionSelector = document.createElement('div');
    regionSelector.classList.add('panel-selection');
    const selectorText = document.createElement('span');
    selectorText.textContent = "Select Where to Focus";
    const dropdown = document.createElement('select');
    dropdown.classList.add('region-dropdown');
    const regions = [
        'Entire Body',
        'Head', 
        'Left Arm', 
        'Left Hand',
        'Right Arm', 
        'Right Hand', 
        'Left Leg', 
        'Left Foot', 
        'Right Leg', 
        'Right Foot'
    ]
    regionSelector.appendChild(selectorText);
    regionSelector.appendChild(dropdown);
    
    function createDropdownOptions(dropdown, text) {
        let option = document.createElement('option');
        option.text = text;
        dropdown.add(option);
    }

    for (let i=0; i< regions.length; i++) {
        createDropdownOptions(dropdown, regions[i])
    }

    regionSelector.appendChild(selectorText);
    regionSelector.appendChild(dropdown);

    // Zoom instruction
    const zoomInstruction = document.createElement('div');
    zoomInstruction.classList.add('instruction');
    zoomInstruction.innerHTML = `
        <svg class="zoom-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                        <path d="M11 8v6"></path>
                        <path d="M8 11h6"></path>
                    </svg>
        <span>Scroll your mouse or pinch the screen to zoom in or out</span>
    `;

    // Reset View Button
    const resetViewButton = document.createElement('button');
    resetViewButton.classList.add('reset-view-button');
    resetViewButton.textContent = 'Reset the View';
    resetViewButton.addEventListener('click', () => {
        if (AppState.cameraUtils) {
            AppState.cameraUtils.resetView();
        }
    });

    // Assemble panel
    viewToolsContainer.appendChild(regionSelector);
    viewToolsContainer.appendChild(divider);
    viewToolsContainer.appendChild(zoomInstruction);
    viewToolsContainer.appendChild(resetViewButton);
    viewControlsPanel.appendChild(viewToolsContainer);
}

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
        <svg fill="#024dbd" width="40px" height="40px" viewBox="0 0 24 24" id="curve-arrow-left-7" data-name="Flat Color" xmlns="http://www.w3.org/2000/svg" class="icon flat-color" stroke="#024dbd" stroke-width="2.4"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path id="primary" d="M21.32,5.05a1,1,0,0,0-1.27.63A12.14,12.14,0,0,1,8.51,14H5.41l1.3-1.29a1,1,0,0,0-1.42-1.42l-3,3a1,1,0,0,0,0,1.42l3,3a1,1,0,0,0,1.42,0,1,1,0,0,0,0-1.42L5.41,16h3.1A14.14,14.14,0,0,0,22,6.32,1,1,0,0,0,21.32,5.05Z" style="fill: #024dbd;"></path></g></svg>
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

        // Track current rotation angle
        let currentRotationAngle = AppState.cameraUtils.rotationAngle;
        
        const rotationDegrees = direction === 'left' ? -90 : 90;
        currentRotationAngle += rotationDegrees;
        
        // Normalize angle to 0-360 range
        currentRotationAngle = ((currentRotationAngle % 360) + 360) % 360;

        AppState.cameraUtils.rotationAngle = currentRotationAngle;
        
        // Map angle to orientation
        const orientationMap = {
            0: 'Front',
            90: 'Right',
            180: 'Back',
            270: 'Left'
        };
        
        const orientation = orientationMap[currentRotationAngle];
        console.log("orientation: ", orientation);
        if (orientation) {
            AppState.cameraUtils.reorientCamera(orientation);
        }
        
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
            currentRotationAngle = 0;
        },
        cleanup: () => {
            leftRotateBtn.removeEventListener('click', () => rotateCamera('left'));
            rightRotateBtn.removeEventListener('click', () => rotateCamera('right'));
            rotationControlsContainer.remove();
        }
    };
}
