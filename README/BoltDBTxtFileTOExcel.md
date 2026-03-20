# BoltDBTxtFileTOExcel.page.js

## Purpose

Parses the raw BoltDB `.txt` export file, processes S/T/C session records, applies slope filtering, maps zone codes to pass names using the WeldParameters file, checks values against limits from the StatusConfig file, and writes a fully formatted Excel workbook with Setup, tlog, view, and Unknown sheets.

---

## Location

```
pages/BoltDBTxtFileTOExcel.page.js
```

---

## Dependencies

| Dependency | Description |
|---|---|
| `ExcelJS` | Excel workbook creation and formatting |
| `fs` / `path` | File system access |

---

## Constructor

```js
constructor()
```

| Property | Description |
|---|---|
| `this.outputDir` | `exports/ActualData/` — output directory |
| `this.unitSystem` | `'imperial'` by default; overridden from `unitConfig` |
| `this.roundingConfig` | `{}` by default; populated from `unitConfig` at runtime |
| `this.LIMIT_PARAMS` | Array of `{ dataKey, configName }` — parameters checked against limits |

---

## Status Symbols

| Symbol | Meaning |
|---|---|
| `true` | S+T+C all present, all values within configured limits |
| `false` | S+T+C all present, at least one value outside limits |
| `(-)` | S or T record missing — session has no usable data |
| `(X)` | C record missing AND values within limits — weld not formally closed |
| `(!)` | Zone exists in T record but cannot be found in WeldParams file |

---

## Missing Record Rules

These apply to **all** calculation methods equally:

| Condition | Status |
|---|---|
| S missing OR T missing | `(-)` |
| S+T present, C missing, all values pass limits | `(X)` |
| S+T present, C missing, any value fails limits | `false` |
| Zone code not found in WeldParams | `(!)` |
| S+T+C all present, all values pass | `true` |
| S+T+C all present, any value fails | `false` |

---

## Calculation Methods

The method and level are read from the StatusConfig file. Status is computed for each group in the view sheets.

### Instantaneous

Checks every individual T record. One failure fails the entire group.

| View | Logic |
|---|---|
| Pass_View | Any single T record outside limits → `false` |
| Zone_View | Any single T record outside limits → `false` |
| Tilt_View | Any single T record outside limits → `false` |

### Average by Pass

Averages all T records in the group. Individual tlog values do not affect status — only the computed average is compared.

| View | Logic |
|---|---|
| Pass_View | Avg of all T records in pass → check limits |
| Zone_View | Avg of all T records in zone → check limits |
| Tilt_View | Avg of all T records in tilt range → check limits |

### Average by Zone

| View | Logic |
|---|---|
| Pass_View | Avg per zone computed independently; if **any zone** avg fails → pass fails |
| Zone_View | Avg of T records in that zone → check limits |
| Tilt_View | Avg of T records in that tilt range → check limits |

### Average by Tilt

| View | Logic |
|---|---|
| Pass_View | Avg of ALL T records in the pass → check limits *(same as Average by Pass — tilt ranges do not affect pass status)* |
| Zone_View | Avg of T records in that zone → check limits |
| Tilt_View | Avg of T records in that tilt range → check limits |

> **Key rule:** For all Average methods, individual tlog values are irrelevant. Only the average is checked against limits.

---

## Output File

**Path:** `exports/ActualData/BoltD_{projectName}_{timestamp}.xlsx`

**Sheets produced:**

| Sheet | Content | When produced |
|---|---|---|
| `Setup` | One row per S record. Orange row if C missing | Always |
| `Pass_tlogs_data` | All T records for normal sessions | Always |
| `Zone_tlogs_data` | Same T records, Zone-grouped headers | Always |
| `Tilt_tlogs_data` | Same T records, Tilt-grouped headers | Always |
| `Unknown` | T records that arrived with no S record | When orphan T records exist |
| `Pass_View` | Aggregated — one row per Weld+Torch | Always |
| `Zone_View` | Aggregated — one row per Weld+Torch+Zone | Always |
| `Tilt_View` | Aggregated — one row per Weld+Torch+TiltRange | Always |

---

## Methods

---

### `run(slopeIn, slopeOut, projectName, sourceFile, BoltDBExcel, statusConfigPath, weldParamsPath, unitConfig)`

Main entry point.

