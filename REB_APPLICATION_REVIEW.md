# Application-Level REB Review — Planning Notes

**Scope:** ethics/privacy considerations that arise from the application itself —
its consent flow, questionnaire content, what it captures, and the third-party
calls the participant's browser makes. **Data storage and data-residency are
covered separately** (see the Data Residency Decision Review) and are out of
scope here.

**Purpose:** a planning checklist for a future REB submission. None of the items
below are showstoppers; most are addressed with wording, a couple of survey
settings, or minor code changes.

**Basis:** code review of the prototype, 14 September 2026; updated 15 September
2026 after the data-handling decision and follow-up work below. File references
point to where each item lives.

**Data-handling decision (15 Sep 2026):** the interim tool runs stand-alone as a
web app with **no backend**, used while EmPOWER integration is pending. When a
session is finished the participant **downloads their responses as a single file**
(a `.zip` of `metadata.json` + model snapshots + per-region coverage CSVs) and
**stores it on a provided encrypted device**. The download is entirely
client-side — no network request — so nothing is transmitted to any server. What
the file contains and how to read it is documented in
[`docs/DATA_DICTIONARY.md`](./docs/DATA_DICTIONARY.md).

---

## What is already clean (no action needed)

- **No direct identifiers collected** — no name, email, date of birth, or
  health-card / medical-record number anywhere in the client.
- **No analytics or tracking scripts** — no Google Analytics, gtag, or similar.
- **No geolocation** or other sensitive device APIs.
- **Snapshots are of the 3D model, not the person** — no photographs of
  participants are taken.
- **Only `sessionStorage`** is used, and only for one-time UI flags (not data).
- **The session id is random and non-identifying** — generated per session
  (`crypto.randomUUID`), not derived from anything about the participant; used
  only to name the downloaded file and distinguish sessions.
- **Reduced motion is respected** (`prefers-reduced-motion`).

---

## Findings (priority order)

### Likely to be raised

#### 1. No consent or study-information step in the app
**Decision (15 Sep 2026): no in-app consent step — consent is obtained outside
the app.** The study coordinator **enrols the participant and has them sign the
consent form before they enter the application**, so informed, signed consent is
obtained through the study's own enrolment procedure ahead of any use of the tool.
No landing/consent screen is added; the consent procedure is documented in the REB
application instead.

_(Original finding, for reference: the app opens straight into the drawing task
with no in-app statement that this is research, what is collected, or that
participation is voluntary. Onboarding — `js/components/modals/onboardingModal.js`,
`js/data/helpContent.js` — is usage instructions only. Informed consent and
voluntariness are core TCPS 2 requirements; addressed via the enrolment procedure
above rather than in-app.)_

#### 2. Free-text boxes → inadvertent disclosure / re-identification
**Decision (15 Sep 2026): handle at the analysis stage, not with an in-app
warning.** An in-app "do not enter identifying information" note was considered
and **rejected** for two reasons: (a) it risks misinforming participants and
discouraging them from recording what they actually feel, and (b) directing the
participant at the open-text boxes can **bias their response** — a prompt at the
field steers what they write instead of letting them answer freely. Instead, free
text will be **reviewed / scrubbed for identifiers before analysis**; this
analysis-stage process is documented in the REB application.

- **Where (fields):**
  - `js/data/areaSurvey.js` — "What does your pain or symptom feel like?"
    (required), "What makes it worse?" / "What makes it better?" (required on the
    main area), "anything else…" (optional).
  - `js/data/generalSurvey.js` — medication comments (optional).
- **Why REB cares:** free text is the usual way a "de-identified" dataset picks
  up names or other identifiers. The data dictionary
  ([`docs/DATA_DICTIONARY.md`](./docs/DATA_DICTIONARY.md)) flags these fields and
  carries the same scrub-before-analysis note.

#### 3. Sensitive questions are mostly forced-response (voluntariness)
**Decision (14 Sep 2026): no change — intentional by design.** The forced-response
questionnaire structure is a deliberate design choice by the research team. The
"stressful time" question already offers "Prefer not to answer" where a decline
path was wanted; the remaining required items are retained as designed. If the
REB raises voluntariness, the response is that the required items are integral to
the assessment and the design was made with that intention.

_(Original finding, for reference: nearly every question is `isRequired: true`,
including sensitive ones in `js/data/generalSurvey.js` and `js/data/areaSurvey.js`.
TCPS 2 protects the right to skip individual questions; the suggested mitigation
was to add "Prefer not to answer" on sensitive items. Not actioned — see decision
above.)_

#### 8. No in-app session reset → participant data persists on a shared device
**Addressed in code (16 Sep 2026).** Application/technology finding.

