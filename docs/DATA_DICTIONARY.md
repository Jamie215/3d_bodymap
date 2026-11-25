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

## Value formats

- **Lists** (`drawnRegions` and the checkbox answers) are joined with `; `
  (semicolon + space), e.g. `start-of-day; bedtime`.
- **Percentages** (`overallPercentage`, `percentage`, `bodyContribution`) are on
  a 0–100 scale: `0.18` means 0.18 %, not 18 %.
- **Text containing a comma, quote or line break** is wrapped in double quotes,
  as standard CSV. Some stored answers contain commas (see `q.onsetCause`).
- **Timestamps** are ISO 8601 in UTC (ending `Z`).

## Opening the CSVs

The CSVs are UTF-8 text **with a byte-order mark** (BOM — an invisible marker
at the very start of the file). The marker lets Excel show accented letters and
curly apostrophes (’, which iPad and iPhone keyboards type by default)
correctly; without it, Excel shows them as garbage such as `â€™`.

| Tool | How to open |
|---|---|
| Excel | Double-click the file. No extra steps. |
| Python, pandas | `pd.read_csv("areas.csv")` — the marker is handled, and blank cells become missing (`NaN`). |
| Python, `csv` module | `open("areas.csv", newline="", encoding="utf-8-sig")` — `utf-8-sig` removes the marker. With plain `utf-8`, the first column name starts with an invisible character. |
| R, readr / tidyverse | `readr::read_csv("areas.csv")` — the marker is handled, and blank cells become `NA`. |
| R, base | `read.csv("areas.csv", fileEncoding = "UTF-8-BOM", na.strings = "")` — `fileEncoding` removes the marker (otherwise the first column name comes out garbled, e.g. `X.U.FEFF.sessionId`); `na.strings = ""` makes blank text cells `NA` instead of `""`. |

`csv/README.md` (this file) and `metadata.json` have no marker.

## Columns are always the same

Every session.csv and every areas.csv has **the same columns in the same
order**, whatever the participant answered or which study mode they used. So
files from different sessions can be stacked directly. A question that was not
shown is a **blank cell**, never a missing column. Blank (rather than a text
code like "N/A") keeps number columns such as `q.intensityScale` numeric.
pandas and R's readr read every blank cell as missing automatically; base R's
`read.csv` needs `na.strings = ""` to do the same for text columns (see
"Opening the CSVs").

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
| `startTime` | When the app page loaded for this session — before the participant chose a study mode or saw onboarding |
| `completionTime` | When the participant pressed the final button (general questionnaire "Done", or "Finish and Save My Drawings"). Not when the file was saved. |
| `durationSeconds` | `completionTime` − `startTime`, so it includes the mode choice, onboarding and any time spent watching help videos |
| `modelType` | Body model used: `Type 1` or `Type 2` (the two body models offered on the body-type screen) |
| `totalAreas` | Number of pain/symptom areas logged |
| `general.stressful` | Stressful time at onset — `Yes` / `No` / `Prefer not to answer` |
| `general.medication` | Takes medication for spinal pain — `Yes` / `No` |
| `general.medicationTable.<row>` | Per medication type: `baseline` (routinely taking), `breakthrough` (taking as needed), or `none` (not taking). Rows: `over-the-counter`, `non-steroidal-anti-inflammatory`, `muscle-relaxant`, `narcotic-pain-medication`, `anti-depressant`, `neuroleptics`, `cannabis`. **Shown to, and required of, every full-form participant — even when `general.medication` = `No`**; those participants will usually answer `none` on every row. |
| `general.narcoticPainDuration` | How long narcotics taken — `Less than 6 weeks` / `6 weeks to less than 12 weeks` / `12 weeks to less than 1 year` / `Greater than 1 year`. Shown only if the narcotic row is `baseline` or `breakthrough`. |
| `general.medicationComment` | Free text (optional) |

## areas.csv (one row per area)

Coverage summary + the area questionnaire. **Conditional questions are blank
for areas where they weren't shown.** The follow-up questions (`q.makingWorse`
onward) are shown only when `q.mainArea = Yes`.

**At most 3 areas per participant can be main areas.** Once 3 areas are marked
`Yes`, the app sets `q.mainArea` to `No` automatically for any further area and
the participant cannot change it. So `No` does not always mean the participant
judged that area less important; with 4 or more areas, check how many are `Yes`.

