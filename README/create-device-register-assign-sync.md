# Create, Register, Assign, and Sync Flow

## Purpose

This modular flow (`create-device-register-assign-sync.spec.js`) is an orchestrator test that validates the device onboarding pipeline. It automates the end-to-end setup phase required before weld data can be analyzed:
1. Creating one or multiple projects.
2. Registering a physical/virtual device (capturing its `DESKTOP-` ID).
3. Assigning the registered device to the created project(s).
4. Synchronizing one or more BoltDB database files to the portal.

---

## Location

**Test Spec:** `tests/create-device-register-assign-sync.spec.js`
**Configuration:** `config/modular/create-device-register-assign-sync.json`

---

## Dependencies & Linked Files

| Type | File Path | Description |
|---|---|---|
| **Page Object** | `pages/loginAndProject.page.js` | UI interactions for application login. |
| **Page Object** | `pages/createproject.page.js` | UI interactions for filling and submitting the "Create Project" modal. |
| **Page Object** | `pages/DeviceAssigning.page.js` | UI interactions for searching a device and assigning it to a project. |
| **Assertion** | `Assertions/LoginAssertion.js` | Wrapper for executing and validating the login step. |
| **Assertion** | `Assertions/create-device-register-assign-sync-assertion.js` | Custom assertion logic that aggregates device capture results, assignment status, and sync completion signals into a final report table. |
| **Helper** | `Helper/CommonHelper.js` | Shared utilities (e.g., `waitForDeviceId` to poll for the newly generated device ID). |
| **Script** | `terminal_execution_files/device_register.js` | The local Node script that spawns the executable files for Step 1 (Registration) and Step 2 (Data Sync). |
| **Config (Modular)** | `config/modular/create-device-register-assign-sync.json` | The main configuration file specific to this modular flow. Contains `flowControl` and the `cases` array. |
| **Config** | `config/Combinations.json` | The base configuration file which is dynamically updated during the test to pass file paths to the device sync script. |

---

## How It Works (The Flow)

The test is data-driven, reading an array of `cases` from its modular JSON configuration file. Each case represents a specific scenario (e.g., single project + single sync, multi-project + single sync, single project + multi-sync).

For each enabled case, the test executes the following sequence:

1. **Initialization:**
   - Deep clones the `Combinations.json` to safely modify parameters.
   - Pre-configures the data sync file locations.

2. **Login:**
   - Logs into the portal via the UI.

3. **Device Registration (Step 1):**
   - Spawns `device_register.js --step=1`.
   - Polls `Combinations.json` to capture the newly generated `capturedDeviceId`.

4. **Project Creation & Assignment:**
   Depending on the configured `syncMode`, it behaves in one of two ways:
   
   * **`serialPerProject` Mode:**
     Loops through each project: creates the project -> assigns the device -> runs data sync (Step 2).
   
   * **`assignThenSyncAll` Mode (Default):**
     Loops to create *all* projects first -> assigns the device to each project -> runs data sync (Step 2) for all database files.

5. **Data Synchronization (Step 2):**
   - Modifies `Combinations.json` with the current `db` and `param` file paths.
   - Spawns `device_register.js --step=2`.
   - Captures terminal output to verify the `[SYNC COMPLETE]` marker.

6. **Assertions:**
   - Validates the device ID was successfully captured.
   - Validates that the UI shows the expected projects assigned to the device.
   - Validates that all requested sync processes exited successfully.
   - Attaches a formatted summary to the Playwright HTML report.

---

## Configuration Guide

The flow is controlled by `config/modular/create-device-register-assign-sync.json`.

### Example Configuration File

```json
{
  "flowControl": {
    "login": true,
    "createProject": true,
    "deviceRegistration": true,
    "deviceSync": true
  },
  "cases": [
    {
      "id": "test2",
      "enabled": true,
      "projectCount": 2,
      "projectName": "flowtesting-create-2",
      "syncMode": "serialPerProject",
      "createProjectData": {
        "projectNumber": "352",
        "location": "ANDORRA",
        "customer": "advanced engg",
        "startDate": "19-Feb-2026",
        "endDate": "20-Feb-2026",
        "projectStatus": "Initiated",
        "projectType": "Pipeline",
        "pipelineFeatures": ["Welding"],
        "subFeatures": ["CRCE Machines"],
        "machines": ["IWM", "P-625"]
      },
      "syncRuns": [
        {
          "dbFiles": ["bolt_station3_cw.db"],
          "paramFile": "p600z_example.csv"
        }
      ]
    }
  ]
}
```

---

## How to Use

To run this specific modular test, execute the following command in your terminal:

```bash
npx playwright test tests/create-device-register-assign-sync.spec.js --headed
```