- **Where:** after the participant confirms they saved the file,
  `updateSummaryStatus()` (`js/views/summaryView.js`) renders the final "All Done"
  screen (`renderComplete`), but **nothing clears the session**. The participant's
  `drawingInstances`, `generalQuestionnaireResponse`, and the still-re-downloadable
  `submissionPayload` (`js/app/appController.js`, `js/app/state.js`) remain **in
  memory** for the life of the tab. There is no in-app "next participant / start
  over" control; only closing or reloading the tab clears the data (that also
  re-shows onboarding, via `sessionStorage`).
- **Why REB / Privacy cares:** the tool runs on a **provided** (likely shared /
  kiosk) device. If a coordinator hands the device to the next participant without
  reloading, participant B can reach participant A's drawings, answers, and
  downloadable file. This is application behaviour, not content — in scope here.
- **Resolution (implemented):** both session-ending paths route through a single
  `endSession(reason)` (`js/app/drawingInstanceManager.js`) that flushes the
  in-memory data (`resetSessionData()` disposes the drawing textures and nulls the
  drawings, questionnaire answers, and re-downloadable payload), records a one-time
  notice, clears per-session UI flags, and **reloads to a clean front page**:
  1. **Finish** — clicking **Finish** on the save screen ends the session with an
     "**Assessment complete**" reason (`js/app/appController.js`).
  2. **Inactivity** — an idle watchdog (`js/utils/idleTimer.js`, default **10 min**
     idle → **60 s** warning) ends the session with a "**Session reset**" reason if
     the participant does not respond. Thresholds are constants at the top of that file.
- **Notice modals (what the participant sees):** the reset is never silent — it is
  wrapped in plain-language modals so the participant always knows the session ended
  and lands back at the front page:
  - **Inactivity warning** (`js/components/modals/idleWarningModal.js`) — before an
    idle reset, an "**Are you still there?**" modal counts down and offers
    "Continue session," so an active participant is never reset out from under them.
  - **Session-ended notice** (`js/components/modals/sessionResetModal.js`, shown on
    the reloaded page from `js/app/main.js`) — a message tailored to the reason:
    "**Assessment complete**" (thank-you) after Finish, or "**Session reset**"
    (reset after inactivity, to protect privacy) after a timeout, each with a
    "Start a new session" button. All three modals use the shared modal style.
- **Effect:** after either path the app is back at the front page with no participant
  data in memory, so the next person on a shared/provided device starts clean.
- **Not changed:** the app still has no server copy; the safeguard operates on the
  browser's in-memory data only, which is the whole risk surface here.

### Worth noting (lower priority)

#### 7. Accessibility / equitable access
**Decision (15 Sep 2026): no further work — the points that matter are already
handled.** The app respects reduced motion (`prefers-reduced-motion` across all
CSS), uses ARIA labels/roles and keyboard support on its controls, and offers a
**name-based, non-drawing path** to indicate body regions via the region-selector
modal (`js/components/modals/regionSelectorModal.js`) for participants who cannot
do fine pointer drawing. No additional accessibility work is planned for the
interim tool.

_(Original finding, for reference: the core task is a colour-based 3D drawing
needing pointer control and colour discrimination, which may exclude participants
with visual or motor impairments. Inclusion / equitable access is an increasing
REB consideration; addressed as above.)_

#### 9. App presents no research / non-clinical framing (therapeutic misconception)
**Open — for discussion (15 Sep 2026).** Application/technology finding.

The app opens straight into a clinical-looking drawing task; onboarding
(`js/components/modals/onboardingModal.js`) and help (`js/data/helpContent.js`) are
usage instructions only, and the tool returns no diagnosis, advice, or clinician
feedback. A participant could assume their drawn pain will be reviewed clinically or
that they are receiving care. This is distinct from Item 1: Item 1 covers whether
**consent exists** (handled at enrolment); this is about the **in-app presentation**.
Only the *surface gap* is flagged here — the **wording** of any research /
non-clinical notice belongs with the PI and the consent materials.

#### 10. No-backend architecture has no technical withdrawal / revocation path
**Open — for discussion; likely belongs to the Data-Residency review (15 Sep 2026).**

There is no backend, so the participant holds the only copy of their data (the
downloaded `.zip`); `beforeunload` only warns about not-yet-saved data
(`js/app/appController.js`). Once the file is generated and handed over, there is no
server-side mechanism to honour a later withdrawal / delete request — the study
process must define how such a request is met. Flagged here for completeness;
**overlaps the separate Data-Residency Decision Review** and should be owned there if
that review already covers withdrawal.

### Deliberately out of scope here — content design (PI to defend)

Two ethics considerations were reviewed and **intentionally left to the PI / study
design**, since they concern *what is asked* rather than the application or its
technology:

- A **distress / safety protocol and participant support resources**, given the
  psychologically loaded items (e.g. "was it a stressful time in your life?",
  mental-health medications, counselling as a treatment, severe / chronic pain).
- The **sensitivity and data-minimization justification** of collecting narcotic /
  opioid use **and duration**, cannabis use, and mental-health medications
  (`js/data/generalSurvey.js`).

