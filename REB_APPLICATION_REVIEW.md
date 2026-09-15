# Application-Level REB Review — Planning Notes

**Scope:** ethics/privacy considerations that arise from the application itself —
its consent flow, questionnaire content, what it captures, and the third-party
calls the participant's browser makes. **Data storage and data-residency are
covered separately** (see the Data Residency Decision Review) and are out of
scope here.

**Purpose:** a planning checklist for a future REB submission. None of the items
below are showstoppers; most are addressed with wording, a couple of survey
settings, or minor code changes.

**Basis:** code review of the prototype, 14 September 2026. File references point
to where each item lives so it can be actioned later.

---

## What is already clean (no action needed)

- **No direct identifiers collected** — no name, email, date of birth, or
  health-card / medical-record number anywhere in the client.
- **No analytics or tracking scripts** — no Google Analytics, gtag, or similar.
- **No geolocation** or other sensitive device APIs.
- **Snapshots are of the 3D model, not the person** — no photographs of
  participants are taken.
- **Only `sessionStorage`** is used, and only for one-time UI flags (not data).
- **Reduced motion is respected** (`prefers-reduced-motion`).

---

## Findings (priority order)

### Likely to be raised

#### 1. No consent or study-information step in the app
The app opens straight into the drawing task. There is no screen stating that
this is research, what is collected, that participation is voluntary, or how to
decline or stop.

- **Why REB cares:** informed consent and voluntariness are core TCPS 2
  requirements.
- **Where:** absent; onboarding (`js/components/modals/onboardingModal.js`,
  `js/data/helpContent.js`) is usage instructions only.
- **Mitigation:** confirm where consent is obtained. If it happens separately
  (paper / REDCap / EmPOWER), document that in the REB application. If the
  interim tool is used stand-alone, add a landing/consent step or a documented
  consent procedure.
- **Effort:** wording + process decision; small code change if an in-app screen
  is wanted.

#### 2. Free-text boxes → inadvertent disclosure / re-identification
Several open-text fields let participants type anything, including identifying
details.

- **Where:**
  - `js/data/areaSurvey.js` — "What does your pain feel like?" (required),
    "What makes it worse?" (required), "What makes it better?" (required),
    "anything else…" (optional).
  - `js/data/generalSurvey.js` — medication comments (optional).
- **Why REB cares:** free text is the usual way a "de-identified" dataset picks
  up names or other identifiers.
- **Mitigation:** add a short instruction not to enter identifying information;
  and/or plan to review/scrub free text before analysis.
- **Effort:** wording (survey text) + an analysis-stage process.

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

### Worth noting (lower priority)

#### 7. Accessibility / equitable access
The core task is a colour-based 3D drawing needing pointer control and colour
discrimination, which may exclude participants with visual or motor impairments.

- **Why REB cares:** inclusion / equitable access is an increasing REB
  consideration.
- **Mitigation:** note the access route in the application; consider an
  alternative for participants who cannot use the drawing interface.
- **Effort:** design consideration; document at minimum.

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
| 1 | No in-app consent / study info | High | Process / wording (± screen) | Small | Open |
| 2 | Free-text fields (identifiers) | High | Wording + analysis process | Small | Open |
| 3 | Forced-response on sensitive items | Medium | Survey config | Small | No change — intentional |
| 4 | YouTube embed → Google contact | Medium | Code | Small | **Done** |
| 5 | Full user-agent captured | Low | Code | Very small | **Done** |
| 6 | Third-party CDNs | Low | Build / hosting | Moderate | **Done** |
| 7 | Accessibility / equitable access | Low | Design / documentation | Varies | Open |

---

## Suggested next steps

1. Decide where **consent** is obtained and document it (Item 1).
2. Add a **do-not-enter-identifying-information** note near free-text fields and
   plan free-text review (Item 2).
3. Revisit **accessibility** (Item 7) if the review asks for an alternative to
   the drawing interface.

*Planning notes — not a compliance determination. Confirm interpretation with
the Western REB and Privacy Office.*
