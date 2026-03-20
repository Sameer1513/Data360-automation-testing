# 🔥 Weld Automation — Playwright E2E Test Suite

A complete end-to-end automation framework for weld production data validation. It scrapes live UI data, extracts BoltDB records, compares them side-by-side, and generates visual HTML dashboards and Excel reports.

---

## 📁 Project Structure

```
playwright-e2e/
├── tests/
│   └── production-flow.spec.js        # Main test orchestrator
├── pages/
│   ├── loginAndProject.page.js        # Login UI interaction
│   ├── createproject.page.js          # Project creation UI
│   ├── setup.page.js                  # Project setup/pipe config
│   ├── Specification.page.js          # Spec upload/manual add
│   ├── DeviceAssigning.page.js        # Device search & assign
│   ├── statusConfig.page.js           # Status config slopes UI
│   ├── StatusConfigPass.page.js       # Status config data extractor
│   ├── ProductionTabWeldData.page.js  # UI scraper → Production Excel
│   ├── BoltDBTxtFileTOExcel.page.js   # BoltDB parser → Actual Excel
│   └── compare.page.js                # Excel comparison engine
├── Assertions/
│   ├── LoginAssertion.js              # Login scenario logic
│   └── ProductionTabAssertion.js      # Production tab checks
├── Helper/
│   ├── AssertionHelper.js             # Central log + dashboard
│   ├── ComparisonDashboard.js         # HTML report generator
│   └── CommonHelper.js                # Shared utilities
├── Locators/                          # All UI locators (per page)
├── Global/
│   └── LoginPageCredential.page.js    # URL + credentials
├── terminal_execution_files/
│   └── device_register.js             # Device registration runner
├── config/
│   └── Combinations.json              # Flow control + project config
├── Input/
│   └── bolt.txt                       # Raw BoltDB export file
└── exports/
    ├── ActualData/                    # BoltDB Excel output
    ├── ProductionData/                # UI-scraped Excel output
    ├── ComparedData/                  # Comparison Excel + HTML
    └── StatusConfig UI/               # StatusConfig + WeldParams Excel
```

---

## ⚙️ Configuration — `Combinations.json`

Central control file for the entire test flow.

### Flow Control

| Key | Type | Description |
|---|---|---|
| `cleanExports` | bool | Delete old exports before run |
| `checkSourceFile` | bool | Assert source `.txt` file exists |
| `runExtraction` | bool | Run BoltDB extractor to derive setup data |
| `BoltDBExcel` | bool | Generate BoltDB Actual Excel |
| `login` | bool | Run login step |
| `createProject` | bool | Run project creation step |
| `deviceRegistration` | bool | Run device registration |
| `setup` | bool | Run project setup |
| `specification` | bool | Run specification upload |
| `statusConfigPass` | bool | Extract StatusConfig UI data |
| `deviceSync` | bool | Run device sync |
| `productionAnalysis` | bool | Scrape production UI data |
| `comparison` | bool | Run Actual vs Production comparison |

### Project Config (`singleProject`)

| Key | Description |
|---|---|
| `projectName` | Project name in the UI |
| `sourceFile` | BoltDB `.txt` file name in `Input/` |
| `statusConfigPath` | Relative path to StatusConfig Excel |
| `weldParamsPath` | Relative path to WeldParameters Excel |
| `weldIds` | Weld IDs to filter (empty = all) |
| `slopeCombinations` | Array of `{ slopeIn, slopeOut }` to run |
| `unitConfig` | Unit system + rounding config (see below) |

### Unit Config

```json
"unitConfig": {
  "unitSystem": "imperial",
  "roundingConfig": {
    "imperial": {
      "Voltage": 1, "Current": 0, "Wire Speed": 0,
      "Travel Speed": 1, "Oscillation Width": 3,
      "True Energy": 1, "Heat": 1, "Tilt": 0
    },
    "metric": {
      "Voltage": 1, "Current": 0, "Wire Speed": 0,
      "Travel Speed": 0, "Oscillation Width": 1,
      "True Energy": 2, "Heat": 2, "Tilt": 0
    }
  }
}
```

