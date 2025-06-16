const AppState = {
    model: null,
    skinMesh: null,
    isDrawing: false, // boolean for whether or not the view is in drawing view
    isErasing: false, // boolean for whether or not the drawmode is in erasing or not
    brushRadius: 15,
    currentModelName: 'Model 1',
    drawingInstances: [],
    currentDrawingIndex: 0,
    globalUVMap: null,
    globalPixelBoneMap: null,
    faceBoneMap: null
};

export default AppState;