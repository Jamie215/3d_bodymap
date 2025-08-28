import AppState from "../app/state.js";

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
        const pivot  = (AppState.viewPivot && AppState.viewPivot.clone()) || new THREE.Vector3(0, 1, 0);
        const radius = AppState.viewRadius || 1.0;
        controls.target.copy(pivot);
        // Put camera “front” at a comfortable distance
        const camera = controls.object;
        const dist = Math.max(controls.minDistance || 0, radius * 1.5);
        camera.position.copy(pivot).add(new THREE.Vector3(0, 0, dist));
        camera.lookAt(pivot);
        camera.updateProjectionMatrix();
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
    const camera = controls.object;

    // Use the centralized pivot & radius
    const pivot  = (AppState.viewPivot && AppState.viewPivot.clone()) || controls.target.clone();
    const radius = AppState.viewRadius || 1.0;

    // Reset orbit axis to stop cutting through the mesh
    controls.target.copy(pivot);

    // Safe distance: not less than current zoom, minDistance, or ~1.2× radius
    const currDist = camera.position.distanceTo(pivot);
    const safeDist = Math.max(currDist, controls.minDistance || 0, radius * 1.2);

    // Pick a direction, relative to model's world rotation if available
    const root = AppState.modelRoot || AppState.model || AppState.skinMesh || null;
    const qWorld = new THREE.Quaternion();
    if (root) root.getWorldQuaternion(qWorld);

    const dirMap = {
        Front: new THREE.Vector3( 0, 0,  1),
        Back:  new THREE.Vector3( 0, 0, -1),
        Left:  new THREE.Vector3( 1, 0,  0),
        Right: new THREE.Vector3(-1, 0,  0),
    };
    const dir = dirMap[direction].clone().applyQuaternion(qWorld).normalize();

    // Move camera & look at pivot
    camera.position.copy(pivot).addScaledVector(dir, safeDist);
    camera.lookAt(pivot);

    // Keep near/far reasonable to avoid near-plane slicing
    const suggestedNear = Math.max(0.01, radius / 200);
    const suggestedFar  = Math.max(safeDist + radius * 4, camera.far);
    if (camera.near !== suggestedNear || camera.far !== suggestedFar) {
        camera.near = suggestedNear;
        camera.far  = suggestedFar;
        camera.updateProjectionMatrix();
    }

    controls.update();
}