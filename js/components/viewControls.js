export function createViewControls(controls, viewControlsPanel) {    
    const viewToolsContainer = document.createElement('div');
    viewToolsContainer.classList.add('view-tools-container');

    // View Controls Title
    const title = document.createElement('h2');
    title.textContent = 'Adjust My Body View';

    // Scroll instruction
    const scrollInstruction = document.createElement('div');
    scrollInstruction.classList.add('instruction');
    scrollInstruction.innerHTML = `
        <span><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M3.646 9.146a.5.5 0 0 1 .708 0L8 12.793l3.646-3.647a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708m0-2.292a.5.5 0 0 0 .708 0L8 3.207l3.646 3.647a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 0 0 0 .708"/>
        </svg>Zoom in or out by:<br><ul><li>Scroll mouse wheel</li><li>Pinch with two fingers on a touchpad or touchscreen</li></ul></span>
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