To switch to metric, change `"unitSystem": "metric"` — the correct decimal places are already configured.

---

## 🔄 End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    production-flow.spec.js                       │
│                                                                   │
│  beforeAll: Clean exports → Check source file → Run extraction   │
│  beforeEach: Open browser (only if browser steps enabled)        │
│                                                                   │
│  Step 1  → Login                                                  │
│  Step 2  → Create Project                                         │
│  Step 3&4→ Device Registration & Assignment                       │
│  Step 5  → Project Setup (pipe config)                            │
│  Step 6  → Specifications upload                                  │
│  Step 7  → Device Sync                                            │
│  Step 8&9→ Production Tab verification                            │
│                                                                   │
│  For each slopeCombination:                                       │
│    ├─ BoltDB Extraction  → ActualData/BoltD_*.xlsx               │
│    ├─ Status Config      → Apply slopes in UI                     │
│    ├─ UI Analysis        → ProductionData/Production_Report_*.xlsx│
│    └─ Comparison         → ComparedData/Final_Comparison_*.xlsx  │
│                             + Final_Comparison_*.html             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📄 Page-by-Page Reference

---

### `loginAndProject.page.js`

**Purpose:** Browser interaction only for login. No assertions — those live in `LoginAssertion.js`.

| Method | Description |
|---|---|
| `attemptLogin(email, password)` | Navigate to URL, fill credentials, click login, return status |
| `getWrongEmail()` | Mutates correct email for negative test |
| `getWrongPassword()` | Mutates correct password for negative test |
| `getReadableStatus(status)` | Maps internal status codes to human-readable strings |

**Return values from `attemptLogin`:**

| Status | Meaning |
|---|---|
| `SUCCESS` | Projects page detected after login |
| `ERROR` | Error/invalid credentials message detected |
| `EMPTY_FIELD` | Browser validation triggered (empty field) |
| `NO_CHANGE` | No UI response after timeout |

---

### `createproject.page.js`

**Purpose:** Creates a new project in the UI using config from `Combinations.json`.

| Method | Description |
|---|---|
| `openCreateProject()` | Click Create Project button, wait for form |
| `selectDropdown(type, value)` | Select from React-Select dropdown (location/customer) |
| `selectDate(type, dateString)` | Navigate calendar and pick start/end date |
| `createProject(projectData)` | Full project creation flow |
| `selectProject(projectName)` | Search and open an existing project |
| `assignDevice(projectName, laptopId)` | Enter project and assign a device |

---

### `setup.page.js`

**Purpose:** Configures pipe details (size, wall thickness, manufacturer, WPS) for a project.

| Method | Description |
|---|---|
| `performSetup(projectName)` | Full setup flow — opens project, fills all pipe rows, saves |
| `fillPipeRow(container, pipe, index)` | Fills one pipe row (size, thickness, manufacturer, WPS) |
| `getProjectConfig(projectName)` | Reads project config from `Combinations.json` |

**Pipe config fields (per pipe):**

| Field | Description |
|---|---|
| `pipeSize` | Pipe outer diameter |
| `wallThickness` | Wall thickness value |
| `pipeCount` | Number of pipes |
| `pipeLength` | Length per pipe |
| `manufacturer` | Array of manufacturer names |
| `wps` | Array of WPS numbers |

---

### `Specification.page.js`

**Purpose:** Handles specification document upload and manual spec entry.

| Method | Description |
|---|---|
| `navigateToSpecifications(projectName)` | Click Specifications tab |
| `uploadSpecifications(data, actionType)` | Upload Excel template + documents (cancel/submit) |
| `addNewSpecificationManual(specData, actionType)` | Manually add a new spec via modal |
| `getFilePath(fileName)` | Resolve absolute path for input files |

---

### `DeviceAssigning.page.js`

**Purpose:** Searches for a registered device and assigns it to a project.

| Method | Description |
|---|---|
| `navigateToDevices()` | Navigate to Devices page via sidebar |
| `assignProjectToDevice(deviceId, projectName)` | Full assign flow with retry logic |

**Retry logic:** Searches for device up to 3 times, clicks Refresh between attempts if search fails.

