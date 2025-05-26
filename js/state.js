const AppState = {
    model: null,
    skinMesh: null,
    isDrawing: false,
    isErasing: false,
    brushRadius: 15,
    currentModelName: 'Model 1',
    drawingInstances: [],
    currentDrawingIndex: 0,
    drawnBoneNames: new Set(),
    bonePixelMap: {}
};

export default AppState;