| Column | Meaning |
|---|---|
| `sessionId`, `areaNumber`, `areaId` | Identifiers |
| `drawnRegions` | Body regions with drawn pixels, `; `-separated (region names explained under coverage.csv) |
| `overallPercentage` | Drawn area as % of **total body surface** |
| `coloredArea` | Drawn surface area, world units² (see coverage.csv) |
| `q.description` | "What does your pain or symptom feel like?" (free text) |
| `q.firstEpisode` | First episode? `Yes` / `No` |
| `q.severity` | `mild` / `moderate` / `severe` |
| `q.frequency` | `Always there` / `Comes and goes` |
| `q.duration` | How long they've had it — `Less than 7 days` / `7 days to less than 1 month` / `1 month to less than 3 months` / `3 months to less than 6 months` / `6 months to less than 1 year` / `1-5 years` / `More than 5 years` |
| `q.intensityScale` | Average intensity past week, **0–10** (0 = none, 10 = worst imaginable) |
| `q.comment` | Free text (optional) |
| `q.mainArea` | Is this a main area? `Yes` / `No` — gates all fields below. See the 3-area limit above. |
| `q.makingWorse` / `q.makingBetter` | Free text |
| `q.timeNotExperiencing` (+`...Detail`) | Any pain-free time of day (`Yes` / `No`), and when (checkbox list — codes below) |
| `q.timeExperienceWorse` (+`...Detail`) | Any worse time of day (`Yes` / `No`), and when (checkbox list — codes below) |
| `q.onsetCause` | What the onset was related to — one of the four full sentences below, or `other` |
| `q.onsetCause-Comment` | The participant's own words when `q.onsetCause` = `other` |
| `q.interfereActivity` | Interference with day-to-day activities, past 7 days — `Not at all` / `A little bit` / `Somewhat` / `Quite a bit` / `Very much` |
| `q.treatmentForImprovement` (+`...Detail`) | Any treatment helped (`Yes` / `No`), and which — `Surgery` / `Physiotherapy` / `Injection` / `Counselling` / `other` (single choice) |
| `q.treatmentForImprovementDetail-Comment` | The participant's own words when `q.treatmentForImprovementDetail` = `other` |
| `q.medicationForImprovement` (+`...Detail`) | Any medication helped, and which (free text) |

Checkbox answers (`q.timeNotExperiencingDetail`, `q.timeExperienceWorseDetail`)
are `; `-separated codes, in the order listed:

| Code | Shown to the participant as |
|---|---|
| `start-of-day` | Start of your day |
| `middle-of-day` | Middle of your day |
| `end-of-day` | End of your day |
| `bedtime` | Bedtime |
| `sleeping` | Sleeping |

`q.onsetCause` stores the full sentence the participant picked (they contain
commas, so they are quoted in the CSV):

- `Physical trauma (e.g., motor vehicle collision, fall, extreme exertion, workplace injury, etc.)`
- `A common physical activity (e.g., exercise, putting on socks, typical lifting activities, etc.)`
- `Arthritis`
- `No clear event or cause`

When a participant picks "Other", the answer column holds the value `other` and
their typed text is in the matching `-Comment` column.

## coverage.csv (long — one row per area × region)

The region-by-region breakdown of what was drawn. Only regions with drawn
pixels appear.

| Column | Meaning |
|---|---|
| `sessionId`, `areaNumber` | Join keys |
| `region` | Anatomical region name (see below) |
| `coloredArea` | Drawn surface area in this region (world units²) |
| `percentage` | Drawn area as % of **this region's** total area |
| `bodyContribution` | Drawn area as % of the **whole body's** surface area |

For an area, the sum of its regions' `coloredArea` equals that area's
`coloredArea` in areas.csv; the sum of `bodyContribution` equals its
`overallPercentage`.

**Region names.** There are 315 regions, named `<part>_<subdivision>` plus a
side suffix, e.g. `back_upper.L`, `thigh_anterior.R`:

- `.L` / `.R` — the participant's left / right side.
- `.M` — midline (5 regions: `neck_anterior.M`, `neck_posterior.M`,
  `back_upper.M`, `back_mid.M`, `back_lower.M`).
- No suffix — 4 single midline structures: `sacrum`, `apexSacrum`, `coccyx`,
  `pubicSymphysis`.

The full list (with numeric ids) is in `assets/region_id_mapping.json` in the
app's source code.

## metadata.json

The complete record, as JSON. Everything in the CSVs comes from here, plus a
few fields the CSVs leave out:

- Top level: the session.csv fields, `combinedDrawing` (paths to the four
  `snapshots/` images), `areas` (list), and `generalQuestionnaire` (answers
  object, or `null` in drawing-only sessions).
- Each area: `areaNumber`, `areaId`, `bodyViews` (paths to its four images),
  `questionnaireResponses` (answers object, or `null` in drawing-only
  sessions), `drawnRegions` (list), and `coverage`:
  - `overallPercentage`, `coloredArea` — as in areas.csv.
  - `regionBreakdown` — per region: `coloredArea`, `percentage`,
    `bodyContribution` (as in coverage.csv) **and `totalArea`**, the region's
    whole surface area in world units² (not in the CSVs).
  - `bodyPartBreakdown` — the same four numbers rolled up to larger body parts
    (e.g. `Upper Back`). **Not in the CSVs.**

Answers in metadata.json are not flattened: checkbox answers are JSON lists,
and the medication table is an object keyed by row.

## Images

- `snapshots/*.png` — every logged area shown together on the body, four angles.
- `areas/area-<n>/*.png` — area `<n>` shown alone on the body, four angles, for
  anatomical reference.
