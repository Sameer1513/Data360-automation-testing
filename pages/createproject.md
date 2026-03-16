# createproject.page.js

## Purpose

Handles the full **project creation flow** in the UI — filling the form, selecting dropdowns, picking dates, checking feature boxes, and submitting. Also provides helpers to open an existing project and assign a device to it.

---

## Location

```
pages/createproject.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `CreateProjectLocators.page.js` | `Locators/` | All UI element selectors |
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

---

## Methods

---

### `openCreateProject()`

Clicks the Create Project button and waits for the project form to appear.

```js
await createPage.openCreateProject();
```

**Internal steps:**
1. Wait for loader to hide
2. Close any open toast notification
3. Click the Create Project button
4. Wait for the project name input to become visible

---

### `selectDropdown(type, value)`

Selects a value from a React-Select dropdown (location or customer). Uses keyboard typing to filter results rather than direct clicks, which is the most compatible approach for React-Select.

```js
await createPage.selectDropdown('location', 'ANDORRA');
await createPage.selectDropdown('customer', 'advanced engg');
```

**Parameters:**

| Parameter | Type | Accepted values | Description |
|---|---|---|---|
| `type` | string | `'location'`, `'customer'` | Which dropdown to target |
| `value` | string | Any valid option text | The option to select |

**Internal steps:**
1. Click the dropdown to focus it
2. Type the value using `keyboard.type` (compatible with React-Select)
3. Wait 100ms for filtered results
4. Click the matching option (case-insensitive)

**Error handling:** If the dropdown or option is not found, presses `Escape` to close and throws the error.

---

### `selectDate(type, dateString)`

Navigates the date picker calendar to the target month/year and selects the target day. Handles both single-panel and dual-panel date pickers.

```js
await createPage.selectDate('start', '19-Feb-2026');
await createPage.selectDate('end', '20-Feb-2026');
```

**Parameters:**

| Parameter | Type | Format | Description |
|---|---|---|---|
| `type` | string | `'start'`, `'end'` | Which date field to target |
| `dateString` | string | `'DD-MMM-YYYY'` | Target date (e.g. `'19-Feb-2026'`) |

**Supported month formats:**
Full names (`January`…`December`) and abbreviations (`Jan`…`Dec`) — case insensitive.

**Internal steps:**
1. Click the date input inside the correct container
2. Detect how many calendar panels are visible
3. For `end` date with 2 panels → use the right panel; otherwise use the first panel
4. Navigate year using Prev/Next Year buttons (loop up to 30 iterations)
5. Navigate month using Prev/Next Month buttons (loop up to 24 iterations)
6. Click the target day using `force: true` (bypasses blue range-highlight overlay)
7. Press `Escape` to close the picker

---

### `createProject(projectData)`

Full project creation flow. Opens the form, fills all fields, submits, and logs the result.

```js
await createPage.createProject({
    projectName: 'XML',
    projectNumber: '152',
    location: 'ANDORRA',
    customer: 'advanced engg',
    startDate: '19-Feb-2026',
    endDate: '20-Feb-2026',
    projectStatus: 'Initiated',
    projectType: 'Pipeline',
    pipelineFeatures: ['Welding'],
    subFeatures: ['CRCE Machines'],
    machines: ['IWM', 'P-600Z']
});
```

**Parameters (`projectData` object):**

| Field | Type | Description |
|---|---|---|
| `projectName` | string | Project name (text input) |
| `projectNumber` | string | Project number (text input) |
| `location` | string | Location dropdown value |
| `customer` | string | Customer dropdown value |
| `startDate` | string | Start date in `DD-MMM-YYYY` format |
| `endDate` | string | End date in `DD-MMM-YYYY` format |
| `projectStatus` | string | Status checkbox label (e.g. `'Initiated'`) |
| `projectType` | string | Type checkbox label (e.g. `'Pipeline'`) |
| `pipelineFeatures` | string[] | Feature checkbox labels |
| `machines` | string[] | Machine labels to click |

**Internal steps:**
1. `openCreateProject()` — open the form
2. Fill project name and number
3. `selectDropdown` for location and customer
4. `selectDate` for start and end
5. Check projectStatus, projectType, pipelineFeatures checkboxes
6. Click each machine label
7. Click Submit
8. Wait for loader + close toast
9. Log `PASS` via `assertion.log()`

---

### `selectProject(projectName)`

Searches for an existing project and opens it.

```js
await createPage.selectProject('XML');
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `projectName` | string | Exact project name to search and open |

**Internal steps:**
1. Wait for loader
2. Type project name into search input + Enter
3. Wait for project tile to appear (20s timeout)
4. Click the tile
5. Log `PASS`

---

### `assignDevice(projectName, laptopId)`

Opens a project and assigns a device to it via the Devices tab.

```js
await createPage.assignDevice('XML', 'DESKTOP-ABC123');
```

**Note:** This is a lightweight method. Full robust device assignment with retry logic is in `DeviceAssigning.page.js`.

---

### `createProjectsFromMode(config)`

Creates multiple projects based on the flow mode (`singleProject`, `multiProject`, `multiBrowser`). Deduplicates project names before creating.

```js
await createPage.createProjectsFromMode(flowConfig);
```

---

## Config-Driven Usage

The spec file passes project data directly from `Combinations.json`:

```js
// In production-flow.spec.js Step 2
await createPage.createProject({
    ...flowConfig.createProjectData,
    projectName: project.projectName
});
```

`createProjectData` in `Combinations.json` holds all the static fields; `projectName` is overridden per project.

---

## Related Files

| File | Relationship |
|---|---|
| `Locators/CreateProjectLocators.page.js` | All UI selectors |
| `Helper/AssertionHelper.js` | Logging pass/fail |
| `config/Combinations.json` | `createProjectData` + `singleProject.projectName` |
| `tests/production-flow.spec.js` | Step 2 calls `createProject()` |