```js
const { setupData, outputPath } = await extractor.run(
    0, 0,
    'XML', 'bolt.txt',
    true,
    statusConfigPath,
    weldParamsPath,
    project.unitConfig
);
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `slopeIn` | number | `0` | Milliseconds to trim from start of each session |
| `slopeOut` | number | `0` | Milliseconds to trim from end of each session |
| `projectName` | string | `'Default'` | Used in output filename |
| `sourceFile` | string | `'default'` | Filename in `Input/` directory |
| `BoltDBExcel` | bool | `false` | Whether to save the Excel file |
| `statusConfigPath` | string | `null` | Absolute path to StatusConfig Excel |
| `weldParamsPath` | string | `null` | Absolute path to WeldParameters Excel |
| `unitConfig` | object | `null` | Unit system + rounding config from `Combinations.json` |

**Returns:** `{ setupData, outputPath }`

| Return field | Description |
|---|---|
| `setupData` | `{ pipeSize, wallThickness, wps }` from the last valid S record |
| `outputPath` | Absolute path to saved Excel, or `null` if `BoltDBExcel = false` |

---

### `parseAutomationFile()`

Reads the `.txt` source file and parses it into an array of weld sessions.

**Session structure:**
```js
{
  setupData: { WeldID, ...S record fields },
  tRecords: [...T record objects],
  hasS: bool,
  hasC: bool,
  hasT: bool,
  sTime: float,   // Unix microsecond timestamp from S record
  cTime: float    // Unix microsecond timestamp from C record
}
```

**Orphan T record handling:**

After a C record closes a session (`sessionClosed = true`), any T records that arrive before the next S record are **Unknown** records. They go to an Unknown session (reusing the last Unknown session if it exists, or creating a new one).

```
S → open session, sessionClosed = false
T → attach to current session
C → close session, sessionClosed = true
T → goes to Unknown session (orphan)
S → new session, sessionClosed = false
```

---

### `loadZoneMap(weldParamsPath)`

Reads the WeldParameters Excel file and builds a zone→passName map for Lead and Trail torches.

```js
const { lead, trail } = await extractor.loadZoneMap(weldParamsPath);
// lead['1T'] → 'Fill 1'
// trail['2S'] → 'Fill 2'
```

**Source file structure:**
- Sheet `Lead Torch`: Row 3 = PassName, Row 4 = PassPendName (zone code)
- Sheet `Trail Torch`: same structure

**Rules:**
- Zone codes are uppercased for consistent lookup
- First occurrence of each zone wins (duplicates map to same PassName)
- Zone codes not in the file → passName is `null` → status becomes `(!)`

---

### `loadStatusConfig(statusConfigPath)`

Reads the StatusConfig Excel and extracts method, level, pass groups, and limit values.

```js
const config = await extractor.loadStatusConfig(statusConfigPath);
// config.method → 'Average by Pass'
// config.level  → 'Pass'
// config.passGroups → ['Hot Pass', 'Fill', 'Cap']
// config.params['Current (A)']['Fill'] → { min: 180, max: 260 }
```

**Source file structure:**
- Sheet `Status_Config_UI`
- Row with `Status Calculation Method` in col A → method value in col B
- Row with `Status Calculation Level` in col A → level value in col B
- Row with `Parameter` in col A → header row for limits table
  - Column headers: `Hot Pass Min`, `Hot Pass Max`, `Fill Min`, `Fill Max`, `Cap Min`, `Cap Max`
- Following rows: one per parameter with limit values

---

### `checkLimits(record, passName, statusConfig)`

Checks a single data record against configured limits for the given pass name.

```js
const { pass, outOfLimitKeys } = extractor.checkLimits(record, 'Fill 1', config);
```

**Returns:**

| Field | Type | Description |
|---|---|---|
| `pass` | bool | `true` if all configured params are within limits |
| `outOfLimitKeys` | `Set<string>` | Data keys that are out of limits (e.g. `{'Current', 'Voltage'}`) |

**Limit check logic per parameter:**
- `min === 0 && max === 0` → not configured → skip
- `val < min` → out of limits
- `val > max` → out of limits

---

### `toStatusGroup(passName, passGroups)`

Maps a pass name to the appropriate StatusConfig column group.

```js
extractor.toStatusGroup('Fill 1', ['Hot Pass', 'Fill', 'Cap'])
// → 'Fill'
```

**Matching order:**
1. Exact match (case-insensitive): `'Fill' === 'Fill'`
2. Group name contained in pass name: `'Fill 1'.includes('Fill')`

Returns `null` if no match → no limits applied for this pass.

---

### `applyStatusStyle(excelRow, status, outOfLimitColNums)`

Applies red background + bold red text to out-of-limit cells in an Excel row.

```js
extractor.applyStatusStyle(row, 'false', [10, 11, 12]);
```

| Color | ARGB | Used for |
|---|---|---|
| Red-100 background | `FFFEE2E2` | Out-of-limit cell fill |
| Red-600 text | `FFDC2626` | Out-of-limit cell font |

> No full row fill is applied — only the specific out-of-limit cells are highlighted.

---

### `applyRounding(key, value)`

Rounds a value using the configured decimal places from `unitConfig`.

```js
extractor.applyRounding('Travel Speed', 18.567) // → 18.6 (imperial: 1 decimal)
extractor.applyRounding('Current', 220.0)       // → 220   (integer)
```

Falls back to 2 decimal places if the key is not in `roundingConfig`.

---

### `formatToIST(rawValue)`

Converts a Unix microsecond timestamp to a formatted IST datetime string.

```js
extractor.formatToIST(1664208407000000)
// → '27-Sep-2022, 8:56:47 AM'
```

Uses `en-US` locale to get 3-letter month abbreviations (`Sep`, not `Sept`), matching the production UI format.

---

### `_resolveViewStatus(g, avgs, statusConfig, ..., viewType)`

Resolves the final status string for one view row based on the calculation method.

**Decision order:**
1. All items have same non-null `sessionStatusFlag` → return that flag (e.g. `(-)`)
2. `g.passName` is null → return `(!)`
3. C missing → `cMissing = true`; use `passOrX()` helper downstream
4. No statusConfig → return `(X)` or `true`
5. Apply method-specific logic (Instantaneous / Average by Pass / Average by Zone / Average by Tilt)

---

### `_buildGroupedStatuses(data, groupFn, statusMap, statusConfig)`

Pre-computes avg-based status for each group. Currently used only for **Average by Zone → Pass_View** to avoid re-computing zone averages twice.

```js
// Builds: zoneStatusMap['152_Lead_1T'] = 'false'
extractor._buildGroupedStatuses(data, d => `${d.WeldID}_${d.Torch}_${d.Zone}`, zoneStatusMap, config);
```

---

### `addViewSheet(workbook, name, data, groupFn, statusFn, statusConfig)`

Adds a view sheet (Pass/Zone/Tilt) to the workbook. Groups T records by the groupFn key, computes Min/Avg/Max stats per parameter, resolves status, and writes one row per group.

**Column structure for all view sheets:**

```
Weld ID | Sl.no | Status | Station | Welder ID | Bug Type | Torch |
Weld Start Time | Weld Time | [Zone | Tilt Range] | Pass Name | Distance |
Current (A) Min | Current (A) Avg | Current (A) Max |
Voltage (V) Min | Voltage (V) Avg | Voltage (V) Max |
Travel Speed (in/min) Min | ... |
True Energy (kJ/in) Min | ... |
Heat (kJ/in) Min | ... |
Wire Speed (in/min) Min | ... |
Oscillation Width (in) Min | ... |
Frequency Min | ... |
Target Min | ... |
Horizontal Bias Min | ... |
Total Wire Consumed Min | ...
```

**Out-of-limit highlighting:**
When status is `false`, the Min/Avg/Max columns for each failing parameter are all highlighted with red fill.

---

## Slope Filtering

Applied to T records before mapping:

```js
// Records within slopeIn ms of session start → removed
// Records within slopeOut ms of session end → removed
const dStart = Math.round((curT - startT) * 1000);
const dEnd   = Math.round((endT - curT) * 1000);
return dStart >= slopeIn && dEnd >= slopeOut;
```

---

## Weld Time Calculation

| Sheet | Formula |
|---|---|
| `Pass_View` | `(cTime - sTime) × 1000` seconds (full weld duration from S to C) |
| `Zone_View`, `Tilt_View` | Last T record time − first T record time in the group |
| Any sheet, C missing | Shows `(-)` — no end time available |

---

## Related Files

| File | Relationship |
|---|---|
| `Input/bolt.txt` | Source BoltDB export file |
| `exports/StatusConfig UI/XML_StatusConfig_UI.xlsx` | StatusConfig source |
| `exports/StatusConfig UI/WeldParametersCsvToExcel.xlsx` | WeldParams source |
| `exports/ActualData/` | Output directory |
| `pages/compare.page.js` | Reads the BoltDB Excel for comparison |
| `config/Combinations.json` | `unitConfig`, `statusConfigPath`, `weldParamsPath` |
| `tests/production-flow.spec.js` | BoltDB Extraction step calls `run()` |