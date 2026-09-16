# 3D BodyMap — Application Ethics Summary

### Supporting input for the Research Ethics Board (REB) proposal

**Application:** 3D Pain &amp; Symptom Assessment Application ("3D BodyMap")
**Prepared for:** Principal Investigator — CANSpine Team, Faculty of Health Sciences (MSK-IF), Western University
**Prepared by:** Development team (Jamie Kim)
**Status of tool:** Interim stand-alone web application (no backend); EmPOWER/SPINA integration pending
**Version:** 1.0 · **Date:** 16 September 2026

---

## How to use this document

This document is an **aid for the Principal Investigator (PI)** in preparing the study's REB
application. **It is not the REB application itself.** Its purpose is to describe, in one place,
**what the application does** and **the ethical and privacy measures already engineered into the
tool**, so the PI can draw on it when completing the official REB submission.

It deliberately stays at the **application level** and **high level**. It does **not** author
study-level content — recruitment, the full consent process and wording, risk/benefit analysis,
investigator credentials, or the data-management plan — all of which are the PI's to write.
Where the application assumes something about the surrounding study (for example, that consent
is obtained during enrolment, outside the tool), that assumption is flagged **"For PI review"**
so the PI knows to confirm and expand it.

> **Disclaimer:** This is descriptive supporting material, not a compliance determination. It
> makes no claim of REB approval. Final interpretation of ethics and privacy requirements should
> be confirmed with the **Western University REB and the Privacy Office**.

---

## 1. Purpose &amp; overview of the application

3D BodyMap is a **self-administered clinical tool for patient-reported pain and symptom
assessment**, with a focus on **spinal pain**. A participant draws the area(s) where they
experience pain or symptoms directly onto an interactive 3D anatomical body model, then answers
a short set of clinically developed questionnaires about each area and about their medication
use. The questionnaire content was developed by the **CANSpine Team at Western University**.

The tool currently runs as an **interim, stand-alone web application with no backend**. When a
session is complete, the participant's responses are packaged **entirely in their browser** and
**downloaded as a single file**, which is then stored on a **provided encrypted device**. A
future integration with the EmPOWER/SPINA platform could transmit the same data instead, but no
such transmission occurs today.

---

## 2. What the application does (participant experience)

The participant moves through a short, guided workflow:

1. **Select a body type** — choose between two anatomical models.
2. **Draw an area** — paint one area of pain or symptom onto the 3D body surface (with brush,
   eraser, and camera-rotation controls). A **non-drawing, name-based alternative** is available
   for participants who cannot use fine pointer drawing: they select body regions by name from a
   guided menu (see Accessibility, §5).
3. **Complete the area questionnaire** — answer questions about that specific area.
4. **Repeat** — add additional pain/symptom areas as needed.
5. **Complete the general questionnaire** — answer questions about overall medication use.
6. **Save** — the session is assembled and downloaded; the participant saves the file to the
   provided encrypted device and confirms they have done so before finishing.

---

## 3. Technology stack &amp; hosting

### Technologies used

| Technology | Purpose | Ethics-relevant note |
|---|---|---|
| Vanilla ES modules (no framework, no build step) | Application code | Runs directly in the browser; nothing compiled or obfuscated |
| Three.js | 3D model rendering and drawing | Self-hosted (see below) |
| SurveyJS | Questionnaire rendering and validation | Self-hosted |
| Driver.js | On-screen usage tips | Self-hosted |
| Font Awesome, Inter font | Icons and typography | Self-hosted (no Google Fonts) |
| JSZip | Bundles the response file **in the browser** | Client-side only; no upload |

**All third-party libraries, stylesheets, and fonts are self-hosted from the application's own
origin** (bundled under `vendor/`). The participant's browser is not asked to contact any
third-party CDN, font service, or analytics provider. This is itself a privacy measure: no
outside party receives the participant's IP address or any signal that they are using the tool.

### Hosting &amp; deployment

The application is a **fully static site hosted on Cloudflare Pages**, published directly from
the code repository. There is **no server-side application logic** handling participant data.
The only server-side component is a small **Cloudflare Pages Function** that proxies the private
3D-model asset files (the body models, a texture, and preview thumbnails) from a private content
delivery network, so those files are served from the application's own domain. The real source
URL is held in Cloudflare environment variables (never in the code or exposed to the browser),
and this component **handles no participant data**.

