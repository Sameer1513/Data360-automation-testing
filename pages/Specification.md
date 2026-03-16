# Specification.page.js

## Purpose

Handles specification document management — uploading an Excel template with supporting PDFs, and adding new specifications manually via a modal form. Supports both a **cancel** flow (for UI testing) and a **submit** flow (for actual upload).

---

## Location

```
pages/Specification.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `SpecificationsLocators.page.js` | `Locators/` | All UI element selectors |
| `AssertionHelper.js` | `Helper/` | `assertion.log()` for reporting |
| `@playwright/test` | npm | `test.step`, `expect` |

---

## Constructor

```js
constructor(page)
```

| Property | Description |
|---|---|
| `this.page` | Playwright page instance |
| `this.inputDir` | Absolute path to the `SpecificationInput` folder |

---

## Methods

---

### `getFilePath(fileName)`

Resolves and validates the absolute path for a file in the input directory.

```js
const fullPath = await specPage.getFilePath('Drawing_001.pdf');
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `fileName` | string | File name (not full path) |

**Returns:** `Promise<string>` — absolute path

**Throws:** Error if file does not exist at the resolved path.

---

### `navigateToSpecifications(projectName)`

Clicks the Specifications tab inside the current project view.

```js
await specPage.navigateToSpecifications('XML');
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `projectName` | string | Used for logging context only |

**Internal steps:**
1. Click the Specifications tab (by role `tab`, name `Specifications`)
2. Wait for `networkidle` state

---

### `uploadSpecifications(data, actionType)`

Opens the upload modal, attaches an Excel template (Step 1) and supporting documents (Step 2), then either cancels or submits.

```js
await specPage.uploadSpecifications(specData);          // default: cancel
await specPage.uploadSpecifications(specData, 'submit'); // actually upload
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | object | required | Spec upload data (see fields below) |
| `actionType` | string | `'cancel'` | `'cancel'` or `'submit'` |

**`data` object fields:**

| Field | Type | Description |
|---|---|---|
| `excelTemplate` | string | Excel template filename in `SpecificationInput/` |
| `documents` | string[] | Array of PDF/document filenames |

**Internal steps:**
1. Click Download Template button (triggers template download for reference)
2. Click Upload Specs button (opens modal)
3. **Step 1:** Attach Excel template via hidden file input; wait for filename to appear in UI
4. Wait for `"Please upload an Excel template first"` warning to disappear (confirms Step 1 unlocked Step 2)
5. **Step 2:** Resolve all document paths and attach via hidden file input; verify all filenames appear
6. If `actionType === 'cancel'` → click Cancel; assert modal closed
7. If `actionType === 'submit'` → click Upload All; wait for success toast

---

### `addNewSpecificationManual(specData, actionType)`

Opens the Add Specification modal, selects dropdowns (project type, pipe, spec type), uploads files, then cancels or submits.

```js
await specPage.addNewSpecificationManual(specData);           // default: cancel
await specPage.addNewSpecificationManual(specData, 'submit'); // actually add
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `specData` | object | required | Manual spec data (see fields below) |
| `actionType` | string | `'cancel'` | `'cancel'` or `'submit'` |

**`specData` object fields:**

| Field | Type | Description |
|---|---|---|
| `projectType` | string | Option to select in Project Type dropdown |
| `pipe` | string | Option to select in Pipe dropdown *(currently selects first available option)* |
| `specType` | string | Option to select in Spec Type dropdown |
| `files` | string[] | Files to attach for this spec |

**Internal steps:**
1. Click Add Spec button
2. Wait for modal dialog to appear
3. Click Project Type dropdown → select option by name
4. Click Pipe dropdown → select first available option (ignores JSON text in `specData.pipe`)
5. Click Spec Type dropdown → select option by name
6. Resolve all file paths and attach via hidden file input
7. If `actionType === 'cancel'` → click Cancel button scoped inside the dialog; assert dialog hidden
8. If `actionType === 'submit'` → click Add Specification button; assert button disappears (modal closes)

---

## Spec Config Example (`Combinations.json`)

```json
"specificationData": {
  "excelTemplate": "Project_Specification_Template.xlsx",
  "documents": ["Pipeline_Specs_Part1.pdf"],
  "newSpecification": {
    "projectType": "Pipeline",
    "pipe": "Pipe (10\"-12\")",
    "specType": "Drawing",
    "files": ["Drawing_001.pdf"]
  }
}
```

---

## Input Files Location

All specification files must be placed in:

```
C:\projects\playwright-e2e\SpecificationInput\
```

Files used in the current config:
- `Project_Specification_Template.xlsx`
- `Pipeline_Specs_Part1.pdf`
- `Drawing_001.pdf`

---

## Action Type Behaviour

| `actionType` | Upload flow | Manual add flow |
|---|---|---|
| `'cancel'` (default) | Opens modal, attaches files, then clicks Cancel | Opens modal, fills form, then clicks Cancel |
| `'submit'` | Opens modal, attaches files, then clicks Upload All and waits for success toast | Opens modal, fills form, then clicks Add Specification and waits for modal to close |

The default `cancel` flow is used by the spec to test the UI flow without actually modifying production data.

---

## Related Files

| File | Relationship |
|---|---|
| `Locators/SpecificationsLocators.page.js` | All UI selectors |
| `Helper/AssertionHelper.js` | Logging pass/fail |
| `config/Combinations.json` | `specificationData` config block |
| `SpecificationInput/` | Source directory for all uploaded files |
| `tests/production-flow.spec.js` | Step 6 calls `navigateToSpecifications()` and both upload methods |