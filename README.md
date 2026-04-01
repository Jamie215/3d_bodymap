# 3D Pain & Symptom Assessment Application

A clinical web application where patients draw pain and symptom areas on an interactive 3D anatomical body model and complete associated questionnaires. Designed for integration with the EmPOWER/SPINA platform as an embeddable widget.

## Overview

The application guides patients through a multi-step workflow:

1. **Select a body type** — choose between two anatomical models
2. **Draw on the 3D model** — paint one area of pain or symptom directly onto the body surface
3. **Complete an area questionnaire** — answer clinically validated questions about that specific area
4. **Repeat** — add additional pain/symptom areas as needed
5. **General questionnaire** — answer questions about overall medication use and history
6. **Submission** — all drawing data, coverage metrics, questionnaire responses, and multi-view snapshots are assembled into a structured JSON payload

## Core Capabilities

- **UV-based drawing** on a 3D mesh with 315 anatomical regions defined as Blender vertex groups
- **Real-time coverage calculation** using 3D triangle surface area (cross-product method), avoiding UV density bias
- **Intelligent camera positioning** that reads anatomical naming conventions (anterior/posterior, medial/lateral) to determine optimal viewing angles
- **Region visibility filtering** via a custom GPU shader that hides non-selected body parts when focusing on limbs
- **Mirrored drawing at the body centerline** so strokes near the midline seam appear on both sides
- **SurveyJS-powered questionnaires** with area-specific and general forms, custom renderers, and progress tracking
- **Structured JSON output** containing per-area drawings, questionnaire data, body coverage metrics, multi-view snapshots, and session metadata

## Tech Stack

