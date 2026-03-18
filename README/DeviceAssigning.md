# DeviceAssigning.page.js

## Purpose

Navigates to the Devices page, searches for a registered device by ID, assigns it to a project, and navigates back to the Projects page. Includes retry logic for unstable search results.

---

## Location

```
pages/DeviceAssigning.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `DeviceAssigningLocators.page.js` | `Locators/` | All UI element selectors |
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

### `navigateToDevices()`

Navigates to the Devices page via the sidebar. Handles collapsed sidebar state by expanding it first if needed.

```js
await deviceAssign.navigateToDevices();
```

**Internal steps:**
1. Check if already on `/devices` URL — return early if so
2. Check if Devices button is visible; if not, click sidebar trigger to expand
3. Click the Devices menu button
4. Wait for URL to match `/devices`
5. Wait for Device search input to become visible (confirms page loaded)

**Error handling:** Throws descriptive error if navigation fails after all checks.

---

### `assignProjectToDevice(deviceId, projectName)`

Full device assignment flow. Searches for the device, selects it, picks the project from a dropdown, submits, confirms the modal, and navigates back.

```js
await deviceAssign.assignProjectToDevice('DESKTOP-32QBMO9', 'XML');
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `deviceId` | string | Device ID to search for (e.g. `DESKTOP-32QBMO9`) |
| `projectName` | string | Project name to assign the device to |

---

#### Internal Flow — Step by Step

**1. Navigate**
Calls `navigateToDevices()` to land on the Devices page.

**2. Search for device (with retry — up to 3 attempts)**

Each attempt:
- Clears the search input (`Ctrl+A` + `Backspace`)
- Types the device ID character by character with 50ms delay (human-like)
- Presses `Enter`
- Waits for a text element matching the device ID to appear
- Finds the closest ancestor container that holds a checkbox

If an attempt fails:
- Clears the search input
- Clicks the global **Refresh** button (fetches latest backend data)
- Waits 2.5 seconds before retrying

After 3 failed attempts: throws `❌ Exhausted retries finding Device ID: {id}`

**3. Select checkbox**
Clicks the checkbox inside the device card using `.evaluate(el => el.click())` to avoid event bubbling to the card click handler.

**4. Open project dropdown**
Clicks the combobox dropdown. Uses `.evaluate(el => el.click())` to bypass any `pointer-events: none` CSS.

**5. Select project from dropdown**
Waits for the dropdown list, then clicks the option matching `projectName`.

**6. Submit & confirm**
- Clicks the Assign Project button
- Waits for confirmation modal to appear
- Clicks the Confirm button

**7. Assert success**
- Waits up to 15 seconds for a success toast to appear
- Logs `PASS` or `FAIL` via `assertion.log()`
- Hard `expect(successToast).toBeVisible()` — fails the test if toast never appears
- Waits for the toast to disappear before continuing

**8. Navigate back to Projects**
- Finds the sidebar Projects link by `href="/Projects"`
- Expands sidebar if needed
- Clicks the link
- Waits for URL to match `/projects`
- Hard `expect(page).toHaveURL(/projects/i)` assertion

---

## Retry Logic Detail

```
Attempt 1 → Search → Found? → Done
              ↓ Not found
           Clear + Refresh
Attempt 2 → Search → Found? → Done
              ↓ Not found
           Clear + Refresh
Attempt 3 → Search → Found? → Done
              ↓ Not found
           THROW ERROR
```

The Refresh button click fetches fresh device data from the backend, which helps when the device was just registered and the UI hasn't updated yet.

---

## Usage in Spec

```js
// In production-flow.spec.js Step 3 & 4
await deviceAssign.assignProjectToDevice(deviceId, project.projectName);
```

`deviceId` is captured from `Combinations.json` after Step 3 (device registration).

---

## Related Files

| File | Relationship |
|---|---|
| `Locators/DeviceAssigningLocators.page.js` | All UI selectors |
| `Helper/AssertionHelper.js` | Logging pass/fail |
| `terminal_execution_files/device_register.js` | Runs the EXE that registers the device and produces the ID |
| `tests/production-flow.spec.js` | Step 3 & 4 calls this page |
| `config/Combinations.json` | `capturedDeviceId` is written here after registration |