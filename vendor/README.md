# Vendored third-party assets

These libraries, fonts, and stylesheets are **self-hosted** and served
same-origin so the participant's browser never contacts a third-party CDN.
Previously they loaded at runtime from unpkg, jsDelivr, cdnjs, d3js.org and
Google Fonts; those requests exposed the participant's IP to each host.

All files were obtained from the npm registry at the exact versions below (not
re-downloaded from a CDN) and copied here unmodified except where noted.

| Path | Package (npm) | Version | Notes |
|---|---|---|---|
| `three/three.module.js` | three | 0.175.0 | ES module build |
| `three/addons/controls/OrbitControls.js` | three | 0.175.0 | from examples/jsm |
| `three/addons/loaders/GLTFLoader.js` | three | 0.175.0 | from examples/jsm |
| `three/addons/utils/BufferGeometryUtils.js` | three | 0.175.0 | dependency of GLTFLoader |
| `knockout/knockout-latest.js` | knockout | 3.5.1 | |
| `surveyjs/survey.ko.min.js` | survey-knockout | 1.12.67 | was previously unpinned on unpkg |
| `surveyjs/defaultV2.min.css` | survey-knockout | 1.12.67 | Open Sans @font-face blocks (→ fonts.gstatic.com) removed; falls back to the theme's Helvetica/Arial/sans-serif stack |
| `d3/d3.v7.min.js` | d3 | 7.9.0 | UMD build (dist/d3.min.js) |
| `driverjs/driver.js.iife.js`, `driverjs/driver.css` | driver.js | 1.3.1 | |
| `fontawesome/css/all.min.css` + `fontawesome/webfonts/*` | @fortawesome/fontawesome-free | 7.0.1 | |
| `fonts/inter/*` + `fonts/inter/inter.css` | @fontsource/inter | 5.3.0 | Inter, latin subset, weights 400/500/600/700; replaces the Google Fonts @import in assets/css/base.css |

## Updating a library

Install the desired version from npm and copy the same files here, e.g.:

    npm pack three@<version>        # or npm install into a scratch dir
    # copy build/three.module.js and the examples/jsm addons in use

Re-check any vendored CSS for `@font-face`/`url()` pointing at an external host
(SurveyJS ships Open Sans faces that must be stripped or self-hosted) and keep
the version table above in sync.
