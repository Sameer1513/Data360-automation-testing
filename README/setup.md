# setup.page.js

## Purpose

Configures project pipe details in the UI — pipe size, wall thickness, pipe count, length, manufacturer, and WPS numbers. Reads all values from `Combinations.json` and fills the setup form row by row.

---

## Location

```
pages/setup.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `SetupLocators.page.js` | `Locators/` | All UI element selectors |
| `CommonHelper.js` | `Helper/` | `selectProject()` navigation helper |
| `AssertionHelper.js` | `Helper/` | `assertion.log()` for reporting |
| `@playwright/test` | npm | `expect` for assertions |

---

## Constructor

```js
constructor(page)
```

| Property | Description |
|---|---|
| `this.page` | Playwright page instance |
| `this.helper` | `CommonHelper` instance for project navigation |
| `this.configPath` | Absolute path to `Combinations.json` |

---

## Methods

---

### `getProjectConfig(projectName)`

Reads `Combinations.json` and returns the config object for the specified project.

```js
const project = setupPage.getProjectConfig('XML');
```

**Resolution order:**
1. If `config.mode === "single"` → return `config.singleProject`
2. Search `config.multiProject[]` by `projectName`
3. If not found → search `config.multiBrowser[]` by `projectName`

**Returns:** Project config object containing `setupConfig`, or `undefined` if not found.

---

### `performSetup(projectName)`

Full setup flow. Opens the project, navigates to the Setup tab, enters the total pipe count, fills each pipe row, saves, and confirms success.

```js
await setupPage.performSetup('XML');
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `projectName` | string | Project to configure |

**Internal steps:**
1. `helper.selectProject(projectName)` — open the project
2. Click the Setup tab
3. Read `setupConfig.pipes` from config
4. Clear and fill the pipe count input with `pipes.length`
5. Wait for pipe details header to confirm UI has rendered the rows
6. For each pipe → call `fillPipeRow(container, pipe, index)`
7. Scroll to and click the Save button
8. Wait up to 15 seconds for success toast
9. Wait for toast to disappear
10. Log `PASS` or `FAIL`

---

### `fillPipeRow(container, pipe, index)`

Fills a single pipe row with all its details.

```js
await setupPage.fillPipeRow(pipeContainer, pipeConfig, 0);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `container` | Locator | The scoped container for this pipe row |
| `pipe` | object | Pipe config object (see fields below) |
| `index` | number | 0-based pipe index (used for logging) |

**Pipe config fields:**

| Field | Type | Example | Description |
|---|---|---|---|
| `pipeSize` | string | `"36.000"` | Pipe outer diameter |
| `wallThickness` | string | `"43.5"` | Wall thickness |
| `pipeCount` | string | `"10"` | Number of pipes |
| `pipeLength` | string | `"10"` | Length per pipe |
| `manufacturer` | string or string[] | `["American", "API-5l"]` | One or more manufacturers |
| `wps` | string or string[] | `["Demo"]` | WPS number(s) |

---

#### Manufacturer selection detail

Manufacturers are entered by typing each name into a search input inside the dropdown:

1. If the search input is not visible, click the manufacturer placeholder to open dropdown
2. Type the manufacturer name
3. Wait 500ms for filtered results
4. Press `Enter` to select
5. If more manufacturers remain: `Ctrl+A` + `Backspace` to clear for next entry
6. After all manufacturers entered: press `Escape` twice to force-close the dropdown
7. Click Pipe Size input to reset focus

---

#### WPS entry detail

WPS entry uses a retry loop (up to 2 attempts) because the input can be obscured by the sticky header:

1. Scroll the WPS input away from the sticky header using a custom `evaluate()` that scrolls the tab panel
2. Wait for input visibility (2 second timeout)
3. Click and type the WPS value with 100ms delay between characters
4. Verify the value was actually entered by reading `inputValue()`
5. If value doesn't match → retry, clicking pipe size input first to reset focus

If both attempts fail: logs `❌ Failed to fill WPS for Pipe {n}` (does not throw).

---

## Pipe Config Example (`Combinations.json`)

```json
"setupConfig": {
  "pipes": [
    {
      "pipeSize": "36.000",
      "wallThickness": "43.5",
      "pipeCount": "10",
      "pipeLength": "10",
      "manufacturer": ["American", "API-5l"],
      "wps": ["Demo"]
    }
  ]
}
```

---

## Dynamic Setup from BoltDB

When `fc.runExtraction = true`, the spec runs the BoltDB extractor first to derive real setup values from the source file and writes them back to `Combinations.json` before `performSetup` runs:

```js
// In production-flow.spec.js Step 5
if (derivedSetup) {
    p.pipeSize      = String(derivedSetup.pipeSize);
    p.wallThickness = String(derivedSetup.wallThickness);
    p.wps           = [String(derivedSetup.wps)];
}
```

This ensures the setup form is filled with the actual values from the BoltDB source file.

---

## Related Files

| File | Relationship |
|---|---|
| `Locators/SetupLocators.page.js` | All UI selectors |
| `Helper/CommonHelper.js` | `selectProject()` navigation |
| `Helper/AssertionHelper.js` | Logging pass/fail |
| `config/Combinations.json` | `setupConfig.pipes` data source |
| `pages/BoltDBTxtFileTOExcel.page.js` | Extracts `pipeSize`, `wallThickness`, `wps` that can override config |
| `tests/production-flow.spec.js` | Step 5 calls `performSetup()` |