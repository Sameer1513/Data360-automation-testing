# compare.page.js

## Purpose

Compares BoltDB Actual Excel vs Production UI Excel row by row, detecting both **value mismatches** and **highlight mismatches** (where cell limit highlights disagree between the two files). Also supports an independent limits check against StatusConfig. Generates a combined Excel report and an HTML dashboard.

---

## Location

```
pages/compare.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `ComparisonDashboard.js` | `Helper/` | HTML dashboard generator |
| `ExcelJS` | npm | Excel reading and writing |

---

## Constructor

No constructor — all methods are instance methods accessed via `new ComparePage()`.

---

## Entry Point

### `runAutoCompare(projectName, targetWeldIds, options)`

Main method. Locates the latest Actual and Production files, runs the requested comparison modes, saves the combined Excel report and HTML dashboard.

```js
const result = await compare.runAutoCompare('XML', ['152'], {
    runDataCompare: true,
    runLimitsCheck: false,
    statusConfigPath: null
});
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `projectName` | string | required | Used to find latest files by name pattern |
| `targetWeldIds` | string[] | `[]` | Filter to specific weld IDs. Empty = compare all |
| `options.runDataCompare` | bool | `true` | Run Actual vs Production value + highlight comparison |
| `options.runLimitsCheck` | bool | `false` | Run independent limits check on Production file |
| `options.statusConfigPath` | string | `null` | Absolute path to StatusConfig Excel (required for limitsCheck) |

**Returns:**

```js
{
  hasFailure: bool,            // true if any data compare mismatch
  limitsHasViolations: bool,   // true if any limits violations found
  reportPath: string,          // path to Final_Comparison_*.xlsx
  dashboardPath: string        // path to Final_Comparison_*.html
}
```

**File discovery logic:**

Files are found using the latest-modified file matching the pattern:
- Actual: `BoltD_*_{projectName}_*.xlsx` in `exports/ActualData/`
- Production: `Production_Report_*_{projectName}_*.xlsx` in `exports/ProductionData/`

---

## Comparison Types

---

### Data Compare (`runDataCompare: true`)

Compares Actual (BoltDB) vs Production (UI) row-by-row for each matching sheet.

**Sheets compared:**

| Production sheet | Matched to Actual sheet | Match keys |
|---|---|---|
| `Pass_View` | `Pass_View` | Weld ID, Station, Bug Type, Torch |
| `Zone_View` | `Zone_View` | Weld ID, Station, Bug Type, Torch, Zone |
| `Tilt_View` | `Tilt_View` | Weld ID, Station, Bug Type, Torch, Tilt Range |
| `Pass_tlogs_data` | `Pass_tlogs_data` | Weld ID, Zone, Event |
| `Zone_tlogs_data` | `Zone_tlogs_data` | Weld ID, Zone, Event |
| `Tilt_tlogs_data` | `Tilt_tlogs_data` | Weld ID, Zone, Event |

> `WeldSummary` (Production) maps to `Setup` (Actual) — currently commented out. Uncomment `keyLookup['WeldSummary']` to enable.

---

### Two Mismatch Types

| Type | Detected by | Result in Excel | Result in Dashboard |
|---|---|---|---|
| **Value mismatch** | Normalized cell values differ | Red text (`FFFF0000`) on Production cell | 🔴 Red cell |
| **Highlight mismatch** | Values same, but one file marks cell red and the other does not | Orange fill (`FFFFD966`) + dark brown text | 🟠 Orange cell |

**Highlight mismatch scenarios:**

| Actual (BoltDB) cell | Production (UI) cell | Result |
|---|---|---|
| 🔴 Red fill | 🔴 Red fill | ✅ PASS — both agree it is out of limits |
| Not red | Not red | ✅ PASS — both agree it is within limits |
| 🔴 Red fill | Not red | ❌ FAIL — **UI missed the violation** |
| Not red | 🔴 Red fill | ❌ FAIL — **UI flagged something BoltDB did not** |

---

### `_isRedCell(cell)`

Detects whether an Excel cell is marked as out-of-limits by its fill color.

```js
const isRed = compare._isRedCell(cell); // → true or false
```

**Logic:** Parses ARGB hex from `cell.fill.fgColor.argb`. Checks: **R > 200 AND G < 180 AND B < 180**.

This generic rule covers all Tailwind red variants without hardcoding:

