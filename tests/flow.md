# production-flow.spec.js

## Purpose

The main Playwright test spec that orchestrates the entire end-to-end weld automation flow. Controls which steps run via `flowControl` flags in `Combinations.json`. Each step is an independent `test()` block that can be individually enabled or disabled.

---

## Location

```
tests/production-flow.spec.js
```

---

## Dependencies

| Import | Description |
|---|---|
| `LoginAndProjectPage` | Login browser interaction |
| `CreateProjectPage` | Project creation UI |
| `SpecificationPage` | Specification uploads |
| `DeviceAssigningPage` | Device search and assign |
| `SetupPage` | Pipe configuration |
| `StatusConfigPage` | Slope configuration UI |
| `StatusConfigPass` | StatusConfig data extractor |
| `ProductionTabWeldData` | UI scraper |
| `BoltDBTxtFileTOExcel` | BoltDB file parser |
| `ComparePage` | Comparison engine |
| `CommonHelper` | Shared utilities |
| `AssertionHelper` | Central assertion logger |
| `LoginAssertion` | Login scenario logic |
| `ProductionTabAssertion` | Production tab checks |

---

## Flow Control

All steps are gated by `flowControl` flags from `Combinations.json`. Set any flag to `false` to skip that step without failing the run.

```json
"flowControl": {
  "cleanExports":       true,
  "checkSourceFile":    false,
  "runExtraction":      false,
  "BoltDBExcel":        true,
  "login":              true,
  "createProject":      false,
  "deviceRegistration": false,
  "setup":              false,
  "specification":      false,
  "statusConfigPass":   false,
  "deviceSync":         false,
  "productionAnalysis": true,
  "comparison":         true
}
```

---

## Shared State

Declared at `describe` level — shared across all `test()` blocks:

| Variable | Type | Description |
|---|---|---|
| `page` | Playwright Page | Shared browser page (opened once in `beforeEach`) |
| `helper` | CommonHelper | Shared utility instance |
| `login` | LoginAndProjectPage | Login page object |
| `createPage` | CreateProjectPage | Project creation page object |
| `specPage` | SpecificationPage | Specification page object |
| `deviceAssign` | DeviceAssigningPage | Device assignment page object |
| `setupPage` | SetupPage | Setup page object |
| `status` | StatusConfigPage | Status config page object |
| `statusConfigPass` | StatusConfigPass | Status config pass extractor |
| `analysis` | ProductionTabWeldData | UI scraper |
| `compare` | ComparePage | Comparison engine |
| `derivedSetup` | object or null | Setup data extracted from BoltDB (pipe size, wall thickness, WPS) |
| `deviceId` | string or null | Captured device ID from registration |

---

## Lifecycle Hooks

---

### `beforeAll`

Runs once before all tests. No browser page needed here.

**Steps (each gated by its flowControl flag):**

1. **`cleanExports`** — Delete `exports/ActualData/`, `exports/ProductionData/`, `exports/ComparedData/`
2. **`checkSourceFile`** — Assert that `Input/{sourceFile}` exists. Fails test if missing.
3. **`runExtraction`** — Run BoltDB extractor (no Excel saved) to derive `pipeSize`, `wallThickness`, `wps` from the source file. Stores result in `derivedSetup` for use in Step 5.

---

### `beforeEach`

Runs before each test. Opens the browser only if at least one browser-dependent step is enabled.

```js
const needsBrowser = fc.login || fc.createProject || fc.deviceRegistration ||
                     fc.setup || fc.specification || fc.deviceSync ||
                     fc.productionAnalysis || fc.statusConfigPass || fc.comparison;
```

If `needsBrowser = false` (e.g. only `BoltDBExcel: true`), no browser page is opened — prevents an empty blank tab from being created.

The `if (page) return;` guard ensures all page objects are initialized only once, even though `beforeEach` runs before every test.

---

### `afterAll`

Runs once after all tests.

1. Close the browser page
2. Generate the assertion dashboard HTML
3. Attach it to the Playwright report as `📝 Detailed Assertion Dashboard`

---

## Test Steps

---

### Step 1 — Login

```
fc.login = true → runs | false → skipped
```

Delegates entirely to `LoginAssertion.run()` which tests multiple login scenarios (valid, invalid email, invalid password, empty fields) and logs each result.

---

### Step 2 — Create Project

```
fc.createProject = true → runs | false → skipped
```

Calls `createPage.createProject()` with `createProjectData` from config merged with the project name. Logs `PASS` or `FAIL`.

---

### Step 3 & 4 — Device Registration & Assignment

```
fc.deviceRegistration = true AND mode != 'multiBrowser' AND deviceRegistration.enabled != false → runs
```

Three sub-steps wrapped in `test.step()`:

