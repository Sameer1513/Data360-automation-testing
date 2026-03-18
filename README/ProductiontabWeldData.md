# ProductionTabWeldData.page.js

## Purpose

Scrapes live production UI data from the weld management application and writes it to a structured Excel workbook. Captures both the **view-level rows** (Pass/Zone/Tilt views) and the **tlog-level rows** (individual T records) including cell background colors for out-of-limit detection.

---

## Location

```
pages/ProductionTabWeldData.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `ProductionTabWeldDataLocators.page.js` | `Locators/` | All UI element selectors |
| `AssertionHelper.js` | `Helper/` | `assertion.log()` |
| `scroll.util.js` | `utils/` | `autoScroll()` for full table loading |
| `ExcelJS` | npm | Excel workbook creation |
| `@playwright/test` | npm | `test.step`, `expect` |

---

## Constructor

```js
constructor(page, scanConfig)
```

| Property | Description |
|---|---|
| `this.page` | Playwright page instance |
| `this.locators` | `ProductionTabWeldDataLocators` instance |
| `this.exportDir` | Output path: `exports/ProductionData/` |
| `this.scanConfig` | Which tabs and sub-types to scrape (from `Combinations.json`) |

---

## Scan Config

Controls exactly which sheets are produced:

```json
"scanConfig": {
  "Pass": { "view": true,  "tlogs": true  },
  "Zone": { "view": true,  "tlogs": false },
  "Tilt": { "view": true,  "tlogs": false }
}
```

| Key | `view: true` | `tlogs: true` |
|---|---|---|
| `Pass` | Creates `Pass_View` sheet | Creates `Pass_tlogs_data` sheet by opening each row's eye icon |
| `Zone` | Creates `Zone_View` sheet | Creates `Zone_tlogs_data` sheet |
| `Tilt` | Creates `Tilt_View` sheet | Creates `Tilt_tlogs_data` sheet |

---

## Output

**File:** `exports/ProductionData/Production_Report_{projectName}_{timestamp}.xlsx`

**Sheets produced:**

| Sheet | Content | Produced when |
|---|---|---|
| `WeldSummary` | One row per weld from main production table | Always |
| `Pass_View` | Pass-level view rows | `scanConfig.Pass.view = true` |
| `Zone_View` | Zone-level view rows | `scanConfig.Zone.view = true` |
| `Tilt_View` | Tilt-range view rows | `scanConfig.Tilt.view = true` |
| `Pass_tlogs_data` | Individual tlog readings for Pass | `scanConfig.Pass.tlogs = true` |
| `Zone_tlogs_data` | Individual tlog readings for Zone | `scanConfig.Zone.tlogs = true` |
| `Tilt_tlogs_data` | Individual tlog readings for Tilt | `scanConfig.Tilt.tlogs = true` |

---

## Methods

---

### `runFlow(weldIds, prodLimit, projectName)`

Main entry point. Iterates through target weld IDs, processes each weld, and saves the workbook progressively after each weld.

```js
const filePath = await analysis.runFlow(['152'], null, 'XML');
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `weldIds` | string or string[] | Weld IDs to process. Empty → auto-discover from table |
| `prodLimit` | number or null | Max welds to process (null = all) |
| `projectName` | string | Used in output filename |

**Returns:** `Promise<string>` — path to the saved Excel file

**Auto-discovery (when `weldIds` is empty):**
1. Scroll the table scroller slightly to trigger network request
2. Wait for first data cell to appear
3. Read all visible Weld ID cells
4. Use those as the target list

**Per-weld flow:**
1. Search and filter to the specific weld
2. Wait 1.5 seconds for search results to load
3. Click the eye icon to enter detail view
4. `generateWeldSummarySheet()` — capture summary row
5. Read production headers and first row data
6. For each enabled tab in `scanConfig` → `processTabByName()`
7. `goBackSafe()` — navigate back
8. `clearSearch()` — reset table for next iteration
9. Save workbook to file

---

### `searchAndFilterWeld(weldId)`

Searches for a specific weld ID and clicks its eye icon to enter the detail view.

```js
await analysis.searchAndFilterWeld('152');
```

**Internal steps:**
1. Triple-click search input to select all, then Backspace to clear
2. Fill the weld ID and press Enter
3. Locate the table row where Weld ID column matches exactly
4. Wait up to 15 seconds for the row to appear
5. Scroll the row into view
6. Click the eye icon in the Weld Data column of that exact row
7. Wait for tabs to appear (confirms detail view loaded)

**Error handling:**
- If table shows "No weld data available" → throws specific error message
- If row/eye button not found → throws general error

---

### `clearSearch()`

Clears the search input to reset the table for the next weld.

**Internal steps:**
1. If the clear (X) button is visible → click it
2. If click fails → fallback: manually clear input with `Ctrl+A` + `Backspace` + `Enter`
3. If clear button not visible → fill input with empty string + `Enter`
4. Wait 1 second for table to reset

---

### `processTabByName(workbook, tabName, prodHeaders, prodRowData, currentWeldId)`

