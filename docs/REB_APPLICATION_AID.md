# 3D Pain & Symptom Application

### Study Design Overview — prepared by Jamie Kim (MSK-IF)

## How to use this document

This document's purpose is to describe what the application does, and the ethical and privacy
measures already engineered into the tool. It deliberately stays at the application level and
high level, supporting the Principal Investigator (PI)'s study design. Final interpretation of
ethics and privacy requirements should be confirmed with Western University's Human Research
Ethics Boards.

---

## 1. Purpose & overview of the application

3D Pain & Symptom Application is a self-administered clinical tool for patient-reported pain and
symptom assessment, with questionnaires focused on spinal pain. A participant draws the area(s)
where they experience pain or symptoms directly onto an interactive 3D anatomical body model,
then answers a short set of clinically developed questionnaires about each area and about their
medication use. The questionnaire content was developed by the CANSpine Team at Western
University.

The tool currently runs as a stand-alone web application with no backend. When a session is
complete, the participant's responses are packaged entirely in their browser and downloaded as a
single file, which is then stored on a provided encrypted device.

## 2. What the application does

The participant moves through a short, guided workflow, intended for use on a desktop browser:

1. **Select a body type** — choose between two anatomical models.
2. **Draw an area** — paint one area of pain or symptom onto the 3D body surface (with brush,
   eraser, and camera-rotation controls).
3. **Complete the area questionnaire** — answer questions about that specific drawn area.
4. **Repeat** — add additional pain/symptom areas as needed.
5. **Complete the general questionnaire** — answer questions about overall pain or symptoms and
   medication use.
6. **Save** — the session is assembled and downloaded; the participant saves the file to the
   provided encrypted device and confirms they have done so before finishing.

## 3. Technology stack & hosting

### Technologies used

| Technology | Purpose | Ethics-relevant note |
|---|---|---|
| Vanilla ES modules (no framework, no build step) | Application code | Runs directly in the browser; nothing compiled or obfuscated |
| Three.js | 3D model rendering and drawing | Self-hosted (see below) |
| SurveyJS | Questionnaire rendering and validation | Self-hosted |
| Driver.js | On-screen usage tips | Self-hosted |
| Font Awesome, Inter font | Icons and typography | Self-hosted |
| JSZip | Bundles the response file in the browser | Client-side only; no upload |

All third-party libraries, stylesheets, and fonts are self-hosted from the application's own
origin. The participant's browser is not asked to contact any third-party CDN, font service, or
analytics provider. This is itself a privacy measure, where no outside party apart from the host
receives the participant's IP address or any signal that they are using the tool.

### Hosting & deployment

The application is a fully static website — a fixed set of files with no application server
running behind them — hosted on Cloudflare Pages, a standard web-hosting service. Because there
is no server-side application logic, nothing on the host processes or stores participant data.
The only server-side component is a small helper that fetches the 3D-model asset files (the body
models, a texture, and preview thumbnails) from a private content-delivery network so they are
served from the application's own web address; it handles no participant data.

Because participant responses are never uploaded, the host stores no participant data. As with
any hosted web page, the host does see the participant's IP address as an inherent part of
serving the page.

### Hosting security posture

The security posture is anchored in the architecture: because the application has no backend, no
database, and transmits no participant data, there is no server-side store of responses that
could be breached. The server-side attack surface for participant data is effectively
eliminated. The remaining hosting considerations are generic:

- **Encrypted transport (HTTPS/TLS).** Cloudflare Pages automatically redirects HTTP requests to
  secure HTTPS, and the application requires HTTPS to run.
- **Publicly reachable URL, no login.** Anyone with the link can open the tool, but since nothing
  is stored on the server, unauthorized use only ever produces a file on that person's own
  machine. Who participates and how to participate is controlled by the study, not by the
  application.

## 4. What data the application collects

### Data in the downloaded file

| Data | Notes |
|---|---|
| Session identifier | A random, non-identifying value generated per session; used only to name the file and link its parts |
| Timestamps & duration | Session start/end and wall-clock length |
| Model type | Which body model was used |
| Drawn regions & coverage metrics | Which anatomical regions were painted, and surface-area coverage percentages |
| Questionnaire responses | Area-specific and general questionnaire answers (see below) |
| Body-view snapshots | Four-angle images of the 3D model showing where the participant drew |

### What is NOT collected

- No direct identifiers — no name, email, date of birth, health-card number, or medical-record
  number anywhere in the application.