---

### `statusConfig.page.js`

**Purpose:** Applies slope configuration in the UI and navigates back to the production table.

| Method | Description |
|---|---|
| `applyStatusConfiguration(slopeIn, slopeOut)` | Apply slope values if non-zero, then wait for production table |

**Behaviour:**
- If `slopeIn = 0` and `slopeOut = 0` → skips config UI, goes directly to Production tab
- If slopes are non-zero → opens Status Config, fills In/Out, saves, navigates back

---

### `StatusConfigPass.page.js`

**Purpose:** Extracts the Status Config UI data table to Excel for reference.

| Method | Description |
|---|---|
| `run(projectName, slopeIn, slopeOut)` | Scrape status config table → save to `exports/StatusConfig UI/` |
| `goBackToProduction()` | Navigate back to production view |

---

### `ProductionTabWeldData.page.js`

**Purpose:** Scrapes live production UI data (view rows + tlog rows) into a structured Excel workbook.

| Method | Description |
|---|---|
| `runFlow(weldIds, prodLimit, projectName)` | Main entry — iterates welds, saves Excel progressively |
| `searchAndFilterWeld(weldId)` | Search for a weld ID and open its detail view |
| `processTabByName(...)` | Click a tab (Pass/Zone/Tilt) and scrape it |
| `processTabView(...)` | Scrape view table rows + open tlog detail per row |
| `extractTableData(tableLocator, startIndex)` | Bulk-extract all rows in one browser evaluate call |
| `scanDataAnalysis(...)` | Open tlog detail view and extract all rows |
| `addRowWithColor(sheet, rowData)` | Write row to Excel, preserving cell background colors |
| `parseCellValue(cell)` | Extract value + background color from a single cell |
| `generateWeldSummarySheet(workbook, weldId)` | Write weld summary row to WeldSummary sheet |

**Output file:** `exports/ProductionData/Production_Report_{projectName}_{timestamp}.xlsx`

**Sheets produced:**

| Sheet | Content |
|---|---|
| `WeldSummary` | One row per weld from the main production table |
| `Pass_View` | Pass-level view rows with background colors |
| `Zone_View` | Zone-level view rows |
| `Tilt_View` | Tilt-range view rows |
| `Pass_tlogs_data` | Individual tlog readings for Pass view |
| `Zone_tlogs_data` | Individual tlog readings for Zone view |
| `Tilt_tlogs_data` | Individual tlog readings for Tilt view |

**Cell color capture:** Uses `getComputedStyle` to capture background colors from the live DOM and stores them as ARGB hex in Excel cells. This is how out-of-limit (red) cells are preserved in the output.

---

### `BoltDBTxtFileTOExcel.page.js`

**Purpose:** Parses the raw BoltDB `.txt` export, applies slope filtering, maps zones to pass names, checks limits, and writes a structured Excel workbook.

#### Status Symbols

| Symbol | Meaning |
|---|---|
| `true` | S+T+C present, all values within limits |
| `false` | S+T+C present, at least one value outside limits |
| `(-)` | S or T record missing |
| `(X)` | C record missing, values within limits |
| `(!)` | Zone found in T record but not in WeldParams file |

#### S/T/C Record Rules

| Condition | Status |
|---|---|
| S missing OR T missing | `(-)` |
| S+T present, C missing, values pass limits | `(X)` |
| S+T present, C missing, any value fails limits | `false` |
| Zone not found in WeldParams | `(!)` |
| S+T+C present, all values pass | `true` |
| S+T+C present, any value fails | `false` |

#### Calculation Methods

| Method | Pass_View | Zone_View | Tilt_View |
|---|---|---|---|
| **Instantaneous** | Any single T record outside limits → `false` | Same | Same |
| **Average by Pass** | Avg of all T records in pass → check limits | Avg of T records in zone → check limits | Avg of T records in tilt range → check limits |
| **Average by Zone** | Avg per zone; if any zone fails → pass fails | Avg of T records in zone → check limits | Avg of T records in tilt range → check limits |
| **Average by Tilt** | Avg of ALL T records in pass → check limits *(same as Avg by Pass)* | Avg of T records in zone → check limits | Avg of T records in tilt range → check limits |

