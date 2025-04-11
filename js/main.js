import { createScene, resizeRenderer } from './scene.js';
import { loadModel } from './modelLoader.js';
import { enableInteraction } from './interaction.js';
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
enableInteraction(renderer, camera, scene, controls);

// Load initial model
loadModel(models[0].file, models[0].name, scene, controls);

// Handle window resize
window.addEventListener('resize', () => resizeRenderer(camera, renderer, canvasPanel));
resizeRenderer(camera, renderer, canvasPanel);

// Start render loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Update status when ready
console.log('Application initialized');