- No photographs or images of the participant — snapshots are of the 3D model only.
- No device or browser information — nothing about the participant's device, operating system, or
  browser is recorded.
- No analytics or tracking — no Google Analytics or similar.
- No geolocation or other sensitive device sensors.

### Nature of the data

The collected data includes personal health information such as pain location, severity,
frequency, duration, an intensity rating (0–10), functional interference, and medication use
(including categories such as narcotic pain medication and cannabis), plus a question about
whether onset coincided with a stressful time. Although the dataset is de-identified by design
(no direct identifiers, random session id), it is sensitive, and the tool is built accordingly.

The questionnaires also include a small number of free-text fields (e.g. "What does your pain or
symptom feel like?", optional comments). Free text is the usual way a de-identified dataset can
inadvertently pick up identifying information. Due to this, there may be a need at a study level
for a process to review and scrub for identifiers before the analysis.

## 5. Ethical measures built into the application

Each measure below is already implemented in the tool.

- **Data minimization.** No direct identifiers are collected, and no device, operating-system, or
  browser information is recorded. The session identifier is random and non-identifying, and the
  raw browser user-agent is never read.
- **No participant imagery.** The tool never photographs the participant. All captured images are
  of the 3D anatomical model showing where the participant drew.
- **Privacy by architecture.** The application is fully client-side with no backend and no
  transmission of participant data. Responses are downloaded and stored on a provided encrypted
  device, and a safeguard warns the participant if they try to leave before confirming they have
  saved their file. An incomplete session leaves data nowhere.
- **Participant retains control of their data.** Because there is no server copy, the participant
  physically holds the only copy of their responses (the downloaded file). This supports data
  control and makes withdrawal straightforward.
- **Automatic session clearing (shared-device protection).** To prevent one participant's data
  from lingering on a shared device, the application clears the session from memory — the
  drawings, questionnaire answers, and the prepared response file — and returns to a fresh start
  page in two cases: when the participant finishes (after they have saved their file), and after
  a period of inactivity. An inactivity watchdog (by default, 10 minutes idle, then a 60-second
  "Are you still there?" warning that the participant can dismiss with "Continue session") resets
  an abandoned session so the next person on the same device does not see the previous
  participant's responses. The reset is never silent — the participant is shown a brief
  "Assessment complete" or "Session reset" notice. The idle thresholds are configurable for the
  study.
- **No third-party contact or tracking.** All libraries, fonts, and styles are self-hosted from
  the application's own origin; the tutorial video is served from the same origin as well. There
  are no analytics/tracking and no geolocation. The participant's browser contacts only the
  application's own domain.
- **Usability and participant experience.** The tool was designed to be approachable for
  participants: a simple, uncluttered interface, plain and neutral wording throughout, and a
  guided workflow with short built-in tutorials, so participants can complete the assessment
  without technical assistance.
- **Note:** The application assumes that informed consent is obtained during study enrolment,
  prior to data collection.

## 6. Anticipated data-collection SOP

The following is an anticipated workflow for the PI to review and adjust; study logistics are the
PI's to finalize.

1. Participant is enrolled and consented through the study's enrolment procedure.
2. Participant is given access to the tool (on a desktop browser) and an encrypted storage
   device.
3. Participant completes the drawing and questionnaires.
4. Participant downloads the response bundle at the end of the session. When downloading, the
   application prompts the participant to choose where to save, so the file can be written
   directly to the provided encrypted device. (On browsers that do not support choosing a save
   location, the file is written to the Downloads folder and must then be moved to the encrypted
   device and the local copy deleted.)
5. Participant confirms the file is saved before finishing.
6. Device and data are handled per the study's data-management plan (i.e. custody, retention
   period, deletion of any local copies).

## Appendix — data output reference

When a session is saved, the browser produces a single archive containing one participant's
completed assessment:

```
pain-assessment_<stamp>_<id>/
  metadata.json                          full record (canonical)
  snapshots/{front,back,left,right}.png  all areas, four angles
  areas/area-<n>/{front,back,left,right}.png   each area alone
  csv/
    session.csv    one row  — session metadata + general questionnaire
    areas.csv      one row per area — summary + area questionnaire
    coverage.csv   long format — one row per (area, region)
    README.md      the data dictionary (explains every column)
```

- `<stamp>` is a local date/time; `<id>` is the random, non-identifying session id.
- **Join keys:** `sessionId` links every file to the session; `areaNumber` links the per-area
  files together.
- Every column is documented in the bundled data dictionary; the canonical copy is
  `docs/DATA_DICTIONARY.md`.
