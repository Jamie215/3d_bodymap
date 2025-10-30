import AppState from "../app/state.js";

export function createViewControls(controls, viewControlsPanel) {    
    const viewToolsContainer = document.createElement('div');
    viewToolsContainer.classList.add('view-tools-container');

    // Direction change section
    const directionHeader = document.createElement('span');
    directionHeader.textContent = 'Change the Direction My Body is Facing';

    // Create orientation buttons container
    const orientationContainer = document.createElement('div');
    orientationContainer.classList.add('orientation-button-container');

    // Create the four orientation buttons
    const orientationMap = {
        Front: { icon: 'front.svg' },
        Back: { icon: 'back.svg' },
        Right: { icon: 'side.svg', flip: true},
        Left: { icon: 'side.svg'}
    };

    Object.entries(orientationMap).forEach(([orientation, config]) => {
        const button = document.createElement('button');
        button.classList.add('orientation-button');

        const contentContainer = document.createElement('div');
        contentContainer.style.display = 'flex';
        contentContainer.style.flexDirection = 'column';
        contentContainer.style.alignItems = 'center';
        
        const img = document.createElement('img');
        img.src = `./assets/rotation_svg/${config.icon}`;
        img.alt = orientation;
        
        // Apply flip transform for the right side (which uses the same side.svg)
        if (config.flip) {
            img.style.transform = 'scaleX(-1)';
        }

        if (orientation === 'Front') {
            img.style.transform = 'scale(1.1)';
        }
        
        // Add text label below the icon
        const label = document.createElement('span');
        label.classList.add('orientation-button-text');
        label.textContent = orientation;
        
        contentContainer.appendChild(img);
        contentContainer.appendChild(label);
        button.appendChild(contentContainer);
        button.addEventListener('click', () => {
            if (AppState.cameraUtils) {
                AppState.cameraUtils.reorientCamera(orientation);
            } else {
                console.warn('CameraUtils not initialized');
            }
        });
        orientationContainer.appendChild(button);
    });

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
    viewToolsContainer.appendChild(directionHeader);
    viewToolsContainer.appendChild(orientationContainer);
    viewToolsContainer.appendChild(zoomInstruction);
    viewToolsContainer.appendChild(resetViewButton);
    viewControlsPanel.appendChild(viewToolsContainer);
}