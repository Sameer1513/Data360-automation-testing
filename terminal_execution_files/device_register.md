# device_register.js

## Purpose

Terminal script that runs the device registration executables (`.exe` files) to register a device with the system and sync BoltDB data. Captures the device ID from stdout and saves it to `Combinations.json`. Called by the spec file via Node `spawn`.

---

## Location

```
terminal_execution_files/device_register.js
```

---

## Usage

```bash
node device_register.js --step=1   # Run only Step 1 (register device, capture ID)
node device_register.js --step=2   # Run only Step 2 (sync data)
node device_register.js            # Run both steps
```

---

## Step Overview

| Step | What it does | Input | Output |
|---|---|---|---|
| Step 1 | Runs registration EXE, captures device ID from stdout | `exe` from config | `capturedDeviceId` written to `Combinations.json` |
| Step 2 | Runs sync EXE with `-db` and `-param` args, monitors for completion | `exe`, `db`, `param` from config | BoltDB data synced |

---

## Configuration (`Combinations.json`)

```json
"deviceRegistration": {
  "enabled": true,
  "step1": {
    "enabled": true,
    "exe": ""
  },
  "step2": {
    "enabled": true,
    "files": [
      {
        "exe": "",
        "db": "",
        "param": ""
      }
    ]
  }
}
```

If any of `exe`, `db`, or `param` fields are empty, the script auto-discovers files from the `Input/` directory.

---

## Auto-Discovery

When a file field is empty in config, the script searches these directories in order:

```
./
../input/
./input/
../Input/
./Input/
```

| Field | Searches for |
|---|---|
| `exe` | First `.exe` file |
| `db` | First `.db` file |
| `param` | First `.csv` file, then first `.xml` file |

---

## Functions

---

### `runStep1(exeName)`

Runs the registration EXE, captures the device ID from its output, waits 5 seconds for registration to complete, then terminates the process.

```js
const deviceID = await runStep1('register.exe');
```

**Returns:** `Promise<string>` — the captured device ID, or `""` if not captured

**ID capture logic:**
- Listens to both `stdout` and `stderr`
- Accumulates all output into a buffer
- Scans buffer with regex `DESKTOP-[A-Z0-9-]+` (case insensitive)
- On first match: logs the ID, starts a 5-second wait, then kills the process using `taskkill /PID /F /T`

**`taskkill /T` flag:** Terminates the entire process tree (not just the main process), preventing child processes from lingering.

**Process exit handling:**
- If ID was captured → resolves with the ID (regardless of exit code)
- If no ID captured and exit code 0 → resolves with `""` + warning
- If no ID captured and non-zero exit code → rejects with error

---

### `runStep2(exeName, dbFile, paramFile)`

Runs the sync EXE with database and parameter file arguments. Monitors output for a completion signal, then terminates.

```js
await runStep2('sync.exe', 'data.db', 'params.csv');
```

**Arguments passed to EXE:**
```
sync.exe -db /full/path/to/data.db -param /full/path/to/params.csv
```

**Pre-cleanup before running:**
1. `taskkill /F /IM {exeName}` — kill any existing instances
2. Delete `.db.lock` file if it exists

**Completion detection:**

Monitors output for any of these signals:
- `"No new logs to publish"` — all data already synced
- `"(boltdb) Get all logs: Completed"` — BoltDB read complete
- More than 3 consecutive MQTT heartbeat messages with no data records (`idleCheckCount > 3`)

**MQTT idle counter logic:**
- If chunk contains S/T/C records → reset `idleCheckCount = 0` (data is flowing)
- If chunk contains only heartbeat status messages → increment `idleCheckCount`
- When `idleCheckCount > 3` with no data → consider sync complete

**On completion:**
1. `taskkill /PID /F /T` to terminate process tree
2. Delete `.db.lock` file
3. Resolve the promise

**Post-cleanup:** After all files are processed, deletes all `.db.lock` files (not the `.db` files themselves, which are preserved for reference).

---

## Device ID Flow

```
Step 1 runs → device ID printed to stdout → captured by regex
     ↓
Written to Combinations.json as capturedDeviceId
     ↓
Spec reads it via helper.waitForDeviceId()
     ↓
DeviceAssigning.page.js uses it to search and assign
```

---

## How the Spec Calls This

```js
// In production-flow.spec.js Step 3 & 4
const child = spawn('node', [scriptPath, '--step=1'], { stdio: 'inherit', shell: true });
child.on('close', (code) => code === 0 ? resolve() : reject(...));
```

The script exits with code `0` on success, non-zero on failure. The spec wraps it in a `Promise` and awaits it.

---

## Error Handling

| Situation | What happens |
|---|---|
| Config missing `deviceRegistration` section | Logs error and exits with code 1 |
| `enabled: false` | Logs info and exits with code 0 (skip, not error) |
| EXE file not found after auto-discovery | Throws with list of paths checked |
| Step 1 exit non-zero, no ID captured | Rejects with exit code info |
| Step 2 exit non-zero, no completion signal | Rejects with exit code info |

---

## Related Files

| File | Relationship |
|---|---|
| `config/Combinations.json` | Reads `deviceRegistration` config; writes `capturedDeviceId` |
| `Input/` | Auto-discovery searches here for EXE, DB, param files |
| `pages/DeviceAssigning.page.js` | Uses the captured device ID |
| `Helper/CommonHelper.js` | `waitForDeviceId()` polls `Combinations.json` until the ID appears |
| `tests/production-flow.spec.js` | Step 3 and Step 7 call this script |