Because participant responses are never uploaded, **the host stores no participant data**. As
with any hosted web page, the host does see the participant's **IP address** as an inherent part
of serving the page; this is a **data-residency consideration** addressed in the separate Data
Residency Decision Review, not an item of in-app data collection.

### Hosting security posture

The security posture is anchored in the architecture: because the application has **no backend,
no database, and transmits no participant data, there is no server-side store of responses that
could be breached.** The server-side attack surface for participant data is effectively
eliminated. The remaining hosting considerations are generic and low-risk:

- **Encrypted transport (HTTPS/TLS).** Cloudflare Pages automatically **redirects HTTP requests
  to secure HTTPS**, and the application requires HTTPS to run.
- **Publicly reachable URL, no login.** Anyone with the link can open the tool, but since nothing
  is stored on the server, unauthorized use only ever produces a file on that person's own
  machine — no participant data is exposed. *Who* participates is controlled by study enrolment,
  not by the application.
- **Model-asset proxy.** The proxy keeps the private CDN location out of the code, but this is
  obscurity rather than access control. The concern is low because those assets are non-sensitive
  anatomical model geometry, not participant data.

*For PI/dev to confirm: repository visibility (public vs. private).*

### Code transparency

The application is client-side code that is **inherently delivered to, and visible in, every
participant's browser** (via "view source"). Hosting the source in a code repository therefore
exposes nothing that a visitor does not already receive. A review of the repository confirms
that **no secrets, API keys, credentials, or participant data are committed** — the private CDN
location lives only in Cloudflare environment variables, and participant responses exist only as
the participant's local download. Code visibility carries **no participant-privacy impact**, and
open, inspectable code supports independent auditability of these privacy claims.

---

## 4. What data the application collects

### What IS captured (in the downloaded file)

| Data | Notes |
|---|---|
| **Session identifier** | A random, **non-identifying** value generated per session — not derived from anything about the participant; used only to name the file and link its parts |
| **Timestamps &amp; duration** | Session start/end and wall-clock length |
| **Model type** | Which body model was used |
| **Drawn regions &amp; coverage metrics** | Which anatomical regions were painted, and surface-area coverage percentages |
| **Questionnaire responses** | Area-specific and general questionnaire answers (see below) |
| **Body-view snapshots** | Four-angle images **of the 3D model** showing where the participant drew |
| **Coarse device info** | Device type / operating system / browser category only (e.g. Desktop / Windows / Chrome) |

### What is NOT collected

- **No direct identifiers** — no name, email, date of birth, health-card number, or
  medical-record number anywhere in the application.
- **No photographs or images of the participant** — snapshots are of the **3D model only**.
- **No analytics or tracking** — no Google Analytics or similar.
- **No geolocation** or other sensitive device sensors.
- **No raw browser user-agent string** — deliberately dropped in favour of the coarse device
  categories above (data minimization).

### Nature of the data

The questionnaire content is **personal health information** — pain location, severity,
frequency, duration, an intensity rating (0–10), functional interference, and **medication use**
(including categories such as narcotic pain medication and cannabis), plus a question about
whether onset coincided with a stressful time. Although the dataset is **de-identified by design**
(no direct identifiers, random session id), it is sensitive, and the tool is built accordingly.

The questionnaires also include a small number of **free-text fields** (e.g. "What does your pain
or symptom feel like?", optional comments). Free text is the usual way a de-identified dataset can
inadvertently pick up identifying information. *For PI review: the handling of free-text answers
(e.g. review/scrub for identifiers before analysis) is a study-level process for the PI to
describe in the analysis plan.*

---

## 5. Ethical measures built into the application

Each measure below is already implemented in the tool.

- **Data minimization.** No direct identifiers are collected. The session identifier is random
  and non-identifying. The raw browser user-agent is intentionally not stored; only coarse
  device categories are kept.

- **No participant imagery.** The tool never photographs the participant. All captured images are
  of the 3D anatomical model showing where the participant drew.

- **Privacy by architecture.** The application is fully client-side with **no backend and no
  transmission of participant data** (a former server/database backend was removed in favour of
  this design). Responses are downloaded and stored on a **provided encrypted device**, and a
  safeguard warns the participant if they try to leave before confirming they have saved their
  file. *(Minor note: there is no autosave or partial retention — an incomplete session leaves no
  data anywhere, which reinforces minimization but implies the assessment is completed in one
  sitting.)*

- **Participant retains control of their data.** Because there is no server copy, the participant
  physically holds the **only** copy of their responses (the single downloaded file). This
  supports data control and makes withdrawal straightforward. *For PI review: the withdrawal
  procedure itself is a study-level process for the PI to define.*

- **No third-party contact or tracking.** All libraries, fonts, and styles are self-hosted from
  the application's own origin; the tutorial video is served from the same origin (no external
  video embed). There is no analytics/tracking and no geolocation. In normal use the
  participant's browser contacts only the application's own domain.