> **Note:** For all Average methods, individual tlog values do **not** affect status. Only the computed average is compared against limits.

#### Key Methods

| Method | Description |
|---|---|
| `run(slopeIn, slopeOut, projectName, sourceFile, BoltDBExcel, statusConfigPath, weldParamsPath, unitConfig)` | Main entry point |
| `parseAutomationFile()` | Parse S/T/C records, handle orphan T records → Unknown session |
| `loadZoneMap(weldParamsPath)` | Build zone→passName map from WeldParameters Excel |
| `loadStatusConfig(statusConfigPath)` | Load method, level, limits from StatusConfig Excel |
| `checkLimits(record, passName, statusConfig)` | Check one record against configured limits |
| `applyStatusStyle(excelRow, status, outOfLimitColNums)` | Apply red fill to out-of-limit cells |
| `addViewSheet(workbook, name, data, groupFn, statusFn, statusConfig)` | Write a view sheet with Min/Avg/Max per param |
| `_resolveViewStatus(...)` | Compute final status for one view row based on method |
| `_buildGroupedStatuses(...)` | Pre-compute zone avg statuses for Average by Zone method |
| `_computeStats(items)` | Return `{ min, avg, max }` per param for a group |

**Output file:** `exports/ActualData/BoltD_{projectName}_{timestamp}.xlsx`

**Sheets produced:**

| Sheet | Content |
|---|---|
| `Setup` | One row per S record. Orange highlight if C missing |
| `Pass_tlogs_data` | All T records for normal sessions, Pass-grouped |
| `Zone_tlogs_data` | All T records for normal sessions, Zone-grouped |
| `Tilt_tlogs_data` | All T records for normal sessions, Tilt-grouped |
| `Unknown` | T records with no corresponding S record |
| `Pass_View` | Aggregated view — one row per Weld+Torch |
| `Zone_View` | Aggregated view — one row per Weld+Torch+Zone |
| `Tilt_View` | Aggregated view — one row per Weld+Torch+TiltRange |

---

### `compare.page.js`

**Purpose:** Compares BoltDB Actual Excel vs Production UI Excel, detects both value mismatches and highlight (limit) mismatches, and saves a combined comparison report.

#### Entry Point

```
runAutoCompare(projectName, targetWeldIds, options)
  options = {
    runDataCompare: bool,    // Compare Actual vs Production values + highlights
    runLimitsCheck: bool,    // Check Production values against StatusConfig limits
    statusConfigPath: string
  }
```

#### Two Comparison Types

| Type | Detection | Result in Excel | Result in Dashboard |
|---|---|---|---|
| **Value mismatch** | Normalized cell values differ | Red text on Production row | 🔴 Red cell |
| **Highlight mismatch** | Values same, but one file marks cell red (out-of-limits) and the other does not | Orange fill (`FFFFD966`) on both rows | 🟠 Orange cell |

#### Highlight Mismatch Scenarios

| Actual (BoltDB) | Production (UI) | Meaning |
|---|---|---|
| 🔴 Red cell | 🔴 Red cell | Both agree — out of limits ✅ PASS |
| Not red | Not red | Both agree — within limits ✅ PASS |
| 🔴 Red cell | Not red | **UI missed the violation** ❌ FAIL |
| Not red | 🔴 Red cell | **UI flagged something BoltDB didn't** ❌ FAIL |

#### Red Cell Detection (`_isRedCell`)

Generic detection using RGB values — covers all Tailwind red variants without hardcoding one specific hex:
- **Rule:** R > 200 AND G < 180 AND B < 180
- **Covers:** `FFFEE2E2` (red-100) through `FFDC2626` (red-600) and all shades between

#### Ignored Columns (value + highlight both skipped)

`Weld ID`, `Status`, `Sl.no`, `Welder ID`, `Event`, `Record`, `Pipe`, `Band`, `Logging`, `Year`, `Month`, `Day`, `Hour`, `Minute`, `Second`, `IWM`, `M500`

#### Limits Check

When `runLimitsCheck: true`, reads the Production Excel and independently checks each param value against StatusConfig min/max limits.