| Technology | Purpose |
|---|---|
| [Three.js](https://threejs.org/) r175 | 3D rendering, raycasting, texture management |
| Vanilla ES modules | Application code — no bundler, no framework |
| Import map (`index.html`) | Resolves `three` and `three/addons/` from CDN |
| [SurveyJS / SurveyKO](https://surveyjs.io/) | Questionnaire rendering and validation |
| [Driver.js](https://driverjs.com/) | Onboarding tooltip sequences |
| [Font Awesome](https://fontawesome.com/) 7 | UI icons |
| [D3.js](https://d3js.org/) v7 | Available for data visualization (loaded, not actively used) |

No build process required — the application runs directly in a modern browser from `index.html`.

## Project Structure

```
├── index.html                      Entry point — imports, shell markup, import map
├── assets/
│   ├── css/
│   │   ├── styles.css              Root @import sheet (6 lines)
│   │   ├── base.css                Design tokens, reset, accessibility, print
│   │   ├── layout.css              App shell grid, per-stage responsive layouts
│   │   ├── components.css          Buttons, panels, sliders, drawers, controls
│   │   ├── modals.css              All modal styles (shared base + per-modal)
│   │   └── survey.css              SurveyJS overrides and survey panel styles
│   ├── female.glb                  Type 1 body model (GLTF binary)
│   ├── male.glb                    Type 2 body model (GLTF binary)
│   ├── body_ao_modified.png        Ambient occlusion texture
│   ├── region_id_mapping.json      Vertex group name ↔ numeric ID mapping
│   └── preview_svg/                Model selection preview images
│
├── js/
│   ├── app/                        Application orchestration
│   │   ├── main.js                 Entry point — DOM scaffolding, scene, views, resize
│   │   ├── appController.js        Event wiring between views, modals, and services
│   │   ├── stageRouter.js          Stage transitions — texture, camera, interaction setup
│   │   ├── stageLayout.js          DOM slot swapping per stage (view layer for stageRouter)
│   │   ├── drawingInstanceManager.js  Drawing instance CRUD, color assignment, previews
│   │   ├── state.js                Global AppState singleton (fully typed with JSDoc)
│   │   ├── eventManager.js         Centralized event listener tracking and cleanup
│   │   ├── tooltipRunner.js        Driver.js wrapper — runs tooltip sequences
│   │   └── tooltipSteps.js         Tooltip step definitions (pure data)
│   │
│   ├── components/                 Reusable UI components
│   │   ├── drawingControls.js      Draw/erase/reset buttons, brush size slider
│   │   ├── viewControls.js         Region selector setup, canvas rotation buttons
│   │   ├── loadingIndicator.js     Model loading progress bar
│   │   ├── videoEmbed.js           YouTube embed with fullscreen overlay
│   │   ├── modal.js                Barrel re-export for all modal modules
│   │   └── modals/
│   │       ├── modalBase.js        Shared DOM factory helpers
│   │       ├── getModalElements.js Unified element getter dispatch
│   │       ├── onboardingModal.js  First-visit instruction overlay
│   │       ├── confirmDrawingModal.js  "Done Drawing" preview + 3-button layout
│   │       ├── resetModal.js       "Erase All" confirmation
│   │       ├── deleteEmptyModal.js Empty drawing warning
│   │       ├── deleteAreaModal.js  Area deletion confirmation
│   │       └── regionSelectorModal.js  Body region selector with cascading dropdowns
│   │
│   ├── services/                   Stateful singletons and business logic
│   │   ├── cameraService.js        Camera control — focusing, rotation, animation
│   │   ├── coverageService.js      3D surface area coverage calculation
│   │   ├── drawingEngine.js        UV painting, pointer dispatch, region init
│   │   ├── modelLoader.js          GLTF loading, material setup, region shader
│   │   ├── submissionService.js    Payload assembly, multi-view snapshots
│   │   ├── surveyManager.js        SurveyJS lifecycle, validation, data persistence
│   │   ├── surveyCustomRenderers.js  Custom onAfterRenderQuestion hooks
│   │   └── texturePool.js          Canvas/texture pair management
│   │
│   ├── utils/                      Pure or near-pure utility functions
│   │   ├── cursorManager.js        Custom draw/erase cursor
│   │   ├── interaction.js          Pointer event handling for drawing
│   │   ├── orientationAnalyzer.js  Region → viewing direction classification
│   │   ├── orbitOffsets.js         Per-region camera orbit adjustments
│   │   ├── regionHierarchy.js      Region hierarchy data + mapping functions
│   │   ├── regionMapBuilder.js     Auto-generates camera regionMap from vertex groups
│   │   ├── regionTracker.js        Pixel-level region tracking for draw/erase
│   │   ├── regionVisibility.js     GPU shader uniform control for region hiding
│   │   ├── responsiveManager.js    Centralized breakpoint and media query management
│   │   ├── scene.js                Three.js scene, camera, renderer, controls setup
│   │   └── uvRasterizer.js         UV triangle rasterization and region lookup
│   │
│   ├── views/                      Stage-specific DOM construction
│   │   ├── drawingView.js          Drawing stage header, controls, footer, status bar
│   │   ├── selectionView.js        Model selection panel and buttons
│   │   ├── summaryView.js          Area list with edit/delete, completion state
│   │   └── surveyView.js           Survey panel, header, progress bar, navigation
│   │
│   └── data/                       Pure config and survey definitions
│       ├── areaSurvey.js           Area-specific questionnaire JSON
│       ├── generalSurvey.js        General questionnaire JSON
│       └── surveyTheme.js          SurveyJS theme and CSS variable overrides
```

## Architecture

### Application Stages

The app operates as a finite state machine with five stages, managed by `stageRouter.js` (state and textures) and `stageLayout.js` (DOM slot swapping):

| Stage | Description |
|---|---|
| `summary` | Home view — shows logged areas or getting-started video |
| `selection` | Body type picker (Type 1 / Type 2) |
| `drawing` | Interactive 3D drawing with brush/eraser tools |
| `area-survey` | Per-area questionnaire (SurveyJS) |
| `general-survey` | General questionnaire about medications |

### Drawing Pipeline

1. User selects a body region via the region selector modal
2. Camera focuses on that region; limb isolation shader hides other parts if needed
3. Pointer events raycast into the 3D mesh → hit UV coordinates
4. `drawingEngine.js` paints pixels on a 1024×1024 canvas texture
5. `regionTracker.js` records which anatomical regions have drawn pixels
6. On "Done Drawing," a preview snapshot is generated and the user proceeds to the area survey

### Data Flow

Each drawing instance owns its own canvas, texture, region tracking, and questionnaire data. On submission, `submissionService.js` composites all instances, captures four-angle snapshots, calculates per-area coverage via `coverageService.js`, and assembles the complete JSON payload.

## Integration

Firebase has been removed. The submission endpoint in `appController.js` is a clearly marked stub:

```js
// ── Integration point ──────────────────────────────────────
// Replace with your platform's API call:
//   const response = await apiService.submit(submissionData);
//   const success = response.ok;
//
// For now, simulate success to keep the app testable:
const success = true;
// ───────────────────────────────────────────────────────────
```

The `submissionData` object (typed as `SubmissionPayload` in `submissionService.js`) contains session timing, model type, per-area drawings with coverage metrics and questionnaire responses, multi-view snapshots, general questionnaire data, and device metadata.

## Getting Started

1. Clone this repository
2. Serve the project directory with any static HTTP server (e.g., `python -m http.server 8000`)
3. Open `http://localhost:8000` in a modern browser
4. No build step, no `npm install` — runs directly from source

> **Note:** The app must be served over HTTP(S), not opened as a `file://` URL, because ES modules and `fetch()` require a server context.

## Questionnaires

Questionnaire content was developed by the CANSpine Team at Western University. The area-specific survey covers pain description, severity, frequency, duration, intensity (0–10 scale), and conditional follow-ups for main areas. The general survey covers medication usage with a matrix input for seven medication categories.

## Credits

### 3D Models

- Human manikin model created using [MPFB](https://github.com/makehumancommunity/mpfb) (MakeHuman Plugin for Blender) and [Blender](https://www.blender.org/)
  - MPFB licensed under AGPL/CC0
  - Blender licensed under GNU GPL

### MakeHuman Community Assets

**CC0 Assets:**
- "Short Hair 02" by makehuman_system — [makehumancommunity.org](https://www.makehumancommunity.org)
- "Short Hair 03" by makehuman_system — [makehumancommunity.org](https://www.makehumancommunity.org)

**CC-BY 4.0 Assets:**
- "Elvs Crude Bootyshorts 1" by Elvaerwyn — [link](http://www.makehumancommunity.org/clothes/elvs_crude_bootyshorts1.html)
- "Bandeau Bra" by Punkduck — [link](http://www.makehumancommunity.org/clothes/bandeau_bra.html)
- Licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

### Technologies

- [Three.js](https://threejs.org/) — MIT License
- [SurveyJS / SurveyKO](https://surveyjs.io/) — MIT License
- [Driver.js](https://driverjs.com/) — MIT License
- [Inter font family](https://fonts.google.com/specimen/Inter) — SIL Open Font License
- [Font Awesome](https://fontawesome.com/) — Icons (Free tier)
- [D3.js](https://d3js.org/) — ISC License

### Questionnaires

Questionnaire content was developed by the CANSpine Team at Western University.

### Development

All other code and assets were developed by Jamie Kim, FHS MSK-IF at Western University.
