import { loadModel } from './modelLoader.js';

export function createViewControls(scene, controls, viewControlsPanel, modelList) {
    // Track the current model cancel function
    let currentModelCancelFn = null;
    
    const viewToolsContainer = document.createElement('div');
    viewToolsContainer.classList.add('view-tools-container');

    // View Controls Title
    const title = document.createElement('div');
    title.classList.add('control-title');
    title.textContent = 'Adjust Body View';

    // Double-click instruction
    const doubleClickInstruction = document.createElement('div');
    doubleClickInstruction.classList.add('instruction');
    doubleClickInstruction.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path d="M3 5.188C3 2.341 5.22 0 8 0s5 2.342 5 5.188v5.625C13 13.658 10.78 16 8 16s-5-2.342-5-5.188V5.189zm4.5-4.155C5.541 1.289 4 3.035 4 5.188V5.5h3.5zm1 0V5.5H12v-.313c0-2.152-1.541-3.898-3.5-4.154M12 6.5H4v4.313C4 13.145 5.81 15 8 15s4-1.855 4-4.188z"/>
        </svg>
        <span>Click twice in a row <span style="color:#666;font-weight:400;">for a closer look</span></span>
    `;

    // Scroll instruction
    const scrollInstruction = document.createElement('div');
    scrollInstruction.classList.add('instruction');
    scrollInstruction.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M3.646 9.146a.5.5 0 0 1 .708 0L8 12.793l3.646-3.647a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708m0-2.292a.5.5 0 0 0 .708 0L8 3.207l3.646 3.647a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 0 0 0 .708"/>
        </svg>
        <span>Scroll up <span style="color:#666;font-weight:400;">to zoom in,</span> scroll down <span style="color:#666;font-weight:400;">to zoom out</span></span>
    `;

    // Model Selector
    const modelLabel = document.createElement('div');
    modelLabel.classList.add('label');
    modelLabel.innerHTML = '<strong>Select Model:</strong>';

    const modelSelect = document.createElement('select');
    modelSelect.classList.add('model-selector');

    modelList.forEach(m => {
        const option = document.createElement('option');
        option.value = m.file;
        option.textContent = m.name;
        modelSelect.appendChild(option);
    });

    modelSelect.value = modelList[0].file;
    modelSelect.addEventListener('change', (e) => {
        // Cancel any ongoing model loading
        if (currentModelCancelFn) {
            currentModelCancelFn();
            currentModelCancelFn = null;
        }
        
        const selected = modelList.find(m => m.file === e.target.value);
        if (selected) {
            // Store the cancel function for this model load request
            currentModelCancelFn = loadModel(selected.file, selected.name, scene, controls);
            
            // Disable the select during loading to prevent multiple rapid selections
            modelSelect.disabled = true;
            
            // Re-enable after a short delay (optional)
            setTimeout(() => {
                modelSelect.disabled = false;
            }, 500);
        }
    });

    // Direction change section
    const directionHeader = document.createElement('div');
    directionHeader.classList.add('control-title');
    directionHeader.style.marginTop = '20px';
    directionHeader.textContent = 'Change the Direction the Body is Facing:';

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
            img.classList.add('front-icon');
        }
        
        // Add text label below the icon
        const label = document.createElement('span');
        label.textContent = orientation;
        label.style.marginTop = '5px';
        label.style.fontSize = '12px';
        label.style.color = '#555';
        
        contentContainer.appendChild(img);
        contentContainer.appendChild(label);
        button.appendChild(contentContainer);
        button.addEventListener('click', () => reorientCamera(orientation, controls));
        orientationContainer.appendChild(button);
    });

    // Reset View Button
    const resetViewButton = document.createElement('button');
    resetViewButton.classList.add('reset-view-button');
    resetViewButton.textContent = 'Reset the View';
    resetViewButton.addEventListener('click', () => {
        controls.target.set(0, 1.0, 0);
        controls.object.position.set(0, 1.0, 1.5);
        controls.update();
    });

    // Assemble panel
    viewToolsContainer.appendChild(title);
    viewToolsContainer.appendChild(doubleClickInstruction);
    viewToolsContainer.appendChild(scrollInstruction);
    viewToolsContainer.appendChild(modelLabel);
    viewToolsContainer.appendChild(modelSelect);
    viewToolsContainer.appendChild(directionHeader);
    viewToolsContainer.appendChild(orientationContainer);
    viewToolsContainer.appendChild(resetViewButton);
    viewControlsPanel.appendChild(viewToolsContainer);
}

// Camera reorientation logic
function reorientCamera(direction, controls) {
    const target = controls.target.clone();
    const distance = controls.object.position.distanceTo(target);
    const offset = new THREE.Vector3();

    switch (direction) {
        case 'Front':
            offset.set(0, 0, distance);
            break;
        case 'Back':
            offset.set(0, 0, -distance);
            break;
        case 'Left':
            offset.set(distance, 0, 0);
            break;
        case 'Right':
            offset.set(-distance, 0, 0);
            break;
    }

    controls.object.position.copy(target.clone().add(offset));
    controls.object.lookAt(target);
    controls.update();
}