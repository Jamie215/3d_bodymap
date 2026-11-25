# Response data dictionary

> This is the canonical copy for repo readers. The same text is bundled into
> every downloaded archive as `csv/README.md`, sourced from
> `js/data/dataDictionary.js` — keep the two in sync.

This archive is one participant's completed pain & symptom assessment. It is
produced entirely in the browser (no server) and is meant to be stored on the
provided **encrypted device**.

> **Privacy note:** free-text answers (see below) are typed by the participant
> and may inadvertently contain identifying information. Review / scrub free
> text before analysis or sharing.

## Files

```
pain-assessment_<stamp>_<id>/
  metadata.json                          full record (canonical); image blobs are file paths
  snapshots/{front,back,left,right}.png  ALL areas drawn on the body, four angles
  areas/area-<n>/{front,back,left,right}.png   area <n> alone on the body, four angles
  csv/
    session.csv    one row  — session + general questionnaire
    areas.csv      one row per area — summary + area questionnaire
    coverage.csv   long — one row per (area, region)
    README.md      the data dictionary (this file)
```

- `<stamp>` is local date/time, `<id>` is a random, **non-identifying** session id.
- `metadata.json` is the complete, lossless record; the CSVs are a convenience
  view of the same data for analysis. Numbers there match the CSVs.

## Join keys

- `sessionId` links every file to this session.
- `areaNumber` (1-based) links `areas.csv` ↔ `coverage.csv` ↔ `areas/area-<n>/`.

## Columns are always the same

Every session.csv and every areas.csv has **the same columns in the same
order**, whatever the participant answered or which study mode they used. So
files from different sessions can be stacked directly. A question that was not
shown is a **blank cell**, never a missing column. Blank (rather than a text
code like "N/A") keeps number columns such as `q.intensityScale` numeric; R,
pandas and Excel all read a blank cell as missing.

A blank questionnaire cell means the question was not shown, because either:

- it is a follow-up whose condition was not met (see the notes below), or
- the session was drawing-only (see next section).

## Drawing-only sessions

When `studyMode` is `drawing-only`, no questionnaire was shown. The drawings,
snapshots and coverage are complete, and **every** `general.*` cell in
session.csv and **every** `q.*` cell in areas.csv is blank. In metadata.json,
`generalQuestionnaire` and every area's `questionnaireResponses` are `null`.
This is intentional, not missing data.

## session.csv (one row)

| Column | Meaning |
|---|---|
| `sessionId` | Random, non-identifying session id |
| `schemaVersion` | Payload format version |
| `studyMode` | Form version the participant chose: `full` (drawings + questionnaires) or `drawing-only` (drawings, no questionnaires) |
| `startTime` / `completionTime` | ISO 8601 timestamps (session start / submit) |
| `durationSeconds` | Wall-clock session length |
| `modelType` | Body model used (e.g. "Type 1") |
| `totalAreas` | Number of pain/symptom areas logged |
| `general.stressful` | Stressful time at onset — `Yes` / `No` / `Prefer not to answer` |
| `general.medication` | Takes medication for spinal pain — `Yes` / `No` |
| `general.medicationTable.<row>` | Per medication type: `baseline` (routine), `breakthrough` (as needed), or `none`. Rows: over-the-counter, non-steroidal-anti-inflammatory, muscle-relaxant, narcotic-pain-medication, anti-depressant, neuroleptics, cannabis |
| `general.narcoticPainDuration` | How long narcotics taken (only if narcotic = baseline/breakthrough) |
| `general.medicationComment` | Free text (optional) |

## areas.csv (one row per area)

Coverage summary + the area questionnaire. **Conditional questions are blank
for areas where they weren't shown.** The follow-up questions (`q.makingWorse`
onward) are shown only when `q.mainArea = Yes`.

| Column | Meaning |
|---|---|
| `sessionId`, `areaNumber`, `areaId` | Identifiers |
| `drawnRegions` | Body regions with drawn pixels, `;`-separated |
| `overallPercentage` | Drawn area as % of **total body surface** |
| `coloredArea` | Drawn surface area, world units² (see coverage.csv) |
| `q.description` | "What does your pain or symptom feel like?" (free text) |
| `q.firstEpisode` | First episode? `Yes` / `No` |
| `q.severity` | `mild` / `moderate` / `severe` |
| `q.frequency` | `Always there` / `Comes and goes` |
| `q.duration` | How long they've had it (banded) |
| `q.intensityScale` | Average intensity past week, **0–10** (0 = none, 10 = worst imaginable) |
| `q.comment` | Free text (optional) |
| `q.mainArea` | Is this the main area? `Yes` / `No` — gates all fields below |
| `q.makingWorse` / `q.makingBetter` | Free text |
| `q.timeNotExperiencing` (+`...Detail`) | Any pain-free time of day, and when (checkbox list) |
| `q.timeExperienceWorse` (+`...Detail`) | Any worse time of day, and when (checkbox list) |
| `q.onsetCause` | Onset related to trauma / activity / arthritis / no clear cause, or `other` |
| `q.onsetCause-Comment` | The participant's own words when `q.onsetCause` = `other` |
| `q.interfereActivity` | Interference past 7 days — Not at all … Very much |
| `q.treatmentForImprovement` (+`...Detail`) | Any treatment helped, and which (single choice, or `other`) |
| `q.treatmentForImprovementDetail-Comment` | The participant's own words when `q.treatmentForImprovementDetail` = `other` |
| `q.medicationForImprovement` (+`...Detail`) | Any medication helped, and which (free text) |

Checkbox answers (`q.timeNotExperiencingDetail`, `q.timeExperienceWorseDetail`)
are `;`-separated. When a participant picks "Other", the answer column holds the
value `other` and their typed text is in the matching `-Comment` column.

## coverage.csv (long — one row per area × region)

The region-by-region breakdown of what was drawn. Only regions with drawn
pixels appear.

| Column | Meaning |
|---|---|
| `sessionId`, `areaNumber` | Join keys |
| `region` | Vertex-group / anatomical region name (e.g. `back_upper`, `thigh_front.L`; `.L`/`.R` = left/right) |
| `coloredArea` | Drawn surface area in this region (world units²) |
| `percentage` | Drawn area as % of **this region's** total area |
| `bodyContribution` | Drawn area as % of the **whole body's** surface area |

For an area, the sum of its regions' `coloredArea` equals that area's
`coloredArea` in areas.csv; the sum of `bodyContribution` equals its
`overallPercentage`.

## Images

- `snapshots/*.png` — every logged area shown together on the body, four angles.
- `areas/area-<n>/*.png` — area `<n>` shown alone on the body, four angles, for
  anatomical reference.
