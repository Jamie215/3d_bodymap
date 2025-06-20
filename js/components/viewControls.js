export function createViewControls(controls, viewControlsPanel) {    
    const viewToolsContainer = document.createElement('div');
    viewToolsContainer.classList.add('view-tools-container');

    // View Controls Title
    const title = document.createElement('h2');
    title.textContent = 'Adjust My Body View';

    // Double-click instruction
    const doubleClickInstruction = document.createElement('div');
    doubleClickInstruction.classList.add('instruction');
    doubleClickInstruction.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
            <path d="M3 5.188C3 2.341 5.22 0 8 0s5 2.342 5 5.188v5.625C13 13.658 10.78 16 8 16s-5-2.342-5-5.188V5.189zm4.5-4.155C5.541 1.289 4 3.035 4 5.188V5.5h3.5zm1 0V5.5H12v-.313c0-2.152-1.541-3.898-3.5-4.154M12 6.5H4v4.313C4 13.145 5.81 15 8 15s4-1.855 4-4.188z"/>
        </svg>
        <span>Click on specific body part multiple times for a closer look</span>
    `;

    // Scroll instruction
    const scrollInstruction = document.createElement('div');
    scrollInstruction.classList.add('instruction');
    scrollInstruction.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M3.646 9.146a.5.5 0 0 1 .708 0L8 12.793l3.646-3.647a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708m0-2.292a.5.5 0 0 0 .708 0L8 3.207l3.646 3.647a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 0 0 0 .708"/>
        </svg>
        <span>Zoom in or out: Use your mouse scroll wheel or pinch with two fingers on a touchpad</span>
    `;

    // Divider 
    const divider = document.createElement('hr');
    divider.classList.add('divider');

    // Direction change section
    const directionHeader = document.createElement('h2');
    directionHeader.textContent = 'My Body is Facing:';

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
        label.classList.add('orientation-button-text');
        label.textContent = orientation;
        
        contentContainer.appendChild(img);
        contentContainer.appendChild(label);
        button.appendChild(contentContainer);
        button.addEventListener('click', () => reorientCamera(orientation, controls));
        orientationContainer.appendChild(button);
    });

    // Reset View Button
    const resetViewButton = document.createElement('button');
    resetViewButton.classList.add('reset-view-button');
    resetViewButton.textContent = 'Reset Where My Body is Facing';
    resetViewButton.addEventListener('click', () => {
        controls.target.set(0, 1.0, 0);
        controls.object.position.set(0, 1.0, 1.5);
        controls.update();
    });

    // Assemble panel
    viewToolsContainer.appendChild(title);
    viewToolsContainer.appendChild(doubleClickInstruction);
    viewToolsContainer.appendChild(scrollInstruction);
    viewToolsContainer.appendChild(divider);
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