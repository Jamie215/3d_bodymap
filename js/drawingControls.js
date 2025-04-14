import AppState from './state.js';

export function createDrawingControls(drawingControlsPanel) {
    // Drawing Controls Container
    const drawingToolsContainer = document.createElement('div');
    drawingToolsContainer.classList.add('drawing-tools-container');

    // Title
    const title = document.createElement('div');
    title.classList.add('control-title');
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
    const brushSizeLabel = document.createElement('div');
    brushSizeLabel.textContent = 'Brush Size';
    brushSizeLabel.style.alignSelf = 'flex-start';
    brushSizeLabel.style.fontWeight = '500';
    brushSizeLabel.style.marginBottom = '10px';

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

    // Size indicator value
    const sizeIndicator = document.createElement('div');
    sizeIndicator.classList.add('size-indicator');
    sizeIndicator.textContent = brushSizeSlider.value;

    sliderContainer.appendChild(brushSizeSlider);
    sliderContainer.appendChild(sizeIndicator);
    
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

    // Event Listeners
    drawButton.addEventListener('click', () => {
        AppState.isErasing = false;
        drawButton.classList.remove('button-secondary');
        drawButton.classList.add('button-primary');
        eraseButton.classList.remove('button-primary');
        eraseButton.classList.add('button-secondary');
    });

    eraseButton.addEventListener('click', () => {
        AppState.isErasing = true;
        eraseButton.classList.remove('button-secondary');
        eraseButton.classList.add('button-primary');
        drawButton.classList.remove('button-primary');
        drawButton.classList.add('button-secondary');
    });

    resetDrawingButton.addEventListener('click', () => {
        if (AppState.skinMesh?.userData?.context) {
            const { context, canvas, texture } = AppState.skinMesh.userData;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            texture.needsUpdate = true;
        }
    });

    brushSizeSlider.addEventListener('input', (e) => {
        AppState.brushRadius = parseInt(e.target.value);
        sizeIndicator.textContent = e.target.value;
    });
}