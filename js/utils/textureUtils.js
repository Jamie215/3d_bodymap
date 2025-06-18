import AppState from '../app/state.js';
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';

export function generateMergedTextureFromDrawings() {
  if (AppState.drawingInstances.length === 0 || !AppState.drawingInstances[0].canvas) return null;

  const width = AppState.drawingInstances[0].canvas.width;
  const height = AppState.drawingInstances[0].canvas.height;

  const mergedCanvas = document.createElement('canvas');
  mergedCanvas.width = width;
  mergedCanvas.height = height;
  const mergedContext = mergedCanvas.getContext('2d');
  mergedContext.fillStyle = '#ffffff';
  mergedContext.fillRect(0, 0, width, height);

  const mergedImageData = mergedContext.createImageData(width, height);
  const mergedData = mergedImageData.data;

  // Set all pixels to white
  for (let i = 0; i < mergedData.length; i += 4) {
    mergedData[i] = 255;
    mergedData[i + 1] = 255;
    mergedData[i + 2] = 255;
    mergedData[i + 3] = 255;
  }

  // Overlay per-instance colours
  AppState.drawingInstances.forEach(instance => {
    const ctx = instance.canvas.getContext('2d');
    const srcImageData = ctx.getImageData(0, 0, width, height);
    const srcData = srcImageData.data;

    for (let j = 0; j < srcData.length; j += 4) {
      const a = srcData[j + 3];
      const isDrawnPixel = a > 0 && !(srcData[j] === 255 && srcData[j + 1] === 255 && srcData[j + 2] === 255);
      if (isDrawnPixel) {
        mergedData[j] = srcData[j];
        mergedData[j + 1] = srcData[j+1];
        mergedData[j + 2] = srcData[j+2];
        mergedData[j + 3] = 255;
      }
    }
  });

  mergedContext.putImageData(mergedImageData, 0, 0);

  const texture = new THREE.CanvasTexture(mergedCanvas);
  texture.needsUpdate = true;

  return texture;
}

function hexToRGB(hexColor) {
  const hex = hexColor.replace('#', '');
  const bigint = parseInt(hex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

