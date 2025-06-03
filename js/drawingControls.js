import AppState from './state.js';
import texturePool from './textureManager.js'

export function createDrawingControls(drawingControlsPanel) {
    // Drawing Controls Container
    const drawingToolsContainer = document.createElement('div');
    drawingToolsContainer.classList.add('drawing-tools-container');

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Drawing Controls';

    // Draw Button
    const drawButton = document.createElement('button');
    drawButton.classList.add('button', 'button-primary');
    drawButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
    </svg>
    <span>Draw</span>
    `;

    // Erase Button
    const eraseButton = document.createElement('button');
    eraseButton.classList.add('button', 'button-secondary');
    eraseButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
            <path d="M22 21H7"></path>
            <path d="m5 11 9 9"></path>
        </svg>
        <span>Erase</span>
    `;

    // Reset Drawing Button
    const resetDrawingButton = document.createElement('button');
    resetDrawingButton.classList.add('button', 'button-secondary');
    resetDrawingButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 4v6h6"></path>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        <span>Reset Drawing</span>
    `;

    // Divider 
    const divider = document.createElement('hr');
    divider.classList.add('divider');

    // Brush Size Controls
    const brushSizeLabel = document.createElement('h2');
    brushSizeLabel.textContent = 'Brush Size';
    brushSizeLabel.style.alignSelf = 'flex-start';

    // Container for the vertical slider
    const sliderContainer = document.createElement('div');
    sliderContainer.classList.add('vertical-slider-container')

    // Brush Size Slider
    const brushSizeSlider = document.createElement('input');
    brushSizeSlider.type = 'range';
    brushSizeSlider.min = '5';
    brushSizeSlider.max = '35';
    brushSizeSlider.step = '5';
    brushSizeSlider.value = AppState.brushRadius;
    brushSizeSlider.classList.add('vertical-slider');

    // Size Indicator Value
    const sizeIndicator = document.createElement('div');
    sizeIndicator.classList.add('size-indicator');
    sizeIndicator.textContent = brushSizeSlider.value;

    sliderContainer.appendChild(brushSizeSlider);
    sliderContainer.appendChild(sizeIndicator);

    // Event Listeners
    drawButton.addEventListener('click', () => {
        AppState.isErasing = false;
        drawButton.classList.remove('button-secondary');
        drawButton.classList.add('button-primary');
        eraseButton.classList.remove('button-primary');
        eraseButton.classList.add('button-secondary');
        brushSizeLabel.textContent = 'Brush Size';
    });

    eraseButton.addEventListener('click', () => {
        AppState.isErasing = true;
        eraseButton.classList.remove('button-secondary');
        eraseButton.classList.add('button-primary');
        drawButton.classList.remove('button-primary');
        drawButton.classList.add('button-secondary');
        brushSizeLabel.textContent = 'Eraser Size';
    });

    resetDrawingButton.addEventListener('click', () => {
        if (AppState.skinMesh?.userData?.context) {
            const { context, canvas, texture } = AppState.skinMesh.userData;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            texture.needsUpdate = true;
        }

        const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
        currentInstance.drawnBoneNames = new Set();
        currentInstance.bonePixelMap = {};
        currentInstance.questionnaireData = null;
        currentInstance.texture.needsUpdate = true;
        updateCurrentDrawing();
    });

    brushSizeSlider.addEventListener('input', (e) => {
        AppState.brushRadius = parseInt(e.target.value);
        sizeIndicator.textContent = e.target.value;
    });

    // Assemble the container
    drawingToolsContainer.appendChild(title);
    drawingToolsContainer.appendChild(drawButton);
    drawingToolsContainer.appendChild(eraseButton);
    drawingToolsContainer.appendChild(resetDrawingButton);
    drawingToolsContainer.appendChild(divider);
    drawingToolsContainer.appendChild(brushSizeLabel);
    drawingToolsContainer.appendChild(sliderContainer);

    // Append to panel
    drawingControlsPanel.appendChild(drawingToolsContainer);
}

export function addNewDrawingInstance() {
    const instanceId = `drawing-${AppState.drawingInstances.length + 1}`;
    const textureBundle = texturePool.getNewTexture(instanceId);

    const newInstance = {
        id: instanceId,
        canvas: textureBundle.canvas,
        context: textureBundle.context,
        texture: textureBundle.texture,
        drawnBoneNames: new Set(),
        bonePixelMap: {},
        questionnaireData: null,
        uvDrawingData: null
    };

    // Store the new instance in AppState
    AppState.drawingInstances.push(newInstance);
    AppState.currentDrawingIndex = AppState.drawingInstances.length - 1;
    updateCurrentDrawing();
}

export function isCurrentDrawingBlank() {
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if(!currentInstance || !currentInstance.canvas) return true;

    const ctx = currentInstance.context;
    const { width, height } = currentInstance.canvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;

    // Check if all pixels are white (or nearly white)
    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        // If anything isn't fully white/transparent
        if (!(r === 255 && g === 255 && b === 255 && a === 255)) {
            return false; // Non-blank pixel found
        }
    }
    return true;
}

export function updateCurrentDrawing() {
    // Update the current drawing instance
    const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
    if (!currentInstance || !AppState.skinMesh || !AppState.skinMesh.material) return;

    const material = AppState.skinMesh.material;
    if (!material) {
        console.warn("SkinMesh.material is not ready.");
        return;
    }

    AppState.skinMesh.userData.canvas = currentInstance.canvas;
    AppState.skinMesh.userData.context = currentInstance.context;
    AppState.skinMesh.userData.texture = currentInstance.texture;

    material.map = currentInstance.texture;
    material.needsUpdate = true;
    currentInstance.texture.needsUpdate = true;

    const pixelMap = currentInstance.bonePixelMap;
    currentInstance.drawnBoneNames = new Set(
        Object.keys(pixelMap).filter(bone => pixelMap[bone].size > 0)
    );

    const statusBar = document.getElementById('drawing-status-bar');
    if (statusBar) {
        const current = AppState.currentDrawingIndex + 1;
        statusBar.textContent = `Add Your Main Area of Pain or Symptom #${current}`;
    }
}