| Color | ARGB | R | G | B | Detected |
|---|---|---|---|---|---|
| red-100 (BoltDB fill) | `FFFEE2E2` | 254 | 226 | 226 | ✅ |
| red-400 | `FFF87171` | 248 | 113 | 113 | ✅ |
| red-500 | `FFEF4444` | 239 | 68 | 68 | ✅ |
| red-600 (BoltDB font) | `FFDC2626` | 220 | 38 | 38 | ✅ |

---

### Ignored Columns

Value and highlight checks are both **skipped** for these column types (matched via `clean()` which strips spaces, special chars, and lowercases):

`Weld ID`, `Status`, `Sl.no`, `Welder ID`, `Event`, `Record`, `Pipe`, `Band`, `Logging`, `Year`, `Month`, `Day`, `Hour`, `Minute`, `Second`, `IWM`, `M500`

---

### Result Row Formatting in Excel

| Situation | Actual row | Production row |
|---|---|---|
| PASS | No fill | No fill |
| FAIL (value) | No fill | Pink row fill (`FFFFC7CE`) + red text on mismatched columns |
| FAIL (highlight only) | Orange fill on mismatched columns | Orange fill on mismatched columns |

Row pairs are separated by an empty spacer row.

---

## Limits Check (`runLimitsCheck: true`)

Reads the Production Excel independently and checks each param value against StatusConfig min/max limits. Useful for finding violations that were not flagged by the UI.

### Sheet Selection

The sheet to check is determined by the method + level from StatusConfig:

| Method | Level | Sheet checked |
|---|---|---|
| Instantaneous | any | `Pass_tlogs_data` |
| Average | Zone | `Zone_View` |
| Average | Tilt | `Tilt_View` |
| Average | Pass (or any other) | `Pass_View` |

### Violation Row Colors

| Color | Meaning |
|---|---|
| 🟡 Yellow (`FFFFFF00`) | Out of limits but **NOT** flagged red in Production |
| 🔴 Pink (`FFFFC7CE`) | Out of limits AND already flagged red in Production |

### Output Sheets Added

| Sheet | Content |
|---|---|
| `Limits_{sheetName}` | One row per violation: Weld ID, Pass, Parameter, Value, Min, Max, Reason, Already Flagged? |
| `LIMITS_SUMMARY` | Total rows checked, violation count, method reference |

---

## Utility Methods

### `clean(val)`

Strips spaces, special chars, and lowercases for fuzzy header matching.
```js
clean('Weld ID') → 'weldid'
clean('Travel Speed (in/min)') → 'travelspeedinmin'
```

### `normalizeValue(val)`

Normalizes values for comparison — converts numeric strings to canonical number form.
```js
normalizeValue('21.40') → '21.4'
normalizeValue('21.4')  → '21.4'
normalizeValue('false') → 'false'
```

This prevents false failures for values like `21.40` vs `21.4`.

### `findColIdx(headerMap, targetName)`

Finds column index by header name using the `clean()` function. First tries exact match, then partial.

### `findColByKeyword(headerRow, keyword)`

Finds column index by searching header cell text for a keyword. Used in limits check.

### `getPassType(passName)`

Maps a pass name to a StatusConfig group. Used in limits check.

| Pass name contains | Group |
|---|---|
| `hot` or `root` | `Hot Pass` |
| `fill` | `Fill` |
| `cap` | `Cap` |

---

## Output Files

| File | Location | Description |
|---|---|---|
| `Final_Comparison_{project}_{ts}.xlsx` | `exports/ComparedData/` | Combined Excel with all comparison sheets |
| `Final_Comparison_{project}_{ts}.html` | `exports/ComparedData/` | Visual HTML dashboard |

---

## Usage in Spec

```js
// In production-flow.spec.js — Comparison step
const { hasFailure, reportPath, dashboardPath } =
    await compare.runAutoCompare(project.projectName, targetWeldId);

if (hasFailure) {
    expect(false, "⚠️ Comparison found mismatches").toBe(true);
}
```

The spec attaches both files to the Playwright report as downloadable attachments.

---

## Related Files

| File | Relationship |
|---|---|
| `Helper/ComparisonDashboard.js` | Generates HTML from the comparison Excel |
| `exports/ActualData/BoltD_*.xlsx` | Source: BoltDB Actual data |
| `exports/ProductionData/Production_Report_*.xlsx` | Source: UI Production data |
| `exports/ComparedData/` | Output directory |
| `config/Combinations.json` | `weldIds` filter, `statusConfigPath` |
| `tests/production-flow.spec.js` | Comparison step calls `runAutoCompare()` |