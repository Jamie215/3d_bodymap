const AppState = {
    model: null,
    skinMesh: null,
    isDrawing: false, // boolean for whether or not the view is in drawing view
    isErasing: false, // boolean for whether or not the drawmode is in erasing or not
    brushRadius: 15,
    currentModelName: 'Model 2',
    baseTextureCanvas: null,
    baseTextureContext: null,
    baseTextureTexture: null,
    drawingInstances: [],
    currentDrawingIndex: 0,
    globalUVMap: null,
    globalPixelRegionMap: null,
    faceRegionMap: null,
    regionToIdMap: null,
    idToRegionMap: null,
    cameraUtils: null,
    currentSurveyIndex: 0,
    isEditingFromSurvey: false,
    generalSurveyResponse: null
};

export default AppState;