- **Accessibility and equitable access.** The interface respects the operating-system
  "reduced motion" preference, uses ARIA labels/roles and keyboard support on its controls, and
  offers a **name-based, non-drawing path** to indicate body regions for participants who cannot
  perform fine pointer drawing.

- **Consent boundary (application assumption).** The application does not include an in-app
  consent step; it assumes **informed consent is obtained outside the tool during study
  enrolment**, before the participant uses it. *For PI review: the consent process and its wording
  are the PI's to design and describe in the REB application.*

---

## 6. Anticipated data-collection standard operating procedure (SOP)

The following is a **high-level anticipated workflow** for the PI to review and adjust; study
logistics are the PI's to finalize.

1. Participant is **enrolled and consented** through the study's enrolment procedure. *(For PI
   review: consent process and documentation.)*
2. Participant is given access to the tool on a **provided device**. *(For PI review: who provides
   the device and how it is prepared.)*
3. Participant **completes the drawing and questionnaires**.
4. Participant **downloads the response bundle** at the end of the session.
5. Participant **saves the file to the provided encrypted device**, then **moves it off the local
   machine's Downloads folder and deletes the local copy**. *(See note below.)*
6. Participant **confirms the file is saved** before finishing.
7. Device and data are **handled per the study's data-management plan**. *(For PI review: custody,
   retention period, deletion of local copies, and any later transfer to EmPOWER/SPINA.)*

> **Residual local-copy note (important for the SOP):** the response bundle is written
> **unencrypted** to the browser's default Downloads location before it is moved to the encrypted
> device. The SOP should require moving it to the encrypted device and **deleting the local copy**,
> particularly on any **shared or reused device**.

For device-encryption and data-residency specifics, see the separate **Data Residency Decision
Review** (companion document).

---

## 7. Alignment with the TCPS 2 core principles (application level)

The table maps the application's built-in measures to the three core principles of the Tri-Council
Policy Statement (TCPS 2). Full coverage of each principle is completed at the study level by the
PI; the entries below are the contributions the **tool itself** makes.

| Principle | How the application supports it |
|---|---|
| **Respect for Persons** | Assumes consent is obtained at enrolment (no covert use); "Prefer not to answer" offered on the sensitive onset question; no hidden tracking; participant holds the only copy of their data, supporting withdrawal |
| **Concern for Welfare** | Data minimization (no direct identifiers, coarse device info only); no participant imagery; no server-side data store to breach; responses stored on a provided encrypted device; no third-party data leakage |
| **Justice** | Accessible, equitable design — reduced-motion support, keyboard and ARIA support, and a non-drawing name-based path so the task does not exclude participants who cannot draw |

---

## Appendix — data output reference

When a session is saved, the browser produces a single archive containing one participant's
completed assessment:

```
pain-assessment_<stamp>_<id>/
  metadata.json                          full record (canonical); image blobs stored as file paths
  snapshots/{front,back,left,right}.png  all areas drawn on the body, four angles
  areas/area-<n>/{front,back,left,right}.png   each area alone on the body, four angles
  csv/
    session.csv    one row  — session metadata + general questionnaire
    areas.csv      one row per area — summary + area questionnaire
    coverage.csv   long format — one row per (area, region)
    README.md      the data dictionary (explains every column)
```

- `<stamp>` is a local date/time; `<id>` is the **random, non-identifying** session id.
- **Join keys:** `sessionId` links every file to the session; `areaNumber` links the per-area
  files together.
- Every column is documented in the bundled data dictionary; the canonical copy is
  `docs/DATA_DICTIONARY.md`.

---

## Closing note

This document is **supporting input for the PI's REB application** — an application-level summary
of what the tool does and the ethical and privacy measures built into it. Study-level content and
final decisions remain with the PI, and interpretation of ethics and privacy requirements should
be confirmed with the **Western University REB and Privacy Office**.
