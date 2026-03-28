/**
 * @typedef {Object} AppStateShape
 *
 * @property {THREE.Group|null}            model              — Root scene object for the loaded GLTF model
 * @property {THREE.Object3D|null}         modelRoot          — Root object for model transformations
 * @property {THREE.Mesh|null}             skinMesh           — The 'Human' mesh with drawing texture and region shader
 * @property {string}                      currentModelName   — Display name of the active model ('Type 1', 'Type 2')
 *
 * @property {boolean}                     isDrawing          — Whether pointer events are actively painting
 * @property {boolean}                     isErasing          — Whether the draw mode is set to erase
 * @property {number}                      brushRadius        — Brush/eraser radius in texture pixels (5–30)
 *
 * @property {HTMLCanvasElement|null}       baseTextureCanvas  — White base texture canvas (shared across instances)
 * @property {CanvasRenderingContext2D|null} baseTextureContext
 * @property {THREE.CanvasTexture|null}    baseTextureTexture
 *
 * @property {Set<number>|null}            visibleRegionIds   — Currently visible region IDs (null = all visible)
 *
 * @property {DrawingInstance[]}           drawingInstances   — All pain/symptom area drawing instances
 * @property {number}                      currentDrawingIndex — Index of the active drawing instance
 *
 * @property {Map<string,boolean>|null}    globalUVMap         — Pixel key → true for all valid UV-mapped pixels
 * @property {Map<string,string>|null}     globalPixelRegionMap — Pixel key → region name
 * @property {Map<number,string|null>|null} faceRegionMap      — Face index → dominant region name
 * @property {Object<string,number>|null}  regionToIdMap       — Vertex group name → numeric region ID
 * @property {Object<number,string>|null}  idToRegionMap       — Numeric region ID → vertex group name
 *
 * @property {import('../services/coverageService.js').default|null} coverageCalculator
 * @property {import('../services/cameraService.js').default|null}   cameraUtils
 *
 * @property {string|null}                 selectedRegion      — Currently selected region from the region selector modal
 *
 * @property {number}                      currentSurveyIndex  — Index of the drawing instance whose survey is active
 * @property {boolean}                     isEditingFromSurvey — True when editing a drawing from the survey stage
 * @property {Object|null}                 generalQuestionnaireResponse — Saved general survey data (null until submitted)
 */

/** @type {AppStateShape} */
const AppState = {
    // Model state
    model: null,
    modelRoot: null,
    skinMesh: null,
    currentModelName: 'Model 2',
    
    // Drawing state
    isDrawing: false,
    isErasing: false,
    brushRadius: 10,
    
    // Texture state
    baseTextureCanvas: null,
    baseTextureContext: null,
    baseTextureTexture: null,

    // Visible region state
    visibleRegionIds: null,
    
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
    selectedRegion: null,
    
    // Survey state
    currentSurveyIndex: 0,
    isEditingFromSurvey: false,
    generalQuestionnaireResponse: null
};

export default AppState;