import AppState from '../app/state.js';
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';

export function generateMergedTextureFromDrawings() {
  if (AppState.drawingInstances.length === 0 || !AppState.drawingInstances[0].canvas) return null;

  const width = AppState.drawingInstances[0].canvas.width;
  const height = AppState.drawingInstances[0].canvas.height;

  const mergedCanvas = document.createElement('canvas');
  mergedCanvas.width = width;
  mergedCanvas.height = height;
  const mergedCtx = mergedCanvas.getContext('2d');
  mergedCtx.fillStyle = '#ffffff';
  mergedCtx.fillRect(0, 0, width, height);

  const mergedImageData = mergedCtx.createImageData(width, height);
  const mergedData = mergedImageData.data;

  // Set all pixels to white
  for (let i = 0; i < mergedData.length; i += 4) {
    mergedData[i] = 255;
    mergedData[i + 1] = 255;
    mergedData[i + 2] = 255;
    mergedData[i + 3] = 255;
  }

  // Overlay purple pixels
  AppState.drawingInstances.forEach(instance => {
    const ctx = instance.canvas.getContext('2d');
    const srcImageData = ctx.getImageData(0, 0, width, height);
    const srcData = srcImageData.data;

    for (let j = 0; j < srcData.length; j += 4) {
      const r = srcData[j], g = srcData[j+1], b = srcData[j+2], a = srcData[j+3];
      const isPurple = r === 149 && g === 117 && b === 205 && a > 0;
      if (isPurple) {
        mergedData[j] = r;
        mergedData[j+1] = g;
        mergedData[j+2] = b;
        mergedData[j+3] = 255;
      }
    }
  });

  mergedCtx.putImageData(mergedImageData, 0, 0);

  const texture = new THREE.CanvasTexture(mergedCanvas);
  texture.needsUpdate = true;

  return texture;
}
