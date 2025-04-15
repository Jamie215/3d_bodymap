import { createScene, resizeRenderer } from './scene.js';
import { loadModel } from './modelLoader.js';
import { enableInteraction, setupCursorManagement } from './interaction.js';
import { createDrawingControls } from './drawingControls.js';
import { createViewControls } from './viewControls.js';

// Initial UI setup
const appContainer = document.createElement('div');
appContainer.id = 'app-container';
document.body.appendChild(appContainer);

// Left panel (Drawing Controls)
const drawingControlsPanel = document.createElement('div');
drawingControlsPanel.id = 'drawing-control-panel';
appContainer.appendChild(drawingControlsPanel);

// Center panel (Canvas/3D Model)
const canvasPanel = document.createElement('div');
canvasPanel.id = 'canvas-panel';
appContainer.appendChild(canvasPanel);

// Right panel (View Controls)
const viewControlsPanel = document.createElement('div')
viewControlsPanel.id = 'view-control-panel';
appContainer.appendChild(viewControlsPanel);

// Models
const models = [
    { name: 'Model 1', file: './assets/female_young_avgheight.glb' },
    { name: 'Model 2', file: './assets/male_young_avgheight.glb' }
];

// Create scene, camera, renderer
const { scene, camera, renderer, controls } = createScene(canvasPanel);

// Hook up modules
createDrawingControls(drawingControlsPanel);
createViewControls(scene, controls, viewControlsPanel, models);
enableInteraction(renderer, camera, controls);
setupCursorManagement(renderer);

// Handle window resize
window.addEventListener('resize', () => resizeRenderer(camera, renderer, canvasPanel));
resizeRenderer(camera, renderer, canvasPanel);

window.camera = camera;
window.controls = controls;

function zoomCameraForMobile() {
    if (window.innerWidth <= 768) {
      // Adjust the initial camera position for mobile
      if (camera && controls) {
        // Get current direction vector
        const direction = new THREE.Vector3().subVectors(
          camera.position,
          controls.target
        ).normalize();
        
        // Default distance
        const defaultDistance = 1.5; 
        
        // Use a closer distance for mobile
        const mobileDistance = 1.0; 
        
        // Set new position
        camera.position.copy(
          controls.target.clone().add(
            direction.multiplyScalar(mobileDistance)
          )
        );
        
        // Update controls
        controls.update();
      }
    }
}

// Load initial model and then zoom for mobile
loadModel(models[0].file, models[0].name, scene, controls);

// Call zoom after a short delay to ensure model is loaded
setTimeout(() => {
    zoomCameraForMobile();
}, 500);

function setupMobileLayout() {
    // Check if we're on a mobile device
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const appContainer = document.getElementById('app-container');
        const canvasPanel = document.getElementById('canvas-panel');
        const drawingPanel = document.getElementById('drawing-control-panel');
        const viewPanel = document.getElementById('view-control-panel');
        
        // Check if mobile container already exists
        let mobileContainer = document.querySelector('.mobile-controls-container');
        
        if (!mobileContainer) {
          // Create container for the controls
          mobileContainer = document.createElement('div');
          mobileContainer.classList.add('mobile-controls-container');
          
          // Reorder elements
          appContainer.appendChild(canvasPanel); // Canvas first
          appContainer.appendChild(mobileContainer); // Controls container second
          
          // Move panels into the mobile container
          mobileContainer.appendChild(drawingPanel);
          mobileContainer.appendChild(viewPanel);
          
          // Simplify UI text
          simplifyMobileUI();
        }
    } else {
    // Reset to desktop layout if needed
    resetToDesktopLayout();
    }
}

function simplifyMobileUI() {
    // Convert vertical slider to horizontal
    const slider = document.querySelector('.vertical-slider');
    if (slider) {
        slider.style.transform = 'none';
        slider.style.position = 'static';
        slider.style.width = '100%';
    }
    
    // Hide instructions
    const instructions = document.querySelectorAll('.instruction');
    instructions.forEach(el => {
        el.style.display = 'none';
    });
}

function resetToDesktopLayout() {
    // Get references to elements
    const appContainer = document.getElementById('app-container');
    const canvasPanel = document.getElementById('canvas-panel');
    const drawingPanel = document.getElementById('drawing-control-panel');
    const viewPanel = document.getElementById('view-control-panel');
    const mobileContainer = document.querySelector('.mobile-controls-container');
    
    // Only reset if we were in mobile layout
    if (mobileContainer) {
      // Move panels back to app container
      appContainer.insertBefore(drawingPanel, appContainer.firstChild);
      appContainer.insertBefore(canvasPanel, appContainer.childNodes[1] || null);
      appContainer.appendChild(viewPanel);
      
      // Remove mobile container
      mobileContainer.remove();
      
      // Reset UI text
      const titleElements = document.querySelectorAll('.control-title');
      titleElements.forEach(element => {
        if (element.textContent === 'Draw') {
          element.textContent = 'Drawing Controls';
        } else if (element.textContent === 'View') {
          element.textContent = 'Adjust Body View:';
        } else if (element.textContent === 'Rotate') {
          element.textContent = 'Change the Direction the Body is Facing:';
        }
      });
      
      // Show instructions again
      const instructions = document.querySelectorAll('.instruction');
      instructions.forEach(el => {
        el.style.display = 'flex';
      });
    }
  }

// Call this function after your initial UI setup
window.addEventListener('DOMContentLoaded', setupMobileLayout);
window.addEventListener('resize', setupMobileLayout);

// Start render loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Update status when ready
console.log('Application initialized');