These are recorded so it is clear they were considered; they are the PI's to defend
in the questionnaire design, not application/technology fixes.

---

## Resolved

Item numbers are kept stable (they match the commit history); resolved items are
recorded here rather than renumbered.

#### 4. YouTube tutorial embed → Google contact — **DONE (fully)**
`js/components/videoEmbed.js`, `js/data/helpContent.js`. The YouTube embed was
removed entirely. The remote YouTube thumbnail (`img.youtube.com`, fetched on
render) is now a self-contained CSS poster, and the player is a native
`<video>` serving the clips **same-origin** from `assets/video/` (`preload="none"`,
so nothing loads until the participant clicks play). There is **no contact with
YouTube / Google at any point** — the earlier `youtube-nocookie` residual (IP
exposed on play) is closed because the video no longer streams from Google.

#### 5. Full browser user-agent captured — **DONE**
`js/services/submissionService.js`. The raw `navigator.userAgent` field is no
longer included in the submission payload. The coarse derived fields
(`deviceType` / `operatingSystem` / `browser`, e.g. Desktop / Windows / Chrome)
are retained.

#### 6. Other third-party CDNs — **DONE**
`index.html`, `assets/css/base.css`, `vendor/`. Every library, stylesheet, and
font that the browser previously fetched from a third-party CDN (unpkg,
jsDelivr, cdnjs, d3js.org, Google Fonts) is now **self-hosted same-origin** under
`vendor/`. Assets were taken from the npm registry at pinned versions (three
0.175.0, knockout 3.5.1, survey-knockout 1.12.67, d3 7.9.0, driver.js 1.3.1,
Font Awesome 7.0.1) and Inter is self-hosted via `@fontsource/inter` (replacing
the Google Fonts `@import`). SurveyJS's stylesheet shipped Open Sans
`@font-face` rules pointing at `fonts.gstatic.com`; those were stripped (the
theme falls back to its Helvetica/Arial/sans-serif stack). See `vendor/README.md`
for the full inventory and update procedure.

**Net effect (Items 4 + 6):** the participant's browser now contacts only the
application's own origin. No third-party (Google or CDN) receives the
participant's IP for any asset. The remaining external consideration — the app's
own host seeing the IP — is inherent to hosting and is a data-residency matter,
out of scope here.

---

## Summary table

| # | Item | Priority | Type of fix | Effort | Status |
|---|---|---|---|---|---|
| 1 | No in-app consent / study info | High | Process | Small | Decided — consent via enrolment (no in-app step) |
| 2 | Free-text fields (identifiers) | High | Analysis process | Small | Decided — scrub before analysis (no in-app note) |
| 3 | Forced-response on sensitive items | Medium | Survey config | Small | No change — intentional |
| 4 | YouTube embed → Google contact | Medium | Code | Small | **Done** |
| 5 | Full user-agent captured | Low | Code | Very small | **Done** |
| 6 | Third-party CDNs | Low | Build / hosting | Moderate | **Done** |
| 7 | Accessibility / equitable access | Low | Design / documentation | Varies | Decided — already handled, no further work |
| 8 | No session reset → data remanence on shared device | Medium | Code | Small | **Done** — flush + reload to front page on finish / idle, with a notice modal |
| 9 | No in-app research / non-clinical framing | Low | Presentation | Small | **Open** — surface gap; wording is PI's |
| 10 | No technical withdrawal path (no backend) | Low | Process | — | **Open** — likely Data-Residency review |

---

## Suggested next steps

Items 1–7 are all **done** or **decided**. Of the newly identified
application/technology findings, **Item 8 is now done in code**; **Items 9–10**
remain **open for discussion**. The remaining actions:

1. **Document the consent procedure** — that the coordinator enrols the participant
   and obtains signed consent before the tool is used (Item 1).
2. **Document the free-text handling** — that open-text answers are reviewed /
   scrubbed for identifiers before analysis, and that no in-app prompt is placed at
   the boxes (to avoid biasing responses) (Item 2).
3. **Describe the data flow and storage** — session responses are downloaded as a
   single file and stored on a provided encrypted device; see
   [`docs/DATA_DICTIONARY.md`](./docs/DATA_DICTIONARY.md) for exactly what the file
   contains. (Data residency / device encryption are covered in the separate Data
   Residency Decision Review.)
4. **Decide on the remaining open findings (9–10)** — whether the app needs any
   research / non-clinical framing surface (Item 9, wording owned by the PI); and
   whether the no-backend withdrawal path (Item 10) is handled here or in the
   Data-Residency review. (Item 8 — shared-device data remanence — is now handled in
   code via flush-on-finish and an inactivity reset; the idle thresholds are tunable.)

*Planning notes — not a compliance determination. Confirm interpretation with
the Western REB and Privacy Office.*
