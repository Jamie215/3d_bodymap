// drawingControls.js
import AppState from '../app/state.js';
import { showDrawResetModal, hideDrawResetModal, getModalElements } from './modal.js';

export function createDrawingControls(drawingControlsPanel) {
    const popoverMq = window.matchMedia(
        '(max-width: 1023px) and (orientation: portrait), (max-width: 767px)'
    );
    const isPopoverMode = () => popoverMq.matches;

    // Drawing Controls Container
    const drawingToolsContainer = document.createElement('div');
    drawingToolsContainer.classList.add('drawing-tools-container');

    // Draw Button (with chevron trigger for the marker-size popover)
    const drawButton = document.createElement('button');
    drawButton.id = 'draw-button';
    drawButton.classList.add('button', 'button-primary', 'button-draw-control');
    drawButton.innerHTML = `
        <i class="fa-solid fa-brush"></i>
        <span>Draw</span>
        <span class="marker-size-trigger" role="button" tabindex="0" aria-label="Adjust marker size">
                <i class="fa-solid fa-chevron-down"></i>
        </span>
    `;

    // Erase Button (with chevron trigger for the marker-size popover)
    const eraseButton = document.createElement('button');
    eraseButton.id = 'erase-button';
    eraseButton.classList.add('button', 'button-secondary', 'button-draw-control');
    eraseButton.innerHTML = `
        <i class="fa-solid fa-eraser"></i>
        <span>Erase</span>
        <span class="marker-size-trigger" role="button" tabindex="0" aria-label="Adjust eraser size">
            <i class="fa-solid fa-chevron-down"></i>
        </span>
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

    // Container for the slider.
    // The `marker-size-popover` class is a hook — it has zero effect outside
    // the popover-mode media query (mobile + tablet portrait).
    const sliderContainer = document.createElement('div');
    sliderContainer.classList.add('vertical-slider-container', 'marker-size-popover');

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

    // ====================================================================
    // MARKER-SIZE POPOVER (mobile + tablet portrait)
    // ====================================================================
    //
    // Click handling uses delegation: one listener per button that branches
    // on whether the tap landed inside the .marker-size-trigger chevron.
    function positionPopover(anchorButton) {
        const rect = anchorButton.getBoundingClientRect();
        const popWidth = Math.min(window.innerWidth * 0.9, 360);

        // Centre below the anchor, clamped to viewport with 8px margin.
        let left = rect.left + (rect.width / 2) - (popWidth / 2);
        left = Math.max(8, Math.min(left, window.innerWidth - popWidth - 8));

        sliderContainer.style.left = `${left}px`;
        sliderContainer.style.top  = `${rect.bottom + 8}px`;
    }

    // Track the slider container's original parent so we can restore it
    // when the popover mode is exited (e.g. landscape rotation).
    let originalParent = null;

    function ensureBodyAttached() {
        if (sliderContainer.parentElement !== document.body) {
            originalParent = sliderContainer.parentElement;
            document.body.appendChild(sliderContainer);
        }
    }

    function restoreOriginalParent() {
        if (originalParent && sliderContainer.parentElement !== originalParent) {
            originalParent.appendChild(sliderContainer);
            originalParent = null;
        }

        // Clear popover positioning styles that were set for body-attachment
        sliderContainer.style.left = '';
        sliderContainer.style.top = '';
    }

    function openPopover(anchorButton) {
        if (!isPopoverMode()) return;
        // Re-parent to body so position:fixed escapes any parent containing-block
        // or overflow constraints from the toolbar / slot-left.
        ensureBodyAttached();
        positionPopover(anchorButton);
        sliderContainer.classList.add('is-open');
    }

    function closePopover() {
        sliderContainer.classList.remove('is-open');
    }

    function togglePopover(anchorButton) {
        if (sliderContainer.classList.contains('is-open')) {
            closePopover();
        } else {
            openPopover(anchorButton);
        }
    }

    // Programmatic open/close so the onboarding tooltip can show the slider 
    function getActiveButton() {
        return AppState.isErasing ? eraseButton : drawButton;
    }

    function pulseActiveChevron() {
        const chevron = getActiveButton().querySelector('.marker-size-trigger');
        if (!chevron) return;
        // Remove any in-flight pulse class first so the animation can replay.
        chevron.classList.remove('pulse-once');
        // Force a reflow to restart the animation when re-adding the class.
        void chevron.offsetWidth;
        chevron.classList.add('pulse-once');
        chevron.addEventListener('animationend', () => {
            chevron.classList.remove('pulse-once');
        }, { once: true });
    }

    window.__markerSizePopover = {
        open:           () => openPopover(getActiveButton()),
        openOnActive:   () => openPopover(getActiveButton()),
        close:          closePopover,
        pulseChevron:   pulseActiveChevron,
        isPopoverMode
    };

    /**
     * Single click handler per Draw/Erase button.
     * If the tap landed inside the chevron, open the popover and stop.
     * Otherwise, run the mode-switch logic.
     */
    function makeButtonClickHandler(button, becomeErasing, sliderLabel) {
        return (e) => {
            // Did the click land inside the chevron (or its icon child)?
            if (e.target.closest('.marker-size-trigger')) {
                if (isPopoverMode()) {
                    e.preventDefault();
                    togglePopover(button);
                }
                return; // never switch mode when the chevron was tapped
            }

            // Otherwise — normal mode switch.
            AppState.isErasing = becomeErasing;
            if (becomeErasing) {
                eraseButton.classList.remove('button-secondary');
                eraseButton.classList.add('button-primary');
                drawButton.classList.remove('button-primary');
                drawButton.classList.add('button-secondary');
            } else {
                drawButton.classList.remove('button-secondary');
                drawButton.classList.add('button-primary');
                eraseButton.classList.remove('button-primary');
                eraseButton.classList.add('button-secondary');
            }
            brushSizeLabel.textContent = sliderLabel;
        };
    }

    drawButton.addEventListener('click', makeButtonClickHandler(drawButton, false, 'Marker Size'));
    eraseButton.addEventListener('click', makeButtonClickHandler(eraseButton, true, 'Eraser Size'));

    // Keyboard accessibility for the chevron — it's a span with role="button"
    [
        [drawButton.querySelector('.marker-size-trigger'),  drawButton],
        [eraseButton.querySelector('.marker-size-trigger'), eraseButton]
    ].forEach(([chevron, btn]) => {
        chevron.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isPopoverMode()) return;
                togglePopover(btn);
            }
        });
    });

    // Outside tap closes the popover.
    document.addEventListener('pointerdown', (e) => {
        if (!sliderContainer.classList.contains('is-open')) return;
        if (sliderContainer.contains(e.target)) return;
        if (e.target.closest('.marker-size-trigger')) return;
        closePopover();
    });

    // If the viewport leaves popover-mode while the popover is open
    // (e.g. user rotates the device), close it and move the slider back
    // to its original inline home (drawing-tools-container in slot-left)
    // so the desktop/tablet-landscape inline layouts continue to work.
    popoverMq.addEventListener('change', (e) => {
        if (!e.matches) {
            closePopover();
            restoreOriginalParent();
        }
    });

    // Wire reset modal handlers on first click (modal doesn't exist at init time).
    let resetListenersAttached = false;

    resetDrawingButton.addEventListener('click', () => {
        if (!AppState.skinMesh?.userData?.context) return;

        closePopover();

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