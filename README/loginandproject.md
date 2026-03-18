# loginAndProject.page.js

## Purpose

Handles **browser interaction only** for the login flow. This page object navigates to the app URL, fills in credentials, and returns a status string. All assertion logic and test reporting is handled separately in `Assertions/LoginAssertion.js`.

---

## Location

```
pages/loginAndProject.page.js
```

---

## Dependencies

| Dependency | Path | What it provides |
|---|---|---|
| `LoginPageCredential.page.js` | `Global/` | URL, correct email, correct password |
| `LoginPageLocators.page.js` | `Locators/` | All UI element selectors |

---

## Constructor

```js
constructor(page)
```

| Property | Source | Description |
|---|---|---|
| `this.page` | Playwright page | Browser page instance |
| `this.url` | credentials file | App URL to navigate to |
| `this.correctEmail` | credentials file | Valid login email |
| `this.correctPassword` | credentials file | Valid login password |

---

## Methods

---

### `attemptLogin(email, password)`

The core login method. Navigates to the URL, fills credentials, optionally toggles password visibility and checks the checkbox, then clicks Login and waits for a UI response.

```js
const status = await login.attemptLogin(email, password);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `email` | string | Email to fill (can be empty string for negative tests) |
| `password` | string | Password to fill (can be empty string for negative tests) |

**Returns:** `Promise<string>` — one of the status codes below

**Return values:**

| Status | When it occurs |
|---|---|
| `SUCCESS` | Page contains text matching `/Projects/i` after login |
| `ERROR` | Page shows text matching `/error\|invalid\|failed\|network\|something went wrong/i` |
| `EMPTY_FIELD` | Browser's native HTML validation triggered (`input:invalid` found in DOM) |
| `NO_CHANGE` | None of the above detected within 30 seconds (timeout) |

**Internal flow:**
1. `page.goto(url)` — navigate and wait for load
2. Fill email input (first match)
3. Fill password input (first match)
4. Click eye icon if visible (shows password)
5. Check checkbox if visible (remember me / terms)
6. Click Login button
7. `Promise.race` — whichever condition fires first wins

---

### `getWrongEmail()`

Generates an invalid email by mutating the correct email. Used by `LoginAssertion.js` for negative login tests.

```js
const bad = login.getWrongEmail();
// e.g. "user.l@example.com" → "user@example.com"
```

**Returns:** `string` — mutated email (removes `.l` before `@`)

---

### `getWrongPassword()`

Generates an invalid password by mutating the correct password. Used for negative login tests.

```js
const bad = login.getWrongPassword();
// Removes '&' character from the password
```

**Returns:** `string` — mutated password

---

### `getReadableStatus(status)`

Maps internal status codes to human-readable display strings for reporting.

```js
const msg = login.getReadableStatus('SUCCESS');
// → 'Login Successful'
```

| Input | Output |
|---|---|
| `SUCCESS` | `Login Successful` |
| `ERROR` | `Login Failed (Invalid Credentials)` |
| `EMPTY_FIELD` | `Login Failed (Empty Fields — Validation Triggered)` |
| `NO_CHANGE` | `Login Failed (No UI Response)` |

---

## How It Is Used

```js
// In LoginAssertion.js
const status = await login.attemptLogin(login.correctEmail, login.correctPassword);
// Then assertion logic checks status and logs result
```

The spec file calls it via `LoginAssertion`:
```js
// In production-flow.spec.js Step 1
await new LoginAssertion(login).run(test.info());
```

---

## What This File Does NOT Do

- Does **not** log assertions or call `assertion.log()` — that is `LoginAssertion.js`
- Does **not** navigate after login — that is handled by subsequent steps
- Does **not** store session or cookies manually — Playwright handles that

---

## Related Files

| File | Relationship |
|---|---|
| `Assertions/LoginAssertion.js` | Calls `attemptLogin()` and logs results |
| `Global/LoginPageCredential.page.js` | Provides URL and credentials |
| `Locators/LoginPageLocators.page.js` | Provides all UI element locators |
| `tests/production-flow.spec.js` | Step 1 instantiates this class |