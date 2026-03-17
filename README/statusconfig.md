# statusConfig.page.js

## Purpose

Applies slope-based status configuration in the UI before scraping production data. If slopes are non-zero, it opens the Status Config panel, fills the In/Out values, saves, and returns to the production table. If slopes are zero, it navigates directly to the production tab without touching config.

---

## Location

```
pages/statusConfig.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `StatusConfigLocators.page.js` | `Locators/` | All UI element selectors |
| `AssertionHelper.js` | `Helper/` | `assertion.log()` for reporting |
| `@playwright/test` | npm | `expect` |

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

### `applyStatusConfiguration(slopeIn, slopeOut)`

Applies slope configuration to the UI if either slope value is non-zero. Always ends by waiting for the production table to be visible.

```js
await status.applyStatusConfiguration(0, 0);   // → goes directly to Production tab
await status.applyStatusConfiguration(5, 3);   // → opens config, fills slopes, saves, navigates back
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `slopeIn` | number | `0` | Slope In value in seconds |
| `slopeOut` | number | `0` | Slope Out value in seconds |

---

#### Internal Flow — Non-zero slopes (`slopeIn > 0 || slopeOut > 0`)

```
1. Click Production tab
2. Click Status Config button
3. Fill slopeIn value → inInput field
4. Fill slopeOut value → outInput field
5. Click Save button
6. Wait up to 10 seconds for success toast
7. Log PASS/FAIL based on toast visibility
8. Click back arrow to return to production table
9. Wait for first production table row to be visible (15s timeout)
```

#### Internal Flow — Zero slopes (`slopeIn === 0 && slopeOut === 0`)

```
1. Click Production tab directly
2. Wait for first production table row to be visible (15s timeout)
```

---

## Why the Final Wait Matters

The wait for the production table row at the end is a **critical sync point**. The next step (UI Analysis) needs the production table to be loaded before it starts scraping. Without this wait, there is a race condition where the scraper starts before the UI has populated the table.

---

## Slope Combinations

The spec iterates over `slopeCombinations` from `Combinations.json`:

```json
"slopeCombinations": [
  { "slopeIn": 0, "slopeOut": 0 },
  { "slopeIn": 5, "slopeOut": 0 }
]
```

For each combination, `applyStatusConfiguration(slopeIn, slopeOut)` is called before scraping and comparison.

---

## How Slopes Affect BoltDB Extraction

The same `slopeIn` and `slopeOut` values are also passed to `BoltDBTxtFileTOExcel.run()`. The extractor uses them to trim T records from the beginning and end of each session:

- Records within `slopeIn` milliseconds of the session start are removed
- Records within `slopeOut` milliseconds of the session end are removed

This mirrors the UI behaviour where slope regions are excluded from analysis.

---

## Related Files

| File | Relationship |
|---|---|
| `Locators/StatusConfigLocators.page.js` | All UI selectors |
| `Helper/AssertionHelper.js` | Logging pass/fail |
| `pages/BoltDBTxtFileTOExcel.page.js` | Receives same `slopeIn`/`slopeOut` for file-based extraction |
| `config/Combinations.json` | `slopeCombinations` drives the iterations |
| `tests/production-flow.spec.js` | Status Config step calls `applyStatusConfiguration()` |