Clicks a tab (Pass/Zone/Tilt) and delegates to `processTabView()`.

```js
await analysis.processTabByName(workbook, 'Pass', headers, rowData, '152');
```

**Error handling:** Catches and logs warnings per tab — one failed tab does not stop other tabs from being scraped.

---

### `processTabView(workbook, viewName, prodHeaders, prodRowData, currentWeldId)`

Core scraping method. Captures view table rows and optionally opens each row's tlog detail.

```js
await analysis.processTabView(workbook, 'Pass', headers, rowData, '152');
```

**Internal steps:**
1. Get or create the `{viewName}_View` sheet (headers written only once)
2. Get or create the `{viewName}_tlogs_data` sheet (if `tlogs: true`)
3. Auto-scroll the table to load all rows
4. Detect if first column is a checkbox column → set `startIndex = 1` to skip it
5. Read header cells from `startIndex` onward
6. `extractTableData()` — bulk-extract all rows in one `evaluate()` call
7. For each row with data → write to view sheet via `addRowWithColor()`
8. If tlog sheet enabled → for each row that has an eye icon → click it and call `scanDataAnalysis()`

---

### `extractTableData(tableLocator, startIndex)`

Bulk-extracts all table rows in a single browser-side `evaluate()` call. Much faster than iterating with Playwright locators.

```js
const allRows = await analysis.extractTableData(activeTable, 0);
```

**Returns:** Array of row arrays, where each cell is `{ value, bgColor }` or a plain string.

**Cell extraction logic (per cell):**
1. Check for icon SVGs first:
   - `lucide-thumbs-up` → `{ value: 'true' }`
   - `lucide-thumbs-down` → `{ value: 'false' }`
   - `lucide-alert-circle` → `{ value: '!' }`
   - `lucide-minus` → `{ value: '-' }`
   - `lucide-x` → `{ value: 'x' }`
2. Walk all child elements collecting `getComputedStyle().backgroundColor`
3. Keep updating — deepest element with a non-transparent, non-grey background wins
4. Return `{ value: innerText, bgColor: 'rgb(...)' }`

---

### `addRowWithColor(sheet, rowData)`

Writes a row to an Excel sheet, applying background fill colors from captured `bgColor` values.

```js
analysis.addRowWithColor(viewSheet, rowWithId);
```

**Color conversion:**
- Parses `rgb(r, g, b)` string from `bgColor`
- Converts to `FFRRGGBB` hex ARGB format
- Applies as `pattern: solid` fill to the corresponding Excel cell

This is how out-of-limit red cells from the UI are preserved in the Production Excel for later comparison.

---

### `scanDataAnalysis(sheet, viewName, prodHeaders, prodRowData, viewRowData, currentWeldId)`

Opens the tlog detail view for one row and extracts all tlog records.

```js
await analysis.scanDataAnalysis(tlogSheet, 'Pass', headers, rowData, viewRow, '152');
```

**Internal steps:**
1. Wait 2 seconds for the detail view to load
2. Find the table with more than 10 columns (DataAnalysis has many columns)
3. Fallback: use first row cells as headers if proper headers not found
4. Write headers once (`Search Weld ID` prepended as first column)
5. Scroll table to bottom to load all rows
6. `extractTableData()` — bulk extract all tlog rows
7. Filter: only rows where first cell is numeric (actual data rows, not headers)
8. Write each row via `addRowWithColor()`
9. `goBackSafe()` — navigate back to view

---

### `parseCellValue(cell)`

Single-cell version of cell extraction (used for the WeldSummary sheet). Runs in browser context.

```js
const cellData = await analysis.parseCellValue(cell);
```

**Returns:** `{ value: string, bgColor: string | null }`

---

### `generateWeldSummarySheet(workbook, currentWeldId)`

Captures the weld's summary row from the main production table and writes it to the `WeldSummary` sheet.

```js
await analysis.generateWeldSummarySheet(workbook, '152');
```

**Internal steps:**
1. Get or create `WeldSummary` sheet
2. If new sheet → read headers from first table's `thead th`
3. Find first data row (after search filter, this is the target weld)
4. Parse each cell including status icons and background colors
5. Write via `addRowWithColor()`

---

### `goBackSafe()`

Clicks the back button if visible and waits for `networkidle`.

---

### `WelddataEye(index)`

Opens the eye icon for a row by index (used when no weld ID search is performed).

---

### `getColumnIndexByName(name)`

Scans header cells and returns the 1-based column index for the given column name.

---

## Related Files

| File | Relationship |
|---|---|
| `Locators/ProductionTabWeldDataLocators.page.js` | All UI selectors |
| `Helper/AssertionHelper.js` | Logging |
| `utils/scroll.util.js` | `autoScroll()` helper |
| `pages/compare.page.js` | Reads the output Excel for comparison |
| `config/Combinations.json` | `scanConfig` controls which sheets are created |
| `tests/production-flow.spec.js` | UI Analysis step calls `runFlow()` |