| Output sheet | Content |
|---|---|
| `Limits_{sheetName}` | Each violation row with param, value, min, max, violation reason |
| `LIMITS_SUMMARY` | Total rows checked, violation count, method reference |

**Row colors in Limits sheet:**
- 🟡 Yellow — out of limits but **NOT** flagged in Production (needs attention)
- 🔴 Pink — out of limits AND already flagged red in Production

#### Output files

| File | Location |
|---|---|
| `Final_Comparison_{project}_{ts}.xlsx` | `exports/ComparedData/` |
| `Final_Comparison_{project}_{ts}.html` | `exports/ComparedData/` (dashboard) |

---

### `ComparisonDashboard.js`

**Purpose:** Reads the Final Comparison Excel and generates a self-contained HTML report with inline SVG donut charts (no external dependencies).

#### Features

- Summary stats: Total rows, Passed, Failed, Pass Rate
- Color legend: Red = value mismatch, Orange = highlight mismatch
- Per-sheet breakdown grouped by **Pass Name** (View sheets) or **Zone** (tlog sheets)
- Inline SVG donut chart per group showing pass/fail split
- Failure table with Actual row (grey italic) and Production row (white), mismatched cells highlighted

#### Donut Chart

Pure SVG — no Chart.js, no CDN. Renders in all environments including Playwright's attachment iframe.

---

### `device_register.js`

**Purpose:** Terminal script that runs device registration executables and captures the device ID.

| Step | What it does |
|---|---|
| `--step=1` | Runs the registration EXE, captures `DESKTOP-XXXXXXX` from output, saves to `Combinations.json` as `capturedDeviceId` |
| `--step=2` | Runs sync EXE with `-db` and `-param` arguments, monitors output for completion signal |
| `--step=0` (default) | Runs both steps |

**Auto-discovery:** If `exe`, `db`, or `param` fields are empty in config, automatically searches `Input/` directory for matching file extensions (`.exe`, `.db`, `.csv`/`.xml`).

---

## 📊 Output Files Summary

| File | Location | Generated by |
|---|---|---|
| `BoltD_{project}_{ts}.xlsx` | `exports/ActualData/` | `BoltDBTxtFileTOExcel` |
| `Production_Report_{project}_{ts}.xlsx` | `exports/ProductionData/` | `ProductionTabWeldData` |
| `Final_Comparison_{project}_{ts}.xlsx` | `exports/ComparedData/` | `compare.page.js` |
| `Final_Comparison_{project}_{ts}.html` | `exports/ComparedData/` | `ComparisonDashboard.js` |
| `XML_StatusConfig_UI.xlsx` | `exports/StatusConfig UI/` | `StatusConfigPass.page.js` |
| `Detailed_Assertion_Report.html` | `playwright-report/` | `AssertionHelper.js` |

---

## 🚀 Running the Tests

```bash
# Run all steps
npx playwright test --headed

# Run only BoltDB extraction + comparison (no browser needed)
# Set in Combinations.json: BoltDBExcel: true, comparison: true, all others: false

# View the HTML report
npx playwright show-report
```

---

## 🔧 Adding a New Project

1. Update `Combinations.json` → `singleProject` with the new project name and source file
2. Place the BoltDB `.txt` file in `Input/`
3. Place `WeldParametersCsvToExcel.xlsx` and `XML_StatusConfig_UI.xlsx` in `exports/StatusConfig UI/`
4. Set `flowControl` flags as needed
5. Run `npx playwright test --headed`

---

## 📐 Rounding Reference

| Parameter | Imperial | Metric |
|---|---|---|
| Voltage | 1 decimal | 1 decimal |
| Current | 0 decimals | 0 decimals |
| Wire Speed | 0 decimals | 0 decimals |
| Travel Speed | 1 decimal | 0 decimals |
| Oscillation Width | 3 decimals | 1 decimal |
| Oscillation Freq | 0 decimals | 0 decimals |
| True Energy | 1 decimal | 2 decimals |
| Heat Input | 1 decimal | 2 decimals |
| Tilt | 0 decimals | 0 decimals |