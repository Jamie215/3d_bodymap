// drawingControls.js
import AppState from '../app/state.js';
import { showDrawResetModal, hideDrawResetModal, getModalElements } from './modal.js';

export function createDrawingControls(drawingControlsPanel) {
    // Drawing Controls Container
    const drawingToolsContainer = document.createElement('div');
    drawingToolsContainer.classList.add('drawing-tools-container');

    // Draw Button
    const drawButton = document.createElement('button');
    drawButton.id = 'draw-button';
    drawButton.classList.add('button', 'button-primary', 'button-draw-control');
    drawButton.innerHTML = `
        <i class="fa-solid fa-brush"></i>
        <span>Draw</span>
    `;

    // Erase Button
    const eraseButton = document.createElement('button');
    eraseButton.id = 'erase-button';
    eraseButton.classList.add('button', 'button-secondary', 'button-draw-control');
    eraseButton.innerHTML = `
        <i class="fa-solid fa-eraser"></i>
        <span>Erase</span>
    `;

    // Reset Drawing Button
    const resetDrawingButton = document.createElement('button');
    resetDrawingButton.id = 'reset-drawing-button';
    resetDrawingButton.classList.add('button', 'button-secondary', 'button-draw-control');
    resetDrawingButton.innerHTML = `
        <i class="fa-solid fa-arrow-rotate-left"></i>
        <span>Erase All</span>
    `;

    // Divider
    const divider = document.createElement('hr');
    divider.classList.add('divider');

    // Container for the vertical slider
    const sliderContainer = document.createElement('div');
    sliderContainer.classList.add('vertical-slider-container');

    // Brush Size Controls
    const brushSizeLabel = document.createElement('h2');
    brushSizeLabel.textContent = 'Marker Size';

    // Wrapper for the slider
    const sliderWrapper = document.createElement('div');
    sliderWrapper.classList.add('slider-wrapper');

    // Brush Size Slider
    const brushSizeSlider = document.createElement('input');
    brushSizeSlider.type = 'range';
    brushSizeSlider.min = '5';
    brushSizeSlider.max = '30';
    brushSizeSlider.step = '1';
    brushSizeSlider.value = AppState.brushRadius;
    brushSizeSlider.classList.add('vertical-slider');

    sliderContainer.appendChild(brushSizeLabel);
    sliderWrapper.appendChild(brushSizeSlider);
    sliderContainer.appendChild(sliderWrapper);

    // --- Event Listeners ---

    drawButton.addEventListener('click', () => {
        AppState.isErasing = false;
        drawButton.classList.remove('button-secondary');
        drawButton.classList.add('button-primary');
        eraseButton.classList.remove('button-primary');
        eraseButton.classList.add('button-secondary');
        brushSizeLabel.textContent = 'Marker Size';
    });

    eraseButton.addEventListener('click', () => {
        AppState.isErasing = true;
        eraseButton.classList.remove('button-secondary');
        eraseButton.classList.add('button-primary');
        drawButton.classList.remove('button-primary');
        drawButton.classList.add('button-secondary');
        brushSizeLabel.textContent = 'Eraser Size';
    });

    // Wire reset modal handlers on first click (modal doesn't exist at init time).
    let resetListenersAttached = false;

    resetDrawingButton.addEventListener('click', () => {
        if (!AppState.skinMesh?.userData?.context) return;

        if (!resetListenersAttached) {
            const { resetReturnButton, resetConfirmButton } = getModalElements("reset");

            resetReturnButton.addEventListener('click', () => {
                hideDrawResetModal();
            });

            resetConfirmButton.addEventListener('click', () => {
                const currentInstance = AppState.drawingInstances[AppState.currentDrawingIndex];
                if (!currentInstance) return;

                const ctx = currentInstance.context;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, currentInstance.canvas.width, currentInstance.canvas.height);

                if (AppState.baseTextureCanvas) {
                    ctx.drawImage(AppState.baseTextureCanvas, 0, 0);
                }

                // Reset current drawing instance data
                currentInstance.drawnRegionNames = new Set();
                currentInstance.regionPixelMap = {};
                currentInstance.coloredFaces = new Set();
                currentInstance.questionnaireData = null;
                currentInstance.texture.needsUpdate = true;

                hideDrawResetModal();
            });

            resetListenersAttached = true;
        }

        showDrawResetModal();
    });

    // --- Dynamic thumb sizing ---

    const thumbStyleSheet = document.createElement('style');
    thumbStyleSheet.id = 'brush-thumb-style';
    document.head.appendChild(thumbStyleSheet);

    function updateThumbSize(value) {
        const minBrush = 5, maxBrush = 30;
        const minThumb = 18, maxThumb = 30;

        const t = (value - minBrush) / (maxBrush - minBrush);
        const thumbSize = minThumb + t * (maxThumb - minThumb);

        thumbStyleSheet.textContent = `
            .vertical-slider::-webkit-slider-thumb {
                width: ${thumbSize}px !important;
                height: ${thumbSize}px !important;
                border: 2px solid var(--dark-blue) !important;
                box-sizing: border-box;
            }
            .vertical-slider::-moz-range-thumb {
                width: ${thumbSize}px !important;
                height: ${thumbSize}px !important;
                border: 2px solid var(--dark-blue) !important;
                box-sizing: border-box;
            }
        `;
    }

    brushSizeSlider.addEventListener('input', (e) => {
        AppState.brushRadius = parseInt(e.target.value);
        updateThumbSize(AppState.brushRadius);
    });

    updateThumbSize(brushSizeSlider.value);

    // --- Assemble the container ---

    drawingToolsContainer.appendChild(drawButton);
    drawingToolsContainer.appendChild(eraseButton);
    drawingToolsContainer.appendChild(resetDrawingButton);
    drawingToolsContainer.appendChild(divider);
    drawingToolsContainer.appendChild(sliderContainer);

    drawingControlsPanel.appendChild(drawingToolsContainer);
}