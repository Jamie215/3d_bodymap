const AppState = {
    // Model state
    model: null,
    modelRoot: null,           // Root object for model transformations
    skinMesh: null,
    currentModelName: 'Model 2',
    
    // Drawing state
    isDrawing: false,          // Whether the view is in drawing mode
    isErasing: false,          // Whether the draw mode is erasing
    brushRadius: 10,
    
    // Texture state
    baseTextureCanvas: null,
    baseTextureContext: null,
    baseTextureTexture: null,
    
    // Drawing instances (multiple pain areas)
    drawingInstances: [],
    currentDrawingIndex: 0,
    
    // Region mapping data
    globalUVMap: null,
    globalPixelRegionMap: null,
    faceRegionMap: null,
    regionToIdMap: null,
    idToRegionMap: null,

    // Body region area calculator
    coverageCalculator: null,
    
    // Camera utilities
    cameraUtils: null,
    
    // Region selector state
    selectedRegion: null,      // Currently selected region from modal (e.g., "Left Shoulder", "Head")
    
    // Survey state
    currentSurveyIndex: 0,
    isEditingFromSurvey: false,
    generalQuestionnaireResponse: null
};

export default AppState;