1. **Run Device Register (Step 1)** — spawn `device_register.js --step=1`
2. **Wait for Device ID** — poll `Combinations.json` via `helper.waitForDeviceId()` until `capturedDeviceId` appears
3. **Assign Device** — call `deviceAssign.assignProjectToDevice(deviceId, projectName)`

---

### Step 5 — Project Setup

```
fc.setup = true → runs | false → skipped
```

If `derivedSetup` is available (from `runExtraction`), updates `Combinations.json` with the real pipe values before calling `setupPage.performSetup()`.

---

### Step 6 — Specifications

```
fc.specification = true → runs | false → skipped
```

If `project.specificationData` is not defined → logs skip and returns.

Otherwise:
1. Navigate to Specifications tab
2. If `excelTemplate` defined → `uploadSpecifications()`
3. If `newSpecification` defined → `addNewSpecificationManual()`

---

### Step 7 — Device Sync

```
fc.deviceSync = true AND deviceRegistration.enabled AND mode != 'multiBrowser' → runs
```

Spawns `device_register.js --step=2`. Logs completion and asserts success.

---

### Step 8 & 9 — Production Tab Verification

```
fc.productionAnalysis = true → runs | false → skipped
```

Delegates to `ProductionTabAssertion.run()` which opens the project, navigates to the Production tab, and verifies the table loaded correctly.

---

### Dynamic Steps — Per Slope Combination

For each entry in `project.slopeCombinations`, four tests are generated dynamically:

---

#### BoltDB Extraction `(In: X, Out: Y)`

```
fc.BoltDBExcel = true → runs | false → skipped
```

1. Resolve absolute paths for `statusConfigPath` and `weldParamsPath`
2. Call `extractor.run(slopeIn, slopeOut, projectName, sourceFile, true, statusConfigPath, weldParamsPath, unitConfig)`
3. Attach the generated Excel file to the Playwright report
4. Log `PASS` or `FAIL`

---

#### Status Configuration `(In: X, Out: Y)`

```
fc.productionAnalysis = true → runs | false → skipped
```

1. `status.applyStatusConfiguration(slopeIn, slopeOut)` — set slopes in UI
2. If `fc.statusConfigPass = true` → extract StatusConfig UI data via `statusConfigPass.run()` and attach to report

---

#### UI Analysis `(In: X, Out: Y)`

```
fc.productionAnalysis = true → runs | false → skipped
```

Calls `analysis.runFlow(targetWeldId, null, projectName)` to scrape the production UI. Attaches the output Excel to the report.

---

#### Comparison Report `(In: X, Out: Y)`

```
fc.comparison = true → runs | false → skipped
```

1. `compare.runAutoCompare(projectName, targetWeldId)` — run comparison
2. Attach comparison Excel and HTML dashboard to report
3. If `hasFailure = true` → `expect(false).toBe(true)` — **fails the test** with message pointing to the dashboard

---

### Flow Complete

Always runs (no skip condition). Logs completion to the assertion dashboard.

---

## Full Flow Diagram

```
beforeAll
  ├── cleanExports → delete old files
  ├── checkSourceFile → assert .txt exists
  └── runExtraction → derive setup values from BoltDB

beforeEach (once only, guarded by 'if (page) return')
  └── open browser if needsBrowser

Step 1  ──── Login
Step 2  ──── Create Project
Step 3&4 ─── Device Registration → Capture ID → Assign to Project
Step 5  ──── Setup (pipe config)
Step 6  ──── Specifications
Step 7  ──── Device Sync
Step 8&9 ─── Production Tab verification

For each slope combination:
  BoltDB Extraction ──────────────────────────── → ActualData/BoltD_*.xlsx
  Status Configuration ───────────────────────── → (UI update)
  UI Analysis ────────────────────────────────── → ProductionData/Production_Report_*.xlsx
  Comparison Report ──────────────────────────── → ComparedData/Final_Comparison_*.xlsx
                                                    ComparedData/Final_Comparison_*.html

afterAll
  └── generate + attach assertion dashboard
```

---

## Typical `Combinations.json` for BoltDB-only run

```json
"flowControl": {
  "cleanExports": true,
  "BoltDBExcel": true,
  "login": false,
  "createProject": false,
  "deviceRegistration": false,
  "setup": false,
  "specification": false,
  "statusConfigPass": false,
  "deviceSync": false,
  "productionAnalysis": false,
  "comparison": false
}
```

This runs only the BoltDB extractor with no browser opened.

---

## Related Files

| File | Relationship |
|---|---|
| `config/Combinations.json` | All configuration — flow control, project data, unit config |
| All `pages/` files | Instantiated and called here |
| `Helper/AssertionHelper.js` | `assertion.log()` and `generateDashboard()` |
| `Assertions/LoginAssertion.js` | Step 1 |
| `Assertions/ProductionTabAssertion.js` | Step 8 & 9 |