export function createViewControls(controls, viewControlsPanel) {    
    const viewToolsContainer = document.createElement('div');
    viewToolsContainer.classList.add('view-tools-container');

    // View Controls Title
    const title = document.createElement('h2');
    title.textContent = 'Adjust My Body View';

    // Zoom instruction
    const zoomInstruction = document.createElement('div');
    zoomInstruction.classList.add('instruction');
    zoomInstruction.innerHTML = `
        <span><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
            viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" style="vertical-align:-3px;">
            <circle cx="6.5" cy="6.5" r="4.75"/>
            <!-- vertical double-headed arrow -->
            <line x1="6.5" y1="4.5" x2="6.5" y2="8.5"/>
            <polyline points="5.5 5.5 6.5 4.5 7.5 5.5"/>
            <polyline points="5.5 7.5 6.5 8.5 7.5 7.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14"/>  <!-- handle -->
        </svg>
        Zoom in or out by:<br><ul><li>Scroll mouse wheel</li><li>Pinch with two fingers on a touchpad or touchscreen</li></ul></span>
    `;

    // Pan instruction
    const panInstruction = document.createElement('div');
    panInstruction.classList.add('instruction');
    panInstruction.innerHTML = `
        <span><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <!-- Up -->
            <polygon points="8,1 11,4 5,4"/>
            <!-- Down -->
            <polygon points="8,15 5,12 11,12"/>
            <!-- Left -->
            <polygon points="1,8 4,5 4,11"/>
            <!-- Right -->
            <polygon points="15,8 12,11 12,5"/>
            <!-- Center dot -->
            <circle cx="8" cy="8" r="1.3"/>
        </svg>Move my body using the on-screen arrows</span>
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
    resetViewButton.textContent = 'Reset My Body View';
    resetViewButton.addEventListener('click', () => {
        controls.target.set(0, 1.0, 0);
        controls.object.position.set(0, 1.0, 1.5);
        controls.update();
    });

    // Assemble panel
    viewToolsContainer.appendChild(title);
    viewToolsContainer.appendChild(zoomInstruction);
    viewToolsContainer.appendChild(panInstruction);
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
    const safe = Math.max(distance, controls.minDistance);
    const offset = new THREE.Vector3();

    switch (direction) {
        case 'Front':
            offset.set(0, 0, safe);
            break;
        case 'Back':
            offset.set(0, 0, -safe);
            break;
        case 'Left':
            offset.set(safe, 0, 0);
            break;
        case 'Right':
            offset.set(-safe, 0, 0);
            break;
    }

    controls.object.position.copy(target.clone().add(offset));
    controls.object.lookAt(target);